import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import { listRecords, findById, createRecord, deleteById } from "../db/sqlite.js";
import { postIncome, postIncomeReversal } from "../services/ledgerPostingService.js";

export const getIncomes = asyncHandler(async (req, res) => {
  const where = [];
  const params = [];

  if (req.query.from) { where.push("entry_date >= ?"); params.push(req.query.from); }
  if (req.query.to) { where.push("entry_date <= ?"); params.push(req.query.to); }
  if (req.query.account_code) { where.push("account_code = ?"); params.push(req.query.account_code); }
  if (req.query.payment_method) { where.push("payment_method = ?"); params.push(req.query.payment_method); }

  const incomes = listRecords("incomes", {
    sort: req.query.sort || "-entry_date",
    limit: parseInt(req.query.limit, 10) || 500,
    where: where.join(" AND "),
    params,
  });
  res.status(200).json({ success: true, count: incomes.length, data: incomes });
});

export const getIncome = asyncHandler(async (req, res, next) => {
  const income = findById("incomes", req.params.id);
  if (!income) return next(new ErrorResponse("Income not found", 404));
  res.status(200).json({ success: true, data: income });
});

export const createIncome = asyncHandler(async (req, res, next) => {
  if (!req.body.description || !req.body.amount || !req.body.entry_date) {
    return next(new ErrorResponse("description, amount, and entry_date are required", 400));
  }

  const income = createRecord("incomes", {
    ...req.body,
    created_by: req.user._id,
  });

  postIncome(income, req.user._id);

  res.status(201).json({ success: true, data: income });
});

export const deleteIncome = asyncHandler(async (req, res, next) => {
  const income = findById("incomes", req.params.id);
  if (!income) return next(new ErrorResponse("Income not found", 404));

  postIncomeReversal(income, req.user._id);
  deleteById("incomes", req.params.id);

  res.status(200).json({ success: true, data: {} });
});
