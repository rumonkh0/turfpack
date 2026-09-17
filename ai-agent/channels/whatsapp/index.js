import config from "../../config.js";

let sendMessageFn = null;

export async function initWhatsApp(app) {
  if (config.whatsappMode === "official") {
    const { setupWebhookRoutes, sendMessage } = await import("./officialClient.js");
    setupWebhookRoutes(app);
    sendMessageFn = sendMessage;
    console.log("📱 WhatsApp: Official (Meta Cloud API) mode enabled");
  } else {
    const { initUnofficial, sendMessage } = await import("./unofficialClient.js");
    initUnofficial();
    sendMessageFn = sendMessage;
    console.log("📱 WhatsApp: Unofficial (whatsapp-web.js) mode enabled");
  }
}

export async function sendWhatsAppMessage(phone, text) {
  if (!sendMessageFn) {
    console.warn(`WhatsApp not initialized or sender not ready. Message to ${phone} not sent.`);
    return;
  }
  return sendMessageFn(phone, text);
}
