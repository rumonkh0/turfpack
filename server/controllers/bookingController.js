import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import prisma from "../db/prismaClient.js";
import {
  postBookingCreated,
  postBookingInstallment,
  postBookingCancelled,
  postBookingRefund,
} from "../services/ledgerPostingService.js";
import { createBooking as createBookingService } from "../services/bookingService.js";

// @desc    Get all bookings
// @route   GET /api/bookings
// @access  Private/Admin
export const getBookings = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit, 10) || 500;
  let orderBy = { created_at: "desc" };
  if (req.query.sort) {
    const isDesc = req.query.sort.startsWith("-");
    const rawField = req.query.sort.replace("-", "");
    const field = ["createdAt", "created_date", "created_at"].includes(rawField) ? "created_at" : rawField;
    orderBy = { [field]: isDesc ? "desc" : "asc" };
  }

  const bookings = await prisma.booking.findMany({
    orderBy,
    take: limit,
  });

  res
    .status(200)
    .json({ success: true, count: bookings.length, data: bookings });
});

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
export const getBooking = asyncHandler(async (req, res, next) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404),
    );
  }
  res.status(200).json({ success: true, data: booking });
});

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
export const createBooking = asyncHandler(async (req, res, next) => {
  try {
    const booking = await createBookingService(req.body, req.user?._id || null);
    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    return next(new ErrorResponse(err.message, 400));
  }
});

// @desc    Update booking
// @route   PUT /api/bookings/:id
// @access  Private
export const updateBooking = asyncHandler(async (req, res, next) => {
  let booking = await prisma.booking.findUnique({ where: { id: req.params.id } });

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404),
    );
  }

  const oldStatus = booking.status;
  const oldPaymentStatus = booking.payment_status;
  const oldPaymentHistoryLength = (booking.payment_history || []).length;

  booking = await prisma.booking.update({
    where: { id: req.params.id },
    data: req.body,
  });

  // Ledger hooks
  const userId = req.user?._id || null;
  try {
    // Cancellation of unpaid booking
    if (req.body.status === "cancelled" && oldStatus !== "cancelled" && oldPaymentStatus === "unpaid") {
      await postBookingCancelled(booking, userId);
    }
    // Refund
    if (req.body.payment_status === "refunded" && oldPaymentStatus !== "refunded") {
      await postBookingRefund(booking, userId);
    }
    // Installment payment added
    const newHistory = booking.payment_history || [];
    if (newHistory.length > oldPaymentHistoryLength) {
      for (let i = oldPaymentHistoryLength; i < newHistory.length; i++) {
        await postBookingInstallment(booking, newHistory[i], i, userId);
      }
    }
  } catch (err) {
    console.error("⚠️ Ledger posting failed for booking update:", err.message);
  }

  res.status(200).json({ success: true, data: booking });
});

// @desc    Delete booking
// @route   DELETE /api/bookings/:id
// @access  Private/Admin
export const deleteBooking = asyncHandler(async (req, res, next) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404),
    );
  }

  await prisma.booking.delete({ where: { id: req.params.id } });

  res.status(200).json({ success: true, data: {} });
});
