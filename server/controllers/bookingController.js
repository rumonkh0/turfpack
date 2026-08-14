import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import prisma from "../db/prismaClient.js";
import {
  postBookingCreated,
  postBookingInstallment,
  postBookingCancelled,
  postBookingRefund,
} from "../services/ledgerPostingService.js";

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
  const turf = await prisma.turf.findUnique({ where: { id: req.body.turf_id } });
  if (!turf) {
    return next(
      new ErrorResponse(`Turf not found with id of ${req.body.turf_id}`, 404),
    );
  }

  const startHour = Number(req.body.start_hour);
  const endHour = Number(req.body.end_hour || req.body.start_hour + 1);

  // Check for conflicts
  const conflict = await prisma.booking.findFirst({
    where: {
      turf_id: req.body.turf_id,
      date: req.body.date,
      status: { not: 'cancelled' },
      start_hour: { lt: endHour },
      end_hour: { gt: startHour },
    }
  });

  if (conflict) {
    return next(new ErrorResponse("Time slot already booked", 400));
  }

  const booking = await prisma.booking.create({
    data: {
      ...req.body,
      start_hour: startHour,
      end_hour: endHour,
      duration_hours: req.body.duration_hours !== undefined ? Number(req.body.duration_hours) : (endHour - startHour),
      total_price: Number(req.body.total_price || 0),
      paid_amount: Number(req.body.paid_amount || 0),
      turf_id: req.body.turf_id,
      turf_name: turf.name,
    }
  });

  // Create payment record if status is paid or partial
  if (["paid", "partial"].includes(req.body.payment_status)) {
    const paymentAmount =
      req.body.payment_status === "partial"
        ? Number(req.body.paid_amount || 0)
        : Number(req.body.total_price || 0);

    await prisma.payment.create({
      data: {
        booking_id: booking.id,
        amount: paymentAmount,
        status: "completed",
        method: req.body.payment_method || "bkash",
        transaction_id: req.body.txn_id,
        customer_name: req.body.customer_name,
        customer_phone: req.body.customer_phone,
      }
    });
  }

  // Post to ledger
  try {
    await postBookingCreated(booking, req.user?._id || null);
  } catch (err) {
    console.error("⚠️ Ledger posting failed for booking creation:", err.message);
  }

  res.status(201).json({ success: true, data: booking });
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
