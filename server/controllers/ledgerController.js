import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import { getDatabase } from "../db/sqlite.js";

export const getJournalEntries = asyncHandler(async (req, res) => {
  const db = getDatabase();
  const where = [];
  const params = [];

  if (req.query.from) { where.push("je.entry_date >= ?"); params.push(req.query.from); }
  if (req.query.to) { where.push("je.entry_date <= ?"); params.push(req.query.to); }
  if (req.query.reference_type) { where.push("je.reference_type = ?"); params.push(req.query.reference_type); }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = parseInt(req.query.limit, 10) || 100;

  const entries = db.prepare(`
    SELECT je.* FROM journal_entries je ${whereSql}
    ORDER BY je.entry_date DESC, je.created_at DESC
    LIMIT ?
  `).all(...params, limit);

  const lineStmt = db.prepare(`
    SELECT jl.*, a.name as account_name
    FROM journal_lines jl
    LEFT JOIN accounts a ON a.code = jl.account_code
    WHERE jl.journal_entry_id = ?
    ORDER BY jl.debit DESC
  `);

  const data = entries.map((entry) => {
    const lines = lineStmt.all(entry.id);
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    return {
      _id: entry.id,
      ...entry,
      createdAt: entry.created_at,
      lines: lines.map((l) => ({
        account_code: l.account_code,
        account_name: l.account_name,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
      })),
      total_debit: totalDebit,
      total_credit: totalCredit,
    };
  });

  res.status(200).json({ success: true, count: data.length, data });
});

export const getJournalEntry = asyncHandler(async (req, res, next) => {
  const db = getDatabase();
  const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(req.params.id);
  if (!entry) return next(new ErrorResponse("Journal entry not found", 404));

  const lines = db.prepare(`
    SELECT jl.*, a.name as account_name
    FROM journal_lines jl
    LEFT JOIN accounts a ON a.code = jl.account_code
    WHERE jl.journal_entry_id = ?
    ORDER BY jl.debit DESC
  `).all(entry.id);

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  res.status(200).json({
    success: true,
    data: {
      _id: entry.id,
      ...entry,
      createdAt: entry.created_at,
      lines: lines.map((l) => ({
        account_code: l.account_code,
        account_name: l.account_name,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
      })),
      total_debit: totalDebit,
      total_credit: totalCredit,
    },
  });
});
