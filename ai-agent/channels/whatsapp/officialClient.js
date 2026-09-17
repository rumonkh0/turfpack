import config from "../../config.js";
import { processMessage } from "../../core/brain.js";

const { accessToken, phoneNumberId } = config.whatsapp.official;
const GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Send a text message via Meta Cloud API
 */
export async function sendMessage(phone, text) {
  if (!accessToken || !phoneNumberId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required for official WhatsApp mode");
  }

  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const url = `${GRAPH_API}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error("Meta WhatsApp API error:", err);
    throw new Error(`WhatsApp send failed: ${JSON.stringify(err)}`);
  }
  return await response.json();
}

/**
 * Handle incoming webhook from Meta Cloud API
 */
export async function handleWebhook(body) {
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages) return;

  for (const message of value.messages) {
    if (message.type !== "text") continue; // process text messages
    const phone = message.from;
    const text = message.text.body;

    console.log(`📩 [WhatsApp Official] ${phone}: ${text}`);

    try {
      const reply = await processMessage(text, phone, "whatsapp");
      await sendMessage(phone, reply);
    } catch (err) {
      console.error("Error processing Meta WhatsApp message:", err);
      try {
        await sendMessage(phone, "Sorry, something went wrong. Please try again.");
      } catch (e) {
        // ignore send error
      }
    }
  }
}

/**
 * Express routes for Meta Cloud API webhook
 */
export function setupWebhookRoutes(app) {
  // Verification challenge
  app.get("/webhook/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === config.whatsapp.official.verifyToken) {
      console.log("✅ Meta WhatsApp webhook verified successfully");
      return res.status(200).send(challenge);
    }
    console.warn("⚠️ Meta WhatsApp webhook verification failed");
    res.sendStatus(403);
  });

  // Incoming messages
  app.post("/webhook/whatsapp", async (req, res) => {
    res.sendStatus(200); // Acknowledge receipt within 3s as required by Meta
    try {
      await handleWebhook(req.body);
    } catch (err) {
      console.error("Webhook processing error:", err);
    }
  });
}
