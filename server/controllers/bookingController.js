import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import {
  listRecords,
  findById,
  findOne,
  createRecord,
  updateById,
  deleteById,
} from "../db/sqlite.js";
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
  const bookings = listRecords("bookings", {
    sort: req.query.sort || "-createdAt",
    limit: parseInt(req.query.limit, 10) || 500,
  });
  res
    .status(200)
    .json({ success: true, count: bookings.length, data: bookings });
});

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
export const getBooking = asyncHandler(async (req, res, next) => {
  const booking = findById("bookings", req.params.id);
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
  const turf = findById("turfs", req.body.turf_id);
  if (!turf) {
    return next(
      new ErrorResponse(`Turf not found with id of ${req.body.turf_id}`, 404),
    );
  }

  // Check for conflicts
  const conflict = findOne(
    "bookings",
    `turf_id = ?
      AND date = ?
      AND status != 'cancelled'
      AND start_hour < ?
      AND end_hour > ?`,
    [
      req.body.turf_id,
      req.body.date,
      req.body.end_hour || req.body.start_hour + 1,
      req.body.start_hour,
    ],
  );

  if (conflict) {
    return next(new ErrorResponse("Time slot already booked", 400));
  }

  const booking = createRecord("bookings", {
    ...req.body,
    turf_id: req.body.turf_id,
    turf_name: turf.name,
  });

  // Create payment record if status is paid or partial
  if (["paid", "partial"].includes(req.body.payment_status)) {
    const paymentAmount =
      req.body.payment_status === "partial"
        ? Number(req.body.paid_amount || 0)
        : Number(req.body.total_price || 0);

    createRecord("payments", {
      booking_id: booking.id,
      amount: paymentAmount,
      status: "completed",
      method: req.body.payment_method || "bkash",
      transaction_id: req.body.txn_id,
      customer_name: req.body.customer_name,
      customer_phone: req.body.customer_phone,
    });
  }

  // Post to ledger
  try {
    postBookingCreated(booking, req.user?._id || null);
  } catch (err) {
    console.error("⚠️ Ledger posting failed for booking creation:", err.message);
  }

  res.status(201).json({ success: true, data: booking });
});

// @desc    Update booking
// @route   PUT /api/bookings/:id
// @access  Private
export const updateBooking = asyncHandler(async (req, res, next) => {
  let booking = findById("bookings", req.params.id);

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404),
    );
  }

  const oldStatus = booking.status;
  const oldPaymentStatus = booking.payment_status;
  const oldPaymentHistoryLength = (booking.payment_history || []).length;

  booking = updateById("bookings", req.params.id, req.body);

  // Ledger hooks
  const userId = req.user?._id || null;
  try {
    // Cancellation of unpaid booking
    if (req.body.status === "cancelled" && oldStatus !== "cancelled" && oldPaymentStatus === "unpaid") {
      postBookingCancelled(booking, userId);
    }
    // Refund
    if (req.body.payment_status === "refunded" && oldPaymentStatus !== "refunded") {
      postBookingRefund(booking, userId);
    }
    // Installment payment added
    const newHistory = booking.payment_history || [];
    if (newHistory.length > oldPaymentHistoryLength) {
      for (let i = oldPaymentHistoryLength; i < newHistory.length; i++) {
        postBookingInstallment(booking, newHistory[i], i, userId);
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
  const booking = findById("bookings", req.params.id);

  if (!booking) {
    return next(
      new ErrorResponse(`Booking not found with id of ${req.params.id}`, 404),
    );
  }

  deleteById("bookings", req.params.id);

  res.status(200).json({ success: true, data: {} });
});
