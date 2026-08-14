import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import prisma from "../db/prismaClient.js";

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private/Admin
export const getPayments = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit, 10) || 500;
  // sort logic translation (e.g. -createdAt -> { createdAt: 'desc' })
  let orderBy = { created_at: "desc" };
  if (req.query.sort) {
    const isDesc = req.query.sort.startsWith("-");
    const rawField = req.query.sort.replace("-", "");
    const field = ["createdAt", "created_date", "created_at"].includes(rawField) ? "created_at" : rawField;
    orderBy = { [field]: isDesc ? "desc" : "asc" };
  }

  const payments = await prisma.payment.findMany({
    orderBy,
    take: limit,
  });

  res
    .status(200)
    .json({ success: true, count: payments.length, data: payments });
});

// @desc    Create new payment
// @route   POST /api/payments
// @access  Private
export const createPayment = asyncHandler(async (req, res, next) => {
  const payment = await prisma.payment.create({ data: req.body });
  res.status(201).json({ success: true, data: payment });
});
