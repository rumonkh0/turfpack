import "dotenv/config";
import express from "express";
import config from "./config.js";
import { initWhatsApp } from "./channels/whatsapp/index.js";
import { initTelegram } from "./channels/telegram/adminBot.js";
import { indexAll } from "./rag/indexer.js";
import { startScheduler } from "./automation/scheduler.js";
import { processMessage } from "./core/brain.js";
import { generateDailyBriefing } from "./admin/dailyBriefing.js";

const app = express();
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "turfslot-ai-agent",
    uptime: Math.round(process.uptime()),
    aiProvider: config.aiProvider,
    whatsappMode: config.whatsappMode,
    timestamp: new Date().toISOString(),
  });
});

// Interactive query endpoint (for web client, admin dashboard, or test scripts)
app.post("/api/agent/query", async (req, res) => {
  const { message, phone, channel, provider } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, error: "Message is required" });
  }

  try {
    const reply = await processMessage(
      message,
      phone || "test_user",
      channel || "web",
      provider
    );
    res.json({ success: true, response: reply });
  } catch (err) {
    console.error("Agent query error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manual trigger for daily executive briefing
app.post("/api/agent/daily-briefing", async (req, res) => {
  try {
    const briefing = await generateDailyBriefing();
    res.json({ success: true, briefing });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manual trigger for RAG re-indexing
app.post("/api/agent/reindex", async (req, res) => {
  try {
    await indexAll();
    res.json({ success: true, message: "RAG knowledge base successfully re-indexed" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phase 3: Trigger payment reconciliation programmatically
app.post("/api/agent/reconcile-payment", async (req, res) => {
  const { phone, text, txnId, bookingId, amount, method } = req.body;
  try {
    const { reconcilePayment } = await import("./automation/paymentReconciler.js");
    const result = await reconcilePayment({ phone, text, txnId, bookingId, amount, method });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phase 3: Trigger CRM synchronization
app.post("/api/agent/crm-sync", async (req, res) => {
  try {
    const { syncCustomerProfiles } = await import("./automation/customerCRM.js");
    const result = await syncCustomerProfiles();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phase 3: Get customer profile by phone
app.get("/api/agent/crm-profile/:phone", async (req, res) => {
  try {
    const { getCustomerProfile } = await import("./automation/customerCRM.js");
    const profile = await getCustomerProfile(req.params.phone);
    if (!profile) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phase 3: Get inventory velocity and restock projections
app.get("/api/agent/inventory-velocity", async (req, res) => {
  try {
    const { calculateStockVelocity } = await import("./automation/inventoryMonitor.js");
    const velocity = await calculateStockVelocity(Number(req.query.days) || 14);
    res.json({ success: true, data: velocity });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phase 3: Trigger daily payment audit
app.post("/api/agent/payment-audit", async (req, res) => {
  try {
    const { dailyPaymentAudit } = await import("./automation/paymentReconciler.js");
    const audit = await dailyPaymentAudit();
    res.json({ success: true, audit });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Main startup sequence
async function start() {
  console.log("==========================================");
  console.log("🚀 TurfSlot AI CEO Agent Initializing...");
  console.log("==========================================");

  // 1. Index knowledge base
  try {
    await indexAll();
  } catch (err) {
    console.warn("⚠️ Knowledge base indexing notice:", err.message);
  }

  // 2. Initialize WhatsApp (official webhook or unofficial puppeteer client)
  try {
    await initWhatsApp(app);
  } catch (err) {
    console.warn("⚠️ WhatsApp initialization notice:", err.message);
  }

  // 3. Initialize Telegram admin bot
  try {
    initTelegram();
  } catch (err) {
    console.warn("⚠️ Telegram bot initialization notice:", err.message);
  }

  // 4. Start automation scheduler
  try {
    startScheduler();
  } catch (err) {
    console.warn("⚠️ Scheduler initialization notice:", err.message);
  }

  // 5. Start HTTP server
  app.listen(config.port, () => {
    console.log(`🤖 AI Agent running on port ${config.port}`);
    console.log(`   Configured AI Provider: ${config.aiProvider}`);
    console.log(`   Configured WhatsApp Mode: ${config.whatsappMode}`);
    console.log("==========================================");
  });
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
});
