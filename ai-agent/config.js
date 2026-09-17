import "dotenv/config";

export default {
  port: parseInt(process.env.AGENT_PORT || "5001"),
  aiProvider: process.env.AI_PROVIDER || "gemini",
  whatsappMode: process.env.WHATSAPP_MODE || "unofficial",
  businessName: process.env.BUSINESS_NAME || "TurfSlot Sports Complex",
  currency: process.env.CURRENCY || "৳",
  timezone: process.env.TIMEZONE || "Asia/Dhaka",
  adminPhones: (process.env.ADMIN_PHONE_NUMBERS || "").split(",").map((p) => p.trim()).filter(Boolean),
  telegramAdminChatIds: (process.env.TELEGRAM_ADMIN_CHAT_IDS || "").split(",").map((c) => c.trim()).filter(Boolean),
  gemini: { apiKey: process.env.GEMINI_API_KEY },
  openai: { apiKey: process.env.OPENAI_API_KEY },
  deepseek: { apiKey: process.env.DEEPSEEK_API_KEY },
  whatsapp: {
    official: {
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    },
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
};
