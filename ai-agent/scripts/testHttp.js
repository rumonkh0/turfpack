import express from "express";
import config from "../config.js";
import { indexAll } from "../rag/indexer.js";
import { processMessage } from "../core/brain.js";

async function testHttpServer() {
  console.log("🌐 Testing HTTP Server Endpoints...");
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      service: "turfslot-ai-agent",
      aiProvider: config.aiProvider,
      whatsappMode: config.whatsappMode,
    });
  });

  app.post("/api/agent/query", async (req, res) => {
    const { message, phone, channel } = req.body;
    try {
      const reply = await processMessage(message, phone || "test_user", channel || "web");
      res.json({ success: true, response: reply });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  const server = app.listen(5099, async () => {
    console.log("   Temporary test server running on port 5099");

    try {
      // 1. Test /health
      const healthRes = await fetch("http://localhost:5099/health");
      const healthData = await healthRes.json();
      console.log("✅ [PASS] /health response:", healthData);

      // 2. Test /api/agent/query
      const queryRes = await fetch("http://localhost:5099/api/agent/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "What turfs do you have?",
          phone: "01711111111",
        }),
      });
      const queryData = await queryRes.json();
      console.log("✅ [PASS] /api/agent/query response received:", queryData.success ? "Success" : "Failed");
      console.log("   AI Reply snippet:", queryData.response?.slice(0, 100) + "...");
    } catch (err) {
      console.error("❌ HTTP Test Failed:", err);
    } finally {
      server.close(() => {
        console.log("   Temporary test server closed.");
        process.exit(0);
      });
    }
  });
}

testHttpServer();
