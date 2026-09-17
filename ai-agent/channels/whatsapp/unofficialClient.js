import fs from "fs";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { processMessage } from "../../core/brain.js";

let client = null;

export function initUnofficial() {
  const chromePath = fs.existsSync("/usr/bin/google-chrome")
    ? "/usr/bin/google-chrome"
    : undefined;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
    puppeteer: {
      headless: true,
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  client.on("qr", (qr) => {
    console.log("\n📱 Scan this QR code with WhatsApp to connect AI CEO Agent:");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp Web client connected and ready!");
  });

  client.on("authenticated", () => {
    console.log("🔒 WhatsApp authenticated successfully.");
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ WhatsApp authentication failed:", msg);
  });

  client.on("message", async (msg) => {
    if (msg.from.endsWith("@g.us")) return; // ignore groups for direct customer conversations
    const phone = msg.from.replace("@c.us", "");
    console.log(`📩 [WhatsApp] ${phone}: ${msg.body}`);

    try {
      const reply = await processMessage(msg.body, phone, "whatsapp");
      await msg.reply(reply);
    } catch (err) {
      console.error("Error processing WhatsApp message:", err);
      await msg.reply("Sorry, something went wrong. Please try again.");
    }
  });

  client.initialize().catch((err) => {
    console.error("Failed to initialize WhatsApp Web client:", err.message);
  });

  return client;
}

export async function sendMessage(phone, text) {
  if (!client) throw new Error("WhatsApp unofficial client not initialized");
  const chatId = phone.includes("@c.us") ? phone : `${phone}@c.us`;
  await client.sendMessage(chatId, text);
}
