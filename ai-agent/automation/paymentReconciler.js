import prisma from "../db/prismaClient.js";
import { sendWhatsAppMessage } from "../channels/whatsapp/index.js";
import { notifyAdmins } from "../channels/telegram/adminBot.js";
import config from "../config.js";

function formatHour(h) {
  const hour = Math.floor(h);
  const min = h % 1 === 0.5 ? "30" : "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:${min} ${ampm}`;
}

/**
 * Extract transaction ID from a message string.
 * Supports bKash, Nagad, and generic transaction ID patterns.
 */
export function extractTrxId(text) {
  if (!text || typeof text !== "string") return null;

  // 1. Explicit labels: "TrxID: BLA7X8Y9Z0", "Txn ID: 9K8B7C6D5E"
  const labelMatch = text.match(/(?:trx\s*id|txnid|txn\s*id|trx|transaction\s*id)[\s:=#]+([a-zA-Z0-9]{8,12})/i);
  if (labelMatch) return labelMatch[1].toUpperCase();

  // 2. bKash standard 10-char alphanumeric uppercase code in word boundary (e.g., BLA7X8Y9Z0)
  const bkashMatch = text.match(/\b([A-Z0-9]{10})\b/);
  if (bkashMatch) {
    // Check that it's not all numbers (often phone number) and not all letters
    const val = bkashMatch[1];
    const hasNum = /[0-9]/.test(val);
    const hasLetter = /[A-Z]/.test(val);
    if (hasNum && hasLetter) {
      return val;
    }
  }

  // 3. Nagad 8-character alphanumeric code
  const nagadMatch = text.match(/\b([A-Z0-9]{8})\b/);
  if (nagadMatch) {
    const val = nagadMatch[1];
    if (/[0-9]/.test(val) && /[A-Z]/.test(val)) {
      return val;
    }
  }

  return null;
}

/**
 * Reconcile a customer payment via TrxID.
 * @param {object} params
 * @param {string} params.phone - Customer phone number
 * @param {string} [params.text] - Incoming message containing TrxID
 * @param {string} [params.txnId] - Directly specified TrxID
 * @param {string} [params.bookingId] - Specific booking ID (optional)
 * @param {number} [params.amount] - Payment amount (optional)
 * @param {string} [params.method] - 'bkash' | 'nagad' | 'rocket' | 'bank'
 * @param {boolean} [params.notify=true] - Whether to send customer WhatsApp & admin Telegram alerts
 */
export async function reconcilePayment({
  phone,
  text,
  txnId,
  bookingId,
  amount,
  method = "bkash",
  notify = true,
}) {
  const extractedTxn = txnId ? txnId.toUpperCase().trim() : extractTrxId(text);
  if (!extractedTxn) {
    return {
      success: false,
      reason: "NO_TRX_ID",
      message: "Could not find a valid transaction ID in the message.",
    };
  }

  // 1. Prevent duplicate usage of the same TrxID
  const existingPayment = await prisma.payment.findFirst({
    where: { transaction_id: extractedTxn },
  });
  if (existingPayment) {
    return {
      success: false,
      reason: "DUPLICATE_TRX_ID",
      txnId: extractedTxn,
      message: `Transaction ID ${extractedTxn} has already been recorded and processed.`,
    };
  }

  // 2. Find target booking
  let booking = null;
  if (bookingId) {
    booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  }

  if (!booking && phone) {
    // Look for pending unpaid or partial booking for this customer phone
    booking = await prisma.booking.findFirst({
      where: {
        customer_phone: phone,
        status: { not: "cancelled" },
        payment_status: { in: ["unpaid", "partial"] },
      },
      orderBy: { created_at: "desc" },
    });

    // Fallback: look for today's or upcoming booking
    if (!booking) {
      booking = await prisma.booking.findFirst({
        where: {
          customer_phone: phone,
          status: { not: "cancelled" },
        },
        orderBy: { created_at: "desc" },
      });
    }
  }

  if (!booking) {
    return {
      success: false,
      reason: "NO_BOOKING_FOUND",
      txnId: extractedTxn,
      message: `No active or unpaid booking found for phone ${phone}. Please specify your Booking ID.`,
    };
  }

  // 3. Calculate payment amounts
  const outstanding = booking.total_price - (booking.paid_amount || 0);
  const paymentAmount = Number(amount || (outstanding > 0 ? outstanding : booking.total_price));
  const newPaidAmount = (booking.paid_amount || 0) + paymentAmount;
  const newPaymentStatus = newPaidAmount >= booking.total_price ? "paid" : "partial";

  // 4. Create Payment record
  const payment = await prisma.payment.create({
    data: {
      booking_id: booking.id,
      amount: paymentAmount,
      status: "completed",
      method: method.toLowerCase(),
      transaction_id: extractedTxn,
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
    },
  });

  // 5. Update Booking record
  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      paid_amount: newPaidAmount,
      payment_status: newPaymentStatus,
      payment_method: method.toLowerCase(),
      txn_id: extractedTxn,
    },
  });

  // 6. Send confirmations if enabled
  if (notify) {
    const confirmationMsg =
      `✅ *Payment Received & Verified!*\n\n` +
      `Hello *${booking.customer_name}*, we have confirmed your payment of *${config.currency}${paymentAmount}*.\n\n` +
      `🏟 *Turf:* ${booking.turf_name}\n` +
      `📅 *Date:* ${booking.date}\n` +
      `⏰ *Time:* ${formatHour(booking.start_hour)} - ${formatHour(booking.end_hour)}\n` +
      `💳 *Method:* ${method.toUpperCase()}\n` +
      `🆔 *TrxID:* ${extractedTxn}\n` +
      `📌 *Status:* ${newPaymentStatus === "paid" ? "Fully Paid & Confirmed ✅" : `Partial Payment (${config.currency}${booking.total_price - newPaidAmount} due)`}\n\n` +
      `Thank you for choosing ${config.businessName}! See you on the field! ⚽`;

    try {
      await sendWhatsAppMessage(booking.customer_phone, confirmationMsg);
    } catch (err) {
      console.warn(`Could not send WhatsApp receipt to ${booking.customer_phone}:`, err.message);
    }

    const adminAlert =
      `💰 *Automatic Payment Reconciled*\n` +
      `Customer: *${booking.customer_name}* (${booking.customer_phone})\n` +
      `Turf: *${booking.turf_name}* (${booking.date} at ${formatHour(booking.start_hour)})\n` +
      `Amount: *${config.currency}${paymentAmount}* (${method.toUpperCase()})\n` +
      `TrxID: \`${extractedTxn}\`\n` +
      `Booking ID: \`${booking.id.slice(0, 8)}\``;

    await notifyAdmins(adminAlert);
  }

  return {
    success: true,
    txnId: extractedTxn,
    amount: paymentAmount,
    booking: updatedBooking,
    payment,
    message: `Payment of ${config.currency}${paymentAmount} verified for booking ${booking.id}.`,
  };
}

/**
 * Daily audit of payments vs bookings to detect discrepancies.
 */
export async function dailyPaymentAudit() {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: config.timezone });

  try {
    const todayBookings = await prisma.booking.findMany({
      where: { date: today, status: { not: "cancelled" } },
      include: { payments: true },
    });

    const unpaidBookings = todayBookings.filter((b) => b.payment_status === "unpaid");
    const partialBookings = todayBookings.filter((b) => b.payment_status === "partial");
    const totalCollected = todayBookings.reduce((sum, b) => sum + (b.paid_amount || 0), 0);
    const totalExpected = todayBookings.reduce((sum, b) => sum + b.total_price, 0);
    const totalOutstanding = totalExpected - totalCollected;

    let auditMsg =
      `📋 *Daily Payment Audit Report — ${today}*\n\n` +
      `• Total Bookings: ${todayBookings.length}\n` +
      `• Total Collected: ${config.currency}${totalCollected}\n` +
      `• Total Expected: ${config.currency}${totalExpected}\n` +
      `• Outstanding Receivables: ${config.currency}${totalOutstanding}\n`;

    if (unpaidBookings.length > 0) {
      auditMsg += `\n⚠️ *Unpaid Bookings (${unpaidBookings.length}):*\n`;
      for (const b of unpaidBookings) {
        auditMsg += `- ${b.customer_name} (${b.customer_phone}): ${config.currency}${b.total_price} at ${b.turf_name}\n`;
      }
    }

    if (partialBookings.length > 0) {
      auditMsg += `\n🟡 *Partial Payments (${partialBookings.length}):*\n`;
      for (const b of partialBookings) {
        auditMsg += `- ${b.customer_name}: Paid ${config.currency}${b.paid_amount} / ${config.currency}${b.total_price}\n`;
      }
    }

    await notifyAdmins(auditMsg);
    return {
      date: today,
      totalBookings: todayBookings.length,
      totalCollected,
      totalOutstanding,
      unpaidCount: unpaidBookings.length,
      partialCount: partialBookings.length,
    };
  } catch (err) {
    console.error("dailyPaymentAudit error:", err.message);
    return null;
  }
}
