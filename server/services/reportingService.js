import { getDatabase } from "../db/sqlite.js";
import { getEffectiveShares } from "./profitShareService.js";
import { findById } from "../db/sqlite.js";

function resolvePeriod(query) {
  const today = new Date();
  if (query.from && query.to) {
    return { from: query.from, to: query.to };
  }

  const period = query.period || "monthly";

  switch (period) {
    case "daily":
      return {
        from: today.toISOString().slice(0, 10),
        to: today.toISOString().slice(0, 10),
      };
    case "weekly": {
      const day = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        from: monday.toISOString().slice(0, 10),
        to: sunday.toISOString().slice(0, 10),
      };
    }
    case "yearly":
      return {
        from: `${today.getFullYear()}-01-01`,
        to: `${today.getFullYear()}-12-31`,
      };
    case "monthly":
    default: {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      return {
        from: `${year}-${month}-01`,
        to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
      };
    }
  }
}

export function getProfitLoss(query) {
  const db = getDatabase();
  const { from, to } = resolvePeriod(query);

  const revenueRows = db.prepare(`
    SELECT jl.account_code, a.name, SUM(jl.credit) - SUM(jl.debit) as amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN accounts a ON a.code = jl.account_code
    WHERE a.type = 'revenue' AND je.entry_date >= ? AND je.entry_date <= ?
    GROUP BY jl.account_code
    HAVING amount != 0
    ORDER BY jl.account_code
  `).all(from, to);

  const cogsRows = db.prepare(`
    SELECT jl.account_code, a.name, SUM(jl.debit) - SUM(jl.credit) as amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN accounts a ON a.code = jl.account_code
    WHERE a.type = 'cogs' AND je.entry_date >= ? AND je.entry_date <= ?
    GROUP BY jl.account_code
    HAVING amount != 0
    ORDER BY jl.account_code
  `).all(from, to);

  const expenseRows = db.prepare(`
    SELECT jl.account_code, a.name, SUM(jl.debit) - SUM(jl.credit) as amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN accounts a ON a.code = jl.account_code
    WHERE a.type = 'expense' AND je.entry_date >= ? AND je.entry_date <= ?
    GROUP BY jl.account_code
    HAVING amount != 0
    ORDER BY jl.account_code
  `).all(from, to);

  const totalRevenue = revenueRows.reduce((s, r) => s + r.amount, 0);
  const totalCogs = cogsRows.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenseRows.reduce((s, r) => s + r.amount, 0);

  return {
    period: { from, to },
    revenue: {
      total: totalRevenue,
      breakdown: revenueRows.map((r) => ({ account_code: r.account_code, name: r.name, amount: r.amount })),
    },
    cogs: {
      total: totalCogs,
      breakdown: cogsRows.map((r) => ({ account_code: r.account_code, name: r.name, amount: r.amount })),
    },
    gross_profit: totalRevenue - totalCogs,
    expenses: {
      total: totalExpenses,
      breakdown: expenseRows.map((r) => ({ account_code: r.account_code, name: r.name, amount: r.amount })),
    },
    net_profit: totalRevenue - totalCogs - totalExpenses,
  };
}

export function getCashPosition(query) {
  const db = getDatabase();
  const asOf = query.as_of || new Date().toISOString().slice(0, 10);

  const rows = db.prepare(`
    SELECT jl.account_code, a.name, SUM(jl.debit) - SUM(jl.credit) as balance
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN accounts a ON a.code = jl.account_code
    WHERE jl.account_code IN ('1001','1002','1003','1004','1005','1006')
      AND je.entry_date <= ?
    GROUP BY jl.account_code
    HAVING balance != 0
    ORDER BY jl.account_code
  `).all(asOf);

  const total = rows.reduce((s, r) => s + r.balance, 0);

  return {
    as_of: asOf,
    total,
    accounts: rows.map((r) => ({ code: r.account_code, name: r.name, balance: r.balance })),
  };
}

export function getReceivables(query) {
  const db = getDatabase();
  const asOf = query.as_of || new Date().toISOString().slice(0, 10);

  const totalRow = db.prepare(`
    SELECT SUM(jl.debit) - SUM(jl.credit) as outstanding
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE jl.account_code = '1100' AND je.entry_date <= ?
  `).get(asOf);

  const bookingRows = db.prepare(`
    SELECT je.reference_id as booking_id, SUM(jl.debit) - SUM(jl.credit) as outstanding
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE jl.account_code = '1100'
      AND je.reference_type = 'booking'
      AND je.entry_date <= ?
    GROUP BY je.reference_id
    HAVING outstanding > 0
    ORDER BY outstanding DESC
  `).all(asOf);

  const bookings = bookingRows.map((r) => {
    const booking = findById("bookings", r.booking_id);
    return {
      booking_id: r.booking_id,
      customer_name: booking?.customer_name || "Unknown",
      total_price: booking ? Math.round(booking.total_price * 100) : 0,
      paid: booking ? Math.round((booking.paid_amount || 0) * 100) : 0,
      outstanding: r.outstanding,
    };
  });

  return {
    as_of: asOf,
    total_outstanding: totalRow?.outstanding || 0,
    bookings,
  };
}

export function getPartnerShares(query, requestingUser) {
  const { from, to } = resolvePeriod(query);
  const db = getDatabase();

  const pnl = getProfitLoss({ from, to });
  const netProfit = pnl.net_profit;

  const effectiveShares = getEffectiveShares(from, to);
  if (effectiveShares.length === 0) {
    return {
      period: { from, to },
      net_profit: netProfit,
      message: "No partners configured",
      shares: [],
    };
  }

  const shares = effectiveShares.map((s) => {
    const user = findById("users", s.user_id);
    const grossShare = Math.round((netProfit * s.effective_bp) / 10000);

    const payoutRow = db.prepare(`
      SELECT COALESCE(SUM(jl.debit), 0) as paid
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE jl.account_code = '3100'
        AND je.reference_type = 'payout'
        AND je.created_by = ?
        AND je.entry_date >= ? AND je.entry_date <= ?
    `).get(s.user_id, from, to);

    return {
      user_id: s.user_id,
      full_name: user?.full_name || "Unknown",
      effective_bp: s.effective_bp,
      effective_pct: s.effective_bp / 100,
      gross_share: grossShare,
      paid_out: payoutRow?.paid || 0,
      outstanding: grossShare - (payoutRow?.paid || 0),
    };
  });

  const bpRoundingDiff = netProfit - shares.reduce((s, sh) => s + sh.gross_share, 0);
  if (bpRoundingDiff !== 0 && shares.length > 0) {
    shares[0].gross_share += bpRoundingDiff;
    shares[0].outstanding += bpRoundingDiff;
  }

  let filteredShares = shares;
  if (requestingUser && requestingUser.role === "partner") {
    filteredShares = shares.filter((s) => s.user_id === requestingUser._id);
  }

  return {
    period: { from, to },
    net_profit: netProfit,
    shares: filteredShares,
  };
}

export function getDashboard(query, requestingUser) {
  const db = getDatabase();
  const { from, to } = resolvePeriod(query);
  const pnl = getProfitLoss({ from, to });

  const base = {
    period: { from, to },
    total_revenue: pnl.revenue.total,
    total_expenses: pnl.expenses.total,
    cogs: pnl.cogs.total,
    net_profit: pnl.net_profit,
  };

  if (requestingUser.role === "partner") {
    const partnerReport = getPartnerShares({ from, to }, requestingUser);
    const myShare = partnerReport.shares[0] || null;
    return { ...base, my_share: myShare };
  }

  const cashPos = getCashPosition({ as_of: to });
  const arRow = db.prepare(`
    SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) as total
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE jl.account_code = '1100' AND je.entry_date <= ?
  `).get(to);

  const partnerCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'partner' AND status = 'active'").get();
  const bookingCount = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE date >= ? AND date <= ?").all(from, to);
  const orderCount = db.prepare("SELECT COUNT(*) as count FROM orders WHERE created_at >= ? AND created_at <= ?").all(from + "T00:00:00", to + "T23:59:59");

  return {
    ...base,
    total_cash: cashPos.total,
    total_receivables: arRow?.total || 0,
    partner_count: partnerCount?.count || 0,
    booking_count: bookingCount?.[0]?.count || 0,
    order_count: orderCount?.[0]?.count || 0,
  };
}

export { resolvePeriod };
