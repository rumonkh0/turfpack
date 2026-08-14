import prisma from "../db/prismaClient.js";
import { getEffectiveShares } from "./profitShareService.js";

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

export async function getProfitLoss(query) {
  const { from, to } = resolvePeriod(query);

  const revenueRows = await prisma.$queryRawUnsafe(`
    SELECT jl.account_code, a.name, SUM(jl.credit) - SUM(jl.debit) as amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN accounts a ON a.code = jl.account_code
    WHERE a.type = 'revenue' AND je.entry_date >= ? AND je.entry_date <= ?
    GROUP BY jl.account_code, a.name
    HAVING SUM(jl.credit) - SUM(jl.debit) != 0
    ORDER BY jl.account_code
  `, from, to);

  const cogsRows = await prisma.$queryRawUnsafe(`
    SELECT jl.account_code, a.name, SUM(jl.debit) - SUM(jl.credit) as amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN accounts a ON a.code = jl.account_code
    WHERE a.type = 'cogs' AND je.entry_date >= ? AND je.entry_date <= ?
    GROUP BY jl.account_code, a.name
    HAVING SUM(jl.debit) - SUM(jl.credit) != 0
    ORDER BY jl.account_code
  `, from, to);

  const expenseRows = await prisma.$queryRawUnsafe(`
    SELECT jl.account_code, a.name, SUM(jl.debit) - SUM(jl.credit) as amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN accounts a ON a.code = jl.account_code
    WHERE a.type = 'expense' AND je.entry_date >= ? AND je.entry_date <= ?
    GROUP BY jl.account_code, a.name
    HAVING SUM(jl.debit) - SUM(jl.credit) != 0
    ORDER BY jl.account_code
  `, from, to);

  const parsedRev = revenueRows.map(r => ({ account_code: r.account_code, name: r.name, amount: Number(r.amount) }));
  const parsedCogs = cogsRows.map(r => ({ account_code: r.account_code, name: r.name, amount: Number(r.amount) }));
  const parsedExp = expenseRows.map(r => ({ account_code: r.account_code, name: r.name, amount: Number(r.amount) }));

  const totalRevenue = parsedRev.reduce((s, r) => s + r.amount, 0);
  const totalCogs = parsedCogs.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = parsedExp.reduce((s, r) => s + r.amount, 0);

  return {
    period: { from, to },
    revenue: {
      total: totalRevenue,
      breakdown: parsedRev,
    },
    cogs: {
      total: totalCogs,
      breakdown: parsedCogs,
    },
    gross_profit: totalRevenue - totalCogs,
    expenses: {
      total: totalExpenses,
      breakdown: parsedExp,
    },
    net_profit: totalRevenue - totalCogs - totalExpenses,
  };
}

export async function getCashPosition(query) {
  const asOf = query.as_of || new Date().toISOString().slice(0, 10);

  const rows = await prisma.$queryRawUnsafe(`
    SELECT jl.account_code, a.name, SUM(jl.debit) - SUM(jl.credit) as balance
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN accounts a ON a.code = jl.account_code
    WHERE jl.account_code IN ('1001','1002','1003','1004','1005','1006')
      AND je.entry_date <= ?
    GROUP BY jl.account_code, a.name
    HAVING SUM(jl.debit) - SUM(jl.credit) != 0
    ORDER BY jl.account_code
  `, asOf);

  const parsed = rows.map(r => ({ code: r.account_code, name: r.name, balance: Number(r.balance) }));
  const total = parsed.reduce((s, r) => s + r.balance, 0);

  return {
    as_of: asOf,
    total,
    accounts: parsed,
  };
}

export async function getReceivables(query) {
  const asOf = query.as_of || new Date().toISOString().slice(0, 10);

  const totalRow = await prisma.$queryRawUnsafe(`
    SELECT SUM(jl.debit) - SUM(jl.credit) as outstanding
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE jl.account_code = '1100' AND je.entry_date <= ?
  `, asOf);

  const bookingRows = await prisma.$queryRawUnsafe(`
    SELECT je.reference_id as booking_id, SUM(jl.debit) - SUM(jl.credit) as outstanding
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE jl.account_code = '1100'
      AND je.reference_type = 'booking'
      AND je.entry_date <= ?
    GROUP BY je.reference_id
    HAVING SUM(jl.debit) - SUM(jl.credit) > 0
    ORDER BY SUM(jl.debit) - SUM(jl.credit) DESC
  `, asOf);

  const bookings = [];
  for (const r of bookingRows) {
    const booking = await prisma.booking.findUnique({ where: { id: r.booking_id } });
    bookings.push({
      booking_id: r.booking_id,
      customer_name: booking?.customer_name || "Unknown",
      total_price: booking ? Math.round(booking.total_price * 100) : 0,
      paid: booking ? Math.round((booking.paid_amount || 0) * 100) : 0,
      outstanding: Number(r.outstanding),
    });
  }

  return {
    as_of: asOf,
    total_outstanding: totalRow.length > 0 ? Number(totalRow[0].outstanding || 0) : 0,
    bookings,
  };
}

export async function getPartnerShares(query, requestingUser) {
  const { from, to } = resolvePeriod(query);

  const pnl = await getProfitLoss({ from, to });
  const netProfit = pnl.net_profit;

  const effectiveShares = await getEffectiveShares(from, to);
  if (effectiveShares.length === 0) {
    return {
      period: { from, to },
      net_profit: netProfit,
      message: "No partners configured",
      shares: [],
    };
  }

  const shares = [];
  for (const s of effectiveShares) {
    const user = await prisma.user.findUnique({ where: { id: s.user_id } });
    const grossShare = Math.round((netProfit * s.effective_bp) / 10000);

    const payoutRow = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM(jl.debit), 0) as paid
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE jl.account_code = '3100'
        AND je.reference_type = 'payout'
        AND je.created_by = ?
        AND je.entry_date >= ? AND je.entry_date <= ?
    `, s.user_id, from, to);

    const paidOut = payoutRow.length > 0 ? Number(payoutRow[0].paid || 0) : 0;

    shares.push({
      user_id: s.user_id,
      full_name: user?.full_name || "Unknown",
      effective_bp: s.effective_bp,
      effective_pct: s.effective_bp / 100,
      gross_share: grossShare,
      paid_out: paidOut,
      outstanding: grossShare - paidOut,
    });
  }

  const bpRoundingDiff = netProfit - shares.reduce((s, sh) => s + sh.gross_share, 0);
  if (bpRoundingDiff !== 0 && shares.length > 0) {
    shares[0].gross_share += bpRoundingDiff;
    shares[0].outstanding += bpRoundingDiff;
  }

  let filteredShares = shares;
  if (requestingUser && requestingUser.role === "partner") {
    filteredShares = shares.filter((s) => s.user_id === requestingUser.id);
  }

  return {
    period: { from, to },
    net_profit: netProfit,
    shares: filteredShares,
  };
}

export async function getDashboard(query, requestingUser) {
  const { from, to } = resolvePeriod(query);
  const pnl = await getProfitLoss({ from, to });

  const base = {
    period: { from, to },
    total_revenue: pnl.revenue.total,
    total_expenses: pnl.expenses.total,
    cogs: pnl.cogs.total,
    net_profit: pnl.net_profit,
  };

  if (requestingUser.role === "partner") {
    const partnerReport = await getPartnerShares({ from, to }, requestingUser);
    const myShare = partnerReport.shares[0] || null;
    return { ...base, my_share: myShare };
  }

  const cashPos = await getCashPosition({ as_of: to });
  const arRow = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) as total
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE jl.account_code = '1100' AND je.entry_date <= ?
  `, to);

  const partnerCount = await prisma.user.count({ where: { role: 'partner', status: 'active' } });
  
  // Need from and to as Dates for count comparison, SQLite handles iso strings but let's use Prisma properly
  const bookingCount = await prisma.booking.count({
    where: {
      date: {
        gte: from,
        lte: to
      }
    }
  });

  const orderCount = await prisma.order.count({
    where: {
      created_at: {
        gte: new Date(from + "T00:00:00Z"),
        lte: new Date(to + "T23:59:59Z")
      }
    }
  });

  return {
    ...base,
    total_cash: cashPos.total,
    total_receivables: arRow.length > 0 ? Number(arRow[0].total || 0) : 0,
    partner_count: partnerCount || 0,
    booking_count: bookingCount || 0,
    order_count: orderCount || 0,
  };
}

export { resolvePeriod };
