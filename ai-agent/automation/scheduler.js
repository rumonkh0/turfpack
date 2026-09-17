import cron from "node-cron";
import { generateDailyBriefing } from "../admin/dailyBriefing.js";
import { checkLowStock, generateRestockReport } from "./inventoryMonitor.js";
import {
  sendBookingReminders,
  autoCancelUnpaid,
  sendPaymentNudges,
  sendUnpaidWarnings,
  sendPostMatchFeedback,
} from "./bookingLifecycle.js";
import { syncCustomerProfiles, runWinBackCampaign } from "./customerCRM.js";
import { dailyPaymentAudit } from "./paymentReconciler.js";
import { indexAll } from "../rag/indexer.js";
import config from "../config.js";

export function startScheduler() {
  const tz = config.timezone || "Asia/Dhaka";

  // 1. Daily executive briefing at 8:00 AM
  cron.schedule(
    "0 8 * * *",
    async () => {
      console.log("⏰ Running scheduled daily executive briefing...");
      await generateDailyBriefing();
    },
    { timezone: tz }
  );

  // 2. Customer CRM sync daily at 10:00 AM
  cron.schedule(
    "0 10 * * *",
    async () => {
      console.log("⏰ Running scheduled Customer CRM sync...");
      await syncCustomerProfiles();
    },
    { timezone: tz }
  );

  // 3. Weekly Churned Customer Win-Back Campaign (Thursdays at 4:00 PM)
  cron.schedule(
    "0 16 * * 4",
    async () => {
      console.log("⏰ Running scheduled Win-Back WhatsApp campaign...");
      await runWinBackCampaign();
    },
    { timezone: tz }
  );

  // 4. Weekly Inventory Velocity & Restock Report (Mondays at 9:00 AM)
  cron.schedule(
    "0 9 * * 1",
    async () => {
      console.log("⏰ Running scheduled Weekly Restock Report...");
      await generateRestockReport();
    },
    { timezone: tz }
  );

  // 5. Daily Payment Audit Report at 9:00 PM
  cron.schedule(
    "0 21 * * *",
    async () => {
      console.log("⏰ Running scheduled Daily Payment Audit...");
      await dailyPaymentAudit();
    },
    { timezone: tz }
  );

  // 6. Unpaid booking payment nudges every 10 minutes
  cron.schedule(
    "*/10 * * * *",
    async () => {
      await sendPaymentNudges();
    },
    { timezone: tz }
  );

  // 7. Booking match reminders every 30 minutes
  cron.schedule(
    "*/30 * * * *",
    async () => {
      await sendBookingReminders();
    },
    { timezone: tz }
  );

  // 8. Post-match feedback survey every 30 minutes
  cron.schedule(
    "15,45 * * * *",
    async () => {
      await sendPostMatchFeedback();
    },
    { timezone: tz }
  );

  // 9. Unpaid booking warnings every hour at :20
  cron.schedule(
    "20 * * * *",
    async () => {
      await sendUnpaidWarnings();
    },
    { timezone: tz }
  );

  // 10. Auto-cancel expired unpaid bookings every hour at :00
  cron.schedule(
    "0 * * * *",
    async () => {
      console.log("⏰ Checking for expired unpaid bookings...");
      await autoCancelUnpaid();
    },
    { timezone: tz }
  );

  // 11. Low stock monitor every 6 hours
  cron.schedule(
    "0 */6 * * *",
    async () => {
      console.log("⏰ Running scheduled inventory stock check...");
      await checkLowStock();
    },
    { timezone: tz }
  );

  // 12. Re-index RAG knowledge base every night at 3:00 AM
  cron.schedule(
    "0 3 * * *",
    async () => {
      console.log("⏰ Re-indexing knowledge base...");
      await indexAll();
    },
    { timezone: tz }
  );

  console.log(`⏰ Automation scheduler started with 12 active schedules (Timezone: ${tz})`);
}
