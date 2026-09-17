import prisma from "../db/prismaClient.js";
import {
  postBookingCreated,
  postBookingInstallment,
  postBookingCancelled,
  postBookingRefund,
} from "./ledgerPostingService.js";

/**
 * Check if a time slot conflicts with existing bookings.
 * @param {string} turfId
 * @param {string} date - YYYY-MM-DD
 * @param {number} startHour
 * @param {number} endHour
 * @returns {Promise<object|null>} - Conflicting booking or null
 */
export async function checkSlotConflict(turfId, date, startHour, endHour) {
  return await prisma.booking.findFirst({
    where: {
      turf_id: turfId,
      date: date,
      status: { not: "cancelled" },
      start_hour: { lt: endHour },
      end_hour: { gt: startHour },
    },
  });
}

/**
 * Get available slots for a turf on a date.
 * @param {string} turfId
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Array<{start_hour: number, end_hour: number, available: boolean, price: number}>>}
 */
export async function getAvailableSlots(turfId, date) {
  const turf = await prisma.turf.findUnique({ where: { id: turfId } });
  if (!turf) return [];

  const bookings = await prisma.booking.findMany({
    where: { turf_id: turfId, date, status: { not: "cancelled" } },
    select: { start_hour: true, end_hour: true },
  });

  const dayOfWeek = new Date(date).getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri, Sat in BD

  const slots = [];
  const openingHour = turf.opening_hour !== undefined ? turf.opening_hour : 6;
  const closingHour = turf.closing_hour !== undefined ? turf.closing_hour : 24;

  for (let h = openingHour; h < closingHour; h++) {
    const isBooked = bookings.some((b) => b.start_hour < h + 1 && b.end_hour > h);
    let price = turf.base_price || 0;
    if (turf.peak_hours_start !== undefined && turf.peak_hours_end !== undefined && h >= turf.peak_hours_start && h < turf.peak_hours_end) {
      price = turf.peak_price || turf.base_price || 0;
    } else if (h >= 21) {
      price = turf.night_price || turf.base_price || 0;
    }
    if (isWeekend && turf.weekend_multiplier) {
      price = Math.round(price * turf.weekend_multiplier);
    }

    slots.push({ start_hour: h, end_hour: h + 1, available: !isBooked, price });
  }
  return slots;
}

/**
 * Calculate price for a booking.
 * @param {string} turfId
 * @param {string} date
 * @param {number} startHour
 * @param {number} endHour
 * @returns {Promise<number>} total price in taka
 */
export async function calculatePrice(turfId, date, startHour, endHour) {
  const turf = await prisma.turf.findUnique({ where: { id: turfId } });
  if (!turf) throw new Error("Turf not found");

  const dayOfWeek = new Date(date).getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  let total = 0;

  for (let h = startHour; h < endHour; h++) {
    let price = turf.base_price || 0;
    if (turf.peak_hours_start !== undefined && turf.peak_hours_end !== undefined && h >= turf.peak_hours_start && h < turf.peak_hours_end) {
      price = turf.peak_price || turf.base_price || 0;
    } else if (h >= 21) {
      price = turf.night_price || turf.base_price || 0;
    }
    if (isWeekend && turf.weekend_multiplier) {
      price = Math.round(price * turf.weekend_multiplier);
    }
    total += price;
  }
  return total;
}

/**
 * Create a booking with payment and ledger posting.
 * @param {object} data
 * @param {string|null} createdBy - user ID
 * @returns {Promise<object>} created booking
 */
export async function createBooking(data, createdBy = null) {
  const turf = await prisma.turf.findUnique({ where: { id: data.turf_id } });
  if (!turf) throw new Error(`Turf not found: ${data.turf_id}`);

  const startHour = Number(data.start_hour);
  const endHour = Number(data.end_hour || startHour + 1);

  const conflict = await checkSlotConflict(data.turf_id, data.date, startHour, endHour);
  if (conflict) throw new Error("Time slot already booked");

  const calculatedTotal = await calculatePrice(data.turf_id, data.date, startHour, endHour);
  const totalPrice = data.total_price !== undefined ? Number(data.total_price) : calculatedTotal;
  const paidAmount = Number(data.paid_amount || 0);
  const paymentStatus =
    data.payment_status ||
    (paidAmount >= totalPrice ? "paid" : paidAmount > 0 ? "partial" : "unpaid");

  const booking = await prisma.booking.create({
    data: {
      turf_id: data.turf_id,
      turf_name: turf.name,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email || null,
      date: data.date,
      start_hour: startHour,
      end_hour: endHour,
      duration_hours: data.duration_hours !== undefined ? Number(data.duration_hours) : (endHour - startHour),
      total_price: totalPrice,
      paid_amount: paidAmount,
      status: data.status || "confirmed",
      payment_status: paymentStatus,
      payment_method: data.payment_method || "bkash",
      txn_id: data.txn_id || null,
      notes: data.notes || null,
    },
  });

  if (["paid", "partial"].includes(paymentStatus) && paidAmount > 0) {
    const paymentRecordAmount = paymentStatus === "paid" && paidAmount === 0 ? totalPrice : paidAmount;
    await prisma.payment.create({
      data: {
        booking_id: booking.id,
        amount: paymentRecordAmount,
        status: "completed",
        method: data.payment_method || "bkash",
        transaction_id: data.txn_id || null,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
      },
    });
  }

  try {
    await postBookingCreated(booking, createdBy);
  } catch (err) {
    console.error("⚠️ Ledger posting failed for booking creation:", err.message);
  }

  return booking;
}

/**
 * Cancel a booking with ledger posting.
 * @param {string} bookingId
 * @param {string|null} createdBy
 * @returns {Promise<object>} updated booking
 */
export async function cancelBooking(bookingId, createdBy = null) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "cancelled") throw new Error("Booking already cancelled");

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "cancelled" },
  });

  try {
    if (booking.payment_status === "unpaid") {
      await postBookingCancelled(updated, createdBy);
    } else {
      await postBookingRefund(updated, createdBy);
    }
  } catch (err) {
    console.error("⚠️ Ledger posting failed for booking cancellation:", err.message);
  }

  return updated;
}

/**
 * Record a payment for an existing booking (installment or TrxID reconciliation).
 * @param {string} bookingId
 * @param {object} paymentData - { amount, method, transaction_id, customer_name, customer_phone }
 * @param {string|null} createdBy
 * @returns {Promise<{booking: object, payment: object}>}
 */
export async function recordBookingPayment(bookingId, paymentData, createdBy = null) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");

  const amount = Number(paymentData.amount || (booking.total_price - booking.paid_amount));
  const newPaid = Number(booking.paid_amount || 0) + amount;
  const newStatus = newPaid >= booking.total_price ? "paid" : "partial";

  const payment = await prisma.payment.create({
    data: {
      booking_id: booking.id,
      amount,
      status: "completed",
      method: paymentData.method || "bkash",
      transaction_id: paymentData.transaction_id || null,
      customer_name: paymentData.customer_name || booking.customer_name,
      customer_phone: paymentData.customer_phone || booking.customer_phone,
    },
  });

  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      paid_amount: newPaid,
      payment_status: newStatus,
      payment_method: paymentData.method || booking.payment_method,
      txn_id: paymentData.transaction_id || booking.txn_id,
    },
  });

  try {
    await postBookingInstallment(booking, amount, paymentData.method, createdBy);
  } catch (err) {
    console.error("⚠️ Ledger posting failed for booking installment:", err.message);
  }

  return { booking: updatedBooking, payment };
}
