import { getDashboard } from "../../server/services/reportingService.js";
import prisma from "../db/prismaClient.js";
import { notifyAdmins } from "../channels/telegram/adminBot.js";
import { sendWhatsAppMessage } from "../channels/whatsapp/index.js";
import config from "../config.js";

export async function generateDailyBriefing() {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: config.timezone });
  
  // Yesterday in timezone
  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterday = yesterdayDate.toLocaleDateString("en-CA", { timeZone: config.timezone });

  try {
    // Yesterday's stats from reportingService
    const yesterdayDash = await getDashboard({ from: yesterday, to: yesterday }, { role: "admin" });
    
    // Today's schedule
    const todayBookings = await prisma.booking.findMany({
      where: { date: today, status: "confirmed" },
      orderBy: { start_hour: "asc" },
    });

    // Outstanding unpaid bookings
    const unpaid = await prisma.booking.findMany({
      where: { payment_status: "unpaid", status: "confirmed" },
    });
    const unpaidTotal = unpaid.reduce((s, b) => s + (b.total_price || 0) - (b.paid_amount || 0), 0);

    // Low stock
    const products = await prisma.product.findMany({ where: { status: "active" } });
    const lowStock = products.filter((p) => p.stock <= (p.low_stock_alert || 5));

    // Format money in taka (reporting service returns amounts in poisha, so / 100)
    const rev = ((yesterdayDash.total_revenue || 0) / 100).toLocaleString();
    const exp = ((yesterdayDash.total_expenses || 0) / 100).toLocaleString();
    const profit = ((yesterdayDash.net_profit || 0) / 100).toLocaleString();

    let msg = `🌅 *TurfSlot Executive Morning Briefing*\n📅 *${today}*\n\n`;
    msg += `📊 *Yesterday's Performance (${yesterday})*\n`;
    msg += `💰 Gross Revenue: ${config.currency}${rev}\n`;
    msg += `📉 Total Expenses: ${config.currency}${exp}\n`;
    msg += `📈 Net Profit: ${config.currency}${profit}\n`;
    msg += `🏟 Turf Bookings: ${yesterdayDash.booking_count || 0}\n`;
    msg += `🛒 Shop Orders: ${yesterdayDash.order_count || 0}\n\n`;

    msg += `🔮 *Today's Operations (${today})*\n`;
    msg += `📋 Scheduled Bookings: *${todayBookings.length}*\n`;

    if (unpaid.length > 0) {
      msg += `⚠️ *Receivables Attention:* ${unpaid.length} unpaid bookings totaling *${config.currency}${unpaidTotal.toLocaleString()}*\n`;
    }

    if (lowStock.length > 0) {
      msg += `\n📦 *Stock Alerts:* ${lowStock.length} items need reordering.\n`;
    }

    msg += `\nHave a productive and profitable day! 🚀`;

    // 1. Notify via Telegram
    await notifyAdmins(msg);

    // 2. Notify via WhatsApp to admin phones
    for (const phone of config.adminPhones) {
      try {
        await sendWhatsAppMessage(phone, msg);
      } catch (err) {
        console.warn(`WhatsApp daily briefing failed for admin ${phone}:`, err.message);
      }
    }

    return msg;
  } catch (err) {
    console.error("generateDailyBriefing error:", err.message);
    return null;
  }
}
