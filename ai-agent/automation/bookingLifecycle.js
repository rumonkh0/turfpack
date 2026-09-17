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
 * 2-hour pre-match reminder.
 */
export async function sendBookingReminders() {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: config.timezone });

  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const hourObj = tzParts.find((p) => p.type === "hour");
  const currentHour = parseInt(hourObj ? hourObj.value : "0", 10);
  const targetHour = currentHour + 2;

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        date: today,
        start_hour: { gte: targetHour, lt: targetHour + 1 },
        status: "confirmed",
      },
    });

    for (const booking of bookings) {
      // Check if already sent
      const alreadySent = await prisma.agentLog.findFirst({
        where: {
          phone_number: booking.customer_phone,
          intent: "pre_match_reminder",
          created_at: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        },
      });
      if (alreadySent) continue;

      const timeStr = formatHour(booking.start_hour);
      const endTimeStr = formatHour(booking.end_hour);
      const msg = `⚽ *Match Reminder — ${config.businessName}*\n\nHello *${booking.customer_name}*! Your slot is coming up in about 2 hours:\n\n🏟 *Turf:* ${booking.turf_name || "Arena"}\n⏰ *Time:* ${timeStr} - ${endTimeStr}\n📅 *Date:* Today (${booking.date})\n\nPlease arrive 10 minutes early with your team. Have a great game! 🎯`;

      try {
        await sendWhatsAppMessage(booking.customer_phone, msg);
        await prisma.agentLog.create({
          data: {
            phone_number: booking.customer_phone,
            channel: "whatsapp",
            direction: "outbound",
            intent: "pre_match_reminder",
            message: msg,
          },
        });
      } catch (err) {
        console.warn(`Reminder WhatsApp send failed for ${booking.customer_phone}:`, err.message);
      }
    }
  } catch (err) {
    console.error("sendBookingReminders error:", err.message);
  }
}

/**
 * 5-minute payment nudge for recently created unpaid bookings.
 */
export async function sendPaymentNudges() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  try {
    const recentUnpaid = await prisma.booking.findMany({
      where: {
        payment_status: "unpaid",
        status: "confirmed",
        created_at: { gte: thirtyMinAgo, lte: fiveMinAgo },
      },
    });

    for (const booking of recentUnpaid) {
      const alreadyNudged = await prisma.agentLog.findFirst({
        where: {
          phone_number: booking.customer_phone,
          intent: "payment_nudge",
          created_at: { gte: thirtyMinAgo },
        },
      });
      if (alreadyNudged) continue;

      const msg =
        `💳 *Booking Reserved — Payment Instructions*\n\n` +
        `Hello *${booking.customer_name}*! Your slot is reserved:\n\n` +
        `🏟 *Turf:* ${booking.turf_name}\n` +
        `📅 *Date:* ${booking.date} (${formatHour(booking.start_hour)} - ${formatHour(booking.end_hour)})\n` +
        `💰 *Amount Due:* ${config.currency}${booking.total_price}\n\n` +
        `To confirm your reservation, please send payment via *bKash / Nagad* to *017XXXXXXXX* and *reply with your Transaction ID (TrxID)* here.\n\n` +
        `We'll instantly verify your slot once the TrxID is received! 🎯`;

      try {
        await sendWhatsAppMessage(booking.customer_phone, msg);
        await prisma.agentLog.create({
          data: {
            phone_number: booking.customer_phone,
            channel: "whatsapp",
            direction: "outbound",
            intent: "payment_nudge",
            message: msg,
          },
        });
      } catch (err) {
        console.warn(`Payment nudge failed for ${booking.customer_phone}:`, err.message);
      }
    }
  } catch (err) {
    console.error("sendPaymentNudges error:", err.message);
  }
}

/**
 * 2-hour warning for unpaid reservations before automatic cancellation.
 */
export async function sendUnpaidWarnings() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

  try {
    const atRiskBookings = await prisma.booking.findMany({
      where: {
        payment_status: "unpaid",
        status: "confirmed",
        created_at: { gte: fourHoursAgo, lte: twoHoursAgo },
      },
    });

    for (const booking of atRiskBookings) {
      const alreadyWarned = await prisma.agentLog.findFirst({
        where: {
          phone_number: booking.customer_phone,
          intent: "unpaid_warning",
          created_at: { gte: fourHoursAgo },
        },
      });
      if (alreadyWarned) continue;

      const msg =
        `⚠️ *Payment Expiry Warning — ${config.businessName}*\n\n` +
        `Hello *${booking.customer_name}*, your booking at *${booking.turf_name}* on ${booking.date} (${formatHour(booking.start_hour)} - ${formatHour(booking.end_hour)}) is still *unpaid*.\n\n` +
        `⏳ *Please pay within 4 hours*, or the slot will be automatically released to other awaiting players.\n\n` +
        `Amount: *${config.currency}${booking.total_price}*\n` +
        `Reply directly with your *TrxID* to confirm!`;

      try {
        await sendWhatsAppMessage(booking.customer_phone, msg);
        await prisma.agentLog.create({
          data: {
            phone_number: booking.customer_phone,
            channel: "whatsapp",
            direction: "outbound",
            intent: "unpaid_warning",
            message: msg,
          },
        });
      } catch (err) {
        console.warn(`Unpaid warning failed for ${booking.customer_phone}:`, err.message);
      }
    }
  } catch (err) {
    console.error("sendUnpaidWarnings error:", err.message);
  }
}

/**
 * Post-match feedback survey 30 minutes after completion.
 */
export async function sendPostMatchFeedback() {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: config.timezone });

  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const hourObj = tzParts.find((p) => p.type === "hour");
  const currentHour = parseInt(hourObj ? hourObj.value : "0", 10);
  const finishedHour = currentHour - 1; // Finished an hour ago

  if (finishedHour < 6) return;

  try {
    const finishedBookings = await prisma.booking.findMany({
      where: {
        date: today,
        end_hour: finishedHour,
        status: "confirmed",
      },
    });

    for (const booking of finishedBookings) {
      const alreadySent = await prisma.agentLog.findFirst({
        where: {
          phone_number: booking.customer_phone,
          intent: "post_match_feedback",
          created_at: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
        },
      });
      if (alreadySent) continue;

      const msg =
        `⚽ *Thanks for Playing with Us Today! — ${config.businessName}*\n\n` +
        `Hello *${booking.customer_name}*, we hope you and your team had a fantastic match at *${booking.turf_name}*!\n\n` +
        `⭐ *How was your experience today?*\n` +
        `Reply with a rating from *1 to 5* or share any thoughts on pitch quality, lighting, or amenities.\n\n` +
        `🎁 Here is an exclusive voucher for *10% off* your next game: *PLAYAGAIN10*\n` +
        `See you back on the turf soon! 🎯`;

      try {
        await sendWhatsAppMessage(booking.customer_phone, msg);
        await prisma.agentLog.create({
          data: {
            phone_number: booking.customer_phone,
            channel: "whatsapp",
            direction: "outbound",
            intent: "post_match_feedback",
            message: msg,
          },
        });
      } catch (err) {
        console.warn(`Post-match feedback failed for ${booking.customer_phone}:`, err.message);
      }
    }
  } catch (err) {
    console.error("sendPostMatchFeedback error:", err.message);
  }
}

/**
 * Auto-cancel bookings unpaid after 6 hours.
 */
export async function autoCancelUnpaid() {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  try {
    const unpaid = await prisma.booking.findMany({
      where: {
        payment_status: "unpaid",
        status: "confirmed",
        created_at: { lt: sixHoursAgo },
      },
    });

    for (const booking of unpaid) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "cancelled",
          notes: (booking.notes ? booking.notes + " | " : "") + "Auto-cancelled: unpaid after 6 hours",
        },
      });

      try {
        await sendWhatsAppMessage(
          booking.customer_phone,
          `❌ Hello *${booking.customer_name}*, your booking at *${booking.turf_name}* on ${booking.date} (${formatHour(booking.start_hour)} - ${formatHour(booking.end_hour)}) has been cancelled due to no payment received within 6 hours.\n\nYou are welcome to book another slot whenever you're ready!`
        );
      } catch (err) {
        // ignore
      }

      await notifyAdmins(
        `🔴 *Auto-Cancelled Unpaid Booking*\nCustomer: ${booking.customer_name}\nPhone: ${booking.customer_phone}\nTurf: ${booking.turf_name}\nDate: ${booking.date} (${formatHour(booking.start_hour)} - ${formatHour(booking.end_hour)})\nAmount: ${config.currency}${booking.total_price}`
      );
    }
  } catch (err) {
    console.error("autoCancelUnpaid error:", err.message);
  }
}
