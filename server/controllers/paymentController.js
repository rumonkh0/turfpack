import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import { listRecords, createRecord } from "../db/sqlite.js";

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private/Admin
export const getPayments = asyncHandler(async (req, res, next) => {
  const payments = listRecords("payments", {
    sort: req.query.sort || "-createdAt",
    limit: parseInt(req.query.limit, 10) || 500,
  });
  res
    .status(200)
    .json({ success: true, count: payments.length, data: payments });
});

// @desc    Create new payment
// @route   POST /api/payments
// @access  Private
export const createPayment = asyncHandler(async (req, res, next) => {
  const payment = createRecord("payments", req.body);
  res.status(201).json({ success: true, data: payment });
});
