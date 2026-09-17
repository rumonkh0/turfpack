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

export async function sendBookingReminders() {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: config.timezone });
  
  // Current hour in configured timezone
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
      const timeStr = formatHour(booking.start_hour);
      const endTimeStr = formatHour(booking.end_hour);
      const msg = `⚽ *Match Reminder — ${config.businessName}*\n\nHello *${booking.customer_name}*! Your slot is coming up in about 2 hours:\n\n🏟 *Turf:* ${booking.turf_name || "Arena"}\n⏰ *Time:* ${timeStr} - ${endTimeStr}\n📅 *Date:* Today (${booking.date})\n\nPlease arrive 10 minutes early with your team. Have a great game! 🎯`;
      
      try {
        await sendWhatsAppMessage(booking.customer_phone, msg);
      } catch (err) {
        console.warn(`Reminder WhatsApp send failed for ${booking.customer_phone}:`, err.message);
      }
    }
  } catch (err) {
    console.error("sendBookingReminders error:", err.message);
  }
}

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
