import crypto from "crypto";
import { getDatabase, runTransaction } from "../db/sqlite.js";

const PAYMENT_METHOD_ACCOUNT = {
  bkash: "1001",
  nagad: "1002",
  rocket: "1003",
  cash: "1004",
  card: "1005",
  other: "1006",
};

function toPoisha(taka) {
  return Math.round(Number(taka) * 100);
}

function cashAccount(method) {
  return PAYMENT_METHOD_ACCOUNT[method] || "1006";
}

function postJournalEntry({ entry_date, description, reference_type, reference_id, posting_event, created_by, lines }) {
  const db = getDatabase();

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  if (totalDebit !== totalCredit) {
    throw new Error(`Journal imbalance: debit=${totalDebit} credit=${totalCredit}`);
  }

  return runTransaction(() => {
    const existing = db
      .prepare("SELECT id FROM journal_entries WHERE reference_type = ? AND reference_id = ? AND posting_event = ?")
      .get(reference_type, reference_id, posting_event);

    if (existing) return existing.id;

    const entryId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO journal_entries (id, entry_date, description, reference_type, reference_id, posting_event, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entryId, entry_date, description, reference_type, reference_id, posting_event, created_by, now);

    const insertLine = db.prepare(`
      INSERT INTO journal_lines (id, journal_entry_id, account_code, debit, credit, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const line of lines) {
      insertLine.run(crypto.randomUUID(), entryId, line.account_code, line.debit, line.credit, line.description || null, now);
    }

    return entryId;
  });
}

export function postBookingCreated(booking, createdBy) {
  const totalPoisha = toPoisha(booking.total_price);
  const method = booking.payment_method || "cash";

  // When payment_status is 'paid', the full amount was collected even if paid_amount=0 in the record
  const paidPoisha = booking.payment_status === "paid"
    ? totalPoisha
    : toPoisha(booking.paid_amount || 0);

  const lines = [
    { account_code: "1100", debit: totalPoisha, credit: 0, description: "Accounts Receivable" },
    { account_code: "4001", debit: 0, credit: totalPoisha, description: "Booking Revenue" },
  ];

  if (paidPoisha > 0) {
    lines.push(
      { account_code: cashAccount(method), debit: paidPoisha, credit: 0, description: `Payment via ${method}` },
      { account_code: "1100", debit: 0, credit: paidPoisha, description: "AR settlement" },
    );
  }

  return postJournalEntry({
    entry_date: booking.date || new Date().toISOString().slice(0, 10),
    description: `Booking created: ${booking.customer_name}`,
    reference_type: "booking",
    reference_id: booking._id || booking.id,
    posting_event: "booking:created",
    created_by: createdBy,
    lines,
  });
}

export function postBookingInstallment(booking, installment, paymentIndex, createdBy) {
  const amountPoisha = toPoisha(installment.amount);
  const method = installment.method || "cash";

  return postJournalEntry({
    entry_date: installment.date || new Date().toISOString().slice(0, 10),
    description: `Installment #${paymentIndex + 1}: ${booking.customer_name}`,
    reference_type: "booking",
    reference_id: booking._id || booking.id,
    posting_event: `booking:installment:${paymentIndex}`,
    created_by: createdBy,
    lines: [
      { account_code: cashAccount(method), debit: amountPoisha, credit: 0, description: `Payment via ${method}` },
      { account_code: "1100", debit: 0, credit: amountPoisha, description: "AR settlement" },
    ],
  });
}

export function postBookingCancelled(booking, createdBy) {
  const totalPoisha = toPoisha(booking.total_price);

  return postJournalEntry({
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Booking cancelled: ${booking.customer_name}`,
    reference_type: "booking",
    reference_id: booking._id || booking.id,
    posting_event: "booking:cancelled",
    created_by: createdBy,
    lines: [
      { account_code: "4001", debit: totalPoisha, credit: 0, description: "Revenue reversal" },
      { account_code: "1100", debit: 0, credit: totalPoisha, description: "AR reversal" },
    ],
  });
}

export function postBookingRefund(booking, createdBy) {
  const totalPoisha = toPoisha(booking.total_price);
  const paidPoisha = booking.payment_status === "paid"
    ? totalPoisha
    : toPoisha(booking.paid_amount || 0);
  const method = booking.payment_method || "cash";

  const lines = [
    { account_code: "4001", debit: totalPoisha, credit: 0, description: "Revenue reversal" },
  ];

  const arRemaining = totalPoisha - paidPoisha;
  if (arRemaining > 0) {
    lines.push({ account_code: "1100", debit: 0, credit: arRemaining, description: "AR write-off" });
  }

  if (paidPoisha > 0) {
    lines.push({ account_code: cashAccount(method), debit: 0, credit: paidPoisha, description: `Refund via ${method}` });
  }

  return postJournalEntry({
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Booking refund: ${booking.customer_name}`,
    reference_type: "booking",
    reference_id: booking._id || booking.id,
    posting_event: "booking:refund",
    created_by: createdBy,
    lines,
  });
}

export function postOrderCreated(order, costTotal, createdBy) {
  const totalPoisha = toPoisha(order.total_amount);
  const costPoisha = toPoisha(costTotal);
  const method = order.payment_method || "cash";

  const lines = [
    { account_code: cashAccount(method), debit: totalPoisha, credit: 0, description: `Payment via ${method}` },
    { account_code: "4002", debit: 0, credit: totalPoisha, description: "Product Sales Revenue" },
  ];

  if (costPoisha > 0) {
    lines.push(
      { account_code: "5001", debit: costPoisha, credit: 0, description: "Cost of Goods Sold" },
      { account_code: "1200", debit: 0, credit: costPoisha, description: "Inventory reduction" },
    );
  }

  return postJournalEntry({
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Order: ${order.customer_name || "Walk-in"}`,
    reference_type: "order",
    reference_id: order._id || order.id,
    posting_event: "order:created",
    created_by: createdBy,
    lines,
  });
}

export function postOrderCancelled(order, costTotal, createdBy) {
  const totalPoisha = toPoisha(order.total_amount);
  const costPoisha = toPoisha(costTotal);
  const method = order.payment_method || "cash";

  const lines = [
    { account_code: "4002", debit: totalPoisha, credit: 0, description: "Revenue reversal" },
    { account_code: cashAccount(method), debit: 0, credit: totalPoisha, description: `Refund via ${method}` },
  ];

  if (costPoisha > 0) {
    lines.push(
      { account_code: "1200", debit: costPoisha, credit: 0, description: "Inventory restoration" },
      { account_code: "5001", debit: 0, credit: costPoisha, description: "COGS reversal" },
    );
  }

  return postJournalEntry({
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Order cancelled: ${order.customer_name || "Walk-in"}`,
    reference_type: "order",
    reference_id: order._id || order.id,
    posting_event: "order:cancelled",
    created_by: createdBy,
    lines,
  });
}

export function postExpense(expense, createdBy) {
  const amountPoisha = toPoisha(expense.amount);
  const method = expense.payment_method || "cash";
  const accountCode = expense.account_code || "6099";

  return postJournalEntry({
    entry_date: expense.entry_date || new Date().toISOString().slice(0, 10),
    description: `Expense: ${expense.description}`,
    reference_type: "expense",
    reference_id: expense._id || expense.id,
    posting_event: "expense:created",
    created_by: createdBy,
    lines: [
      { account_code: accountCode, debit: amountPoisha, credit: 0, description: expense.description },
      { account_code: cashAccount(method), debit: 0, credit: amountPoisha, description: `Paid via ${method}` },
    ],
  });
}

export function postExpenseReversal(expense, createdBy) {
  const amountPoisha = toPoisha(expense.amount);
  const method = expense.payment_method || "cash";
  const accountCode = expense.account_code || "6099";

  return postJournalEntry({
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Expense reversed: ${expense.description}`,
    reference_type: "expense",
    reference_id: expense._id || expense.id,
    posting_event: "expense:reversed",
    created_by: createdBy,
    lines: [
      { account_code: cashAccount(method), debit: amountPoisha, credit: 0, description: `Reversal via ${method}` },
      { account_code: accountCode, debit: 0, credit: amountPoisha, description: "Expense reversal" },
    ],
  });
}

export function postIncome(income, createdBy) {
  const amountPoisha = toPoisha(income.amount);
  const method = income.payment_method || "cash";
  const accountCode = income.account_code || "4099";

  return postJournalEntry({
    entry_date: income.entry_date || new Date().toISOString().slice(0, 10),
    description: `Income: ${income.description}`,
    reference_type: "income",
    reference_id: income._id || income.id,
    posting_event: "income:created",
    created_by: createdBy,
    lines: [
      { account_code: cashAccount(method), debit: amountPoisha, credit: 0, description: `Received via ${method}` },
      { account_code: accountCode, debit: 0, credit: amountPoisha, description: income.description },
    ],
  });
}

export function postIncomeReversal(income, createdBy) {
  const amountPoisha = toPoisha(income.amount);
  const method = income.payment_method || "cash";
  const accountCode = income.account_code || "4099";

  return postJournalEntry({
    entry_date: new Date().toISOString().slice(0, 10),
    description: `Income reversed: ${income.description}`,
    reference_type: "income",
    reference_id: income._id || income.id,
    posting_event: "income:reversed",
    created_by: createdBy,
    lines: [
      { account_code: accountCode, debit: amountPoisha, credit: 0, description: "Income reversal" },
      { account_code: cashAccount(method), debit: 0, credit: amountPoisha, description: `Reversal via ${method}` },
    ],
  });
}

export function postPartnerPayout(payoutId, partner, amount, method, entryDate, createdBy) {
  const amountPoisha = toPoisha(amount);

  return postJournalEntry({
    entry_date: entryDate || new Date().toISOString().slice(0, 10),
    description: `Payout to ${partner.full_name}`,
    reference_type: "payout",
    reference_id: payoutId,
    posting_event: "payout:created",
    created_by: createdBy,
    lines: [
      { account_code: "3100", debit: amountPoisha, credit: 0, description: `Partner drawing: ${partner.full_name}` },
      { account_code: cashAccount(method), debit: 0, credit: amountPoisha, description: `Paid via ${method}` },
    ],
  });
}

export { toPoisha, cashAccount, PAYMENT_METHOD_ACCOUNT };
