import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import prisma from "../db/prismaClient.js";
import { postIncome, postIncomeReversal } from "../services/ledgerPostingService.js";

export const getIncomes = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 500;
  let orderBy = { entry_date: "desc" };
  if (req.query.sort) {
    const isDesc = req.query.sort.startsWith("-");
    const rawField = req.query.sort.replace("-", "");
    const field = ["createdAt", "created_date", "created_at"].includes(rawField) ? "created_at" : rawField;
    orderBy = { [field]: isDesc ? "desc" : "asc" };
  }

  const where = {};
  if (req.query.from || req.query.to) {
    where.entry_date = {};
    if (req.query.from) where.entry_date.gte = req.query.from;
    if (req.query.to) where.entry_date.lte = req.query.to;
  }
  if (req.query.account_code) {
    where.account_code = req.query.account_code;
  }
  if (req.query.payment_method) {
    where.payment_method = req.query.payment_method;
  }

  const incomes = await prisma.income.findMany({
    where,
    orderBy,
    take: limit,
  });

  res.status(200).json({ success: true, count: incomes.length, data: incomes });
});

export const getIncome = asyncHandler(async (req, res, next) => {
  const income = await prisma.income.findUnique({ where: { id: req.params.id } });
  if (!income) return next(new ErrorResponse("Income not found", 404));
  res.status(200).json({ success: true, data: income });
});

export const createIncome = asyncHandler(async (req, res, next) => {
  if (!req.body.description || !req.body.amount || !req.body.entry_date) {
    return next(new ErrorResponse("description, amount, and entry_date are required", 400));
  }

  const income = await prisma.income.create({
    data: {
      ...req.body,
      created_by: req.user._id,
    }
  });

  try {
    await postIncome(income, req.user._id);
  } catch (err) {
    console.error("Ledger error:", err);
  }

  res.status(201).json({ success: true, data: income });
});

export const deleteIncome = asyncHandler(async (req, res, next) => {
  const income = await prisma.income.findUnique({ where: { id: req.params.id } });
  if (!income) return next(new ErrorResponse("Income not found", 404));

  try {
    await postIncomeReversal(income, req.user._id);
  } catch (err) {
    console.error("Ledger error:", err);
  }
  
  await prisma.income.delete({ where: { id: req.params.id } });

  res.status(200).json({ success: true, data: {} });
});
