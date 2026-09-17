import prisma from "../db/prismaClient.js";
import { sendWhatsAppMessage } from "../channels/whatsapp/index.js";
import config from "../config.js";

/**
 * Categorize start_hour into time-of-day period.
 */
function getTimePeriod(startHour) {
  if (startHour >= 6 && startHour < 12) return "morning";
  if (startHour >= 12 && startHour < 17) return "afternoon";
  if (startHour >= 17 && startHour < 21) return "evening";
  return "night";
}

/**
 * Synchronize and classify all customer profiles based on booking history.
 */
export async function syncCustomerProfiles() {
  try {
    const bookings = await prisma.booking.findMany({
      where: { status: { not: "cancelled" } },
      orderBy: { date: "asc" },
    });

    // Group bookings by customer phone
    const customerMap = new Map();

    for (const b of bookings) {
      if (!b.customer_phone) continue;
      const phone = b.customer_phone.trim();
      if (!customerMap.has(phone)) {
        customerMap.set(phone, {
          name: b.customer_name || "Guest",
          phone: phone,
          bookings: [],
        });
      }
      customerMap.get(phone).bookings.push(b);
      if (b.customer_name) {
        customerMap.get(phone).name = b.customer_name;
      }
    }

    let vipCount = 0;
    let regularCount = 0;
    let newCount = 0;
    let churnedCount = 0;
    const now = new Date();

    for (const [phone, data] of customerMap.entries()) {
      const userBookings = data.bookings;
      const totalBookings = userBookings.length;
      const totalSpent = userBookings.reduce((sum, b) => sum + (b.paid_amount || 0), 0);

      // Determine preferred turf
      const turfFreq = {};
      for (const b of userBookings) {
        if (b.turf_name) {
          turfFreq[b.turf_name] = (turfFreq[b.turf_name] || 0) + 1;
        }
      }
      const preferredTurf =
        Object.entries(turfFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      // Determine preferred time
      const timeFreq = {};
      for (const b of userBookings) {
        const period = getTimePeriod(b.start_hour);
        timeFreq[period] = (timeFreq[period] || 0) + 1;
      }
      const preferredTime =
        Object.entries(timeFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "evening";

      // Determine last visit
      const sortedDates = userBookings.map((b) => b.date).sort();
      const lastVisit = sortedDates[sortedDates.length - 1] || null;

      // Determine segmentation
      let daysSinceLastVisit = 0;
      if (lastVisit) {
        const lastDate = new Date(lastVisit);
        daysSinceLastVisit = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      let segment = "new";
      if (daysSinceLastVisit > 30 && totalBookings >= 2) {
        segment = "churned";
        churnedCount++;
      } else if (totalBookings >= 10 || totalSpent >= 25000) {
        segment = "vip";
        vipCount++;
      } else if (totalBookings >= 3) {
        segment = "regular";
        regularCount++;
      } else {
        segment = "new";
        newCount++;
      }

      await prisma.customerProfile.upsert({
        where: { phone_number: phone },
        update: {
          name: data.name,
          total_bookings: totalBookings,
          total_spent: totalSpent,
          preferred_turf: preferredTurf,
          preferred_time: preferredTime,
          segment,
          last_visit: lastVisit,
        },
        create: {
          phone_number: phone,
          name: data.name,
          total_bookings: totalBookings,
          total_spent: totalSpent,
          preferred_turf: preferredTurf,
          preferred_time: preferredTime,
          segment,
          last_visit: lastVisit,
        },
      });
    }

    console.log(
      `📊 Customer CRM Synced: ${customerMap.size} profiles (VIP: ${vipCount}, Regular: ${regularCount}, New: ${newCount}, Churned: ${churnedCount})`
    );

    return {
      syncedCount: customerMap.size,
      vipCount,
      regularCount,
      newCount,
      churnedCount,
    };
  } catch (err) {
    console.error("syncCustomerProfiles error:", err.message);
    return null;
  }
}

/**
 * Fetch or compute a customer profile by phone number.
 */
export async function getCustomerProfile(phoneNumber) {
  if (!phoneNumber) return null;
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, "");

  const profile = await prisma.customerProfile.findFirst({
    where: {
      OR: [{ phone_number: cleanPhone }, { phone_number: phoneNumber }],
    },
  });

  return profile;
}

/**
 * Run automated win-back WhatsApp campaign for churned customers.
 */
export async function runWinBackCampaign() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const churnedCustomers = await prisma.customerProfile.findMany({
      where: { segment: "churned" },
    });

    let contactedCount = 0;

    for (const customer of churnedCustomers) {
      // Avoid contacting more than once every 30 days
      const recentCampaign = await prisma.agentLog.findFirst({
        where: {
          phone_number: customer.phone_number,
          intent: "win_back_campaign",
          created_at: { gte: thirtyDaysAgo },
        },
      });

      if (recentCampaign) continue;

      const message =
        `⚽ *We Miss You On The Pitch! — ${config.businessName}*\n\n` +
        `Hello *${customer.name || "friend"}*! It's been over a month since your last match${customer.preferred_turf ? ` at *${customer.preferred_turf}*` : ""}.\n\n` +
        `Your teammates are waiting! To welcome you back, here is an exclusive *20% discount* on your next match:\n\n` +
        `🎟 *Voucher Code:* *COMEBACK20*\n\n` +
        `Simply reply right here to check available slots or book your game today! 🎯`;

      try {
        await sendWhatsAppMessage(customer.phone_number, message);
        contactedCount++;

        await prisma.agentLog.create({
          data: {
            phone_number: customer.phone_number,
            channel: "whatsapp",
            direction: "outbound",
            intent: "win_back_campaign",
            message: message,
            ai_response: "Sent COMEBACK20 discount voucher",
          },
        });
      } catch (err) {
        console.warn(`Could not send win-back message to ${customer.phone_number}:`, err.message);
      }
    }

    console.log(`🎯 Win-back campaign completed: ${contactedCount} of ${churnedCustomers.length} contacted.`);
    return { contactedCount, totalChurned: churnedCustomers.length };
  } catch (err) {
    console.error("runWinBackCampaign error:", err.message);
    return { contactedCount: 0, error: err.message };
  }
}
