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
