import cron from "node-cron";
import { generateDailyBriefing } from "../admin/dailyBriefing.js";
import { checkLowStock } from "./inventoryMonitor.js";
import { sendBookingReminders, autoCancelUnpaid } from "./bookingLifecycle.js";
import { indexAll } from "../rag/indexer.js";
import config from "../config.js";

export function startScheduler() {
  const tz = config.timezone || "Asia/Dhaka";

  // Daily executive briefing at 8:00 AM (configured timezone)
  cron.schedule(
    "0 8 * * *",
    async () => {
      console.log("⏰ Running scheduled daily briefing...");
      await generateDailyBriefing();
    },
    { timezone: tz }
  );

  // Check low stock every 6 hours
  cron.schedule(
    "0 */6 * * *",
    async () => {
      console.log("⏰ Running scheduled inventory stock check...");
      await checkLowStock();
    },
    { timezone: tz }
  );

  // Booking match reminders every 30 minutes
  cron.schedule(
    "*/30 * * * *",
    async () => {
      await sendBookingReminders();
    },
    { timezone: tz }
  );

  // Auto-cancel unpaid bookings every hour
  cron.schedule(
    "0 * * * *",
    async () => {
      console.log("⏰ Checking for expired unpaid bookings...");
      await autoCancelUnpaid();
    },
    { timezone: tz }
  );

  // Re-index RAG knowledge base every night at 3:00 AM
  cron.schedule(
    "0 3 * * *",
    async () => {
      console.log("⏰ Re-indexing knowledge base...");
      await indexAll();
    },
    { timezone: tz }
  );

  console.log(`⏰ Automation scheduler started (Timezone: ${tz})`);
}
