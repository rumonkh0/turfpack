import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import { listRecords, findById, createRecord, deleteById } from "../db/sqlite.js";
import { postExpense, postExpenseReversal } from "../services/ledgerPostingService.js";

export const getExpenses = asyncHandler(async (req, res) => {
  const where = [];
  const params = [];

  if (req.query.from) { where.push("entry_date >= ?"); params.push(req.query.from); }
  if (req.query.to) { where.push("entry_date <= ?"); params.push(req.query.to); }
  if (req.query.account_code) { where.push("account_code = ?"); params.push(req.query.account_code); }
  if (req.query.payment_method) { where.push("payment_method = ?"); params.push(req.query.payment_method); }

  const expenses = listRecords("expenses", {
    sort: req.query.sort || "-entry_date",
    limit: parseInt(req.query.limit, 10) || 500,
    where: where.join(" AND "),
    params,
  });
  res.status(200).json({ success: true, count: expenses.length, data: expenses });
});

export const getExpense = asyncHandler(async (req, res, next) => {
  const expense = findById("expenses", req.params.id);
  if (!expense) return next(new ErrorResponse("Expense not found", 404));
  res.status(200).json({ success: true, data: expense });
});

export const createExpense = asyncHandler(async (req, res, next) => {
  if (!req.body.description || !req.body.amount || !req.body.entry_date) {
    return next(new ErrorResponse("description, amount, and entry_date are required", 400));
  }

  const expense = createRecord("expenses", {
    ...req.body,
    created_by: req.user._id,
  });

  postExpense(expense, req.user._id);

  res.status(201).json({ success: true, data: expense });
});

export const deleteExpense = asyncHandler(async (req, res, next) => {
  const expense = findById("expenses", req.params.id);
  if (!expense) return next(new ErrorResponse("Expense not found", 404));

  postExpenseReversal(expense, req.user._id);
  deleteById("expenses", req.params.id);

  res.status(200).json({ success: true, data: {} });
});
