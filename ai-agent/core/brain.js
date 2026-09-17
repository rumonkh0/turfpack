import { chat } from "./providers/index.js";
import { toolDefinitions } from "./tools.js";
import { executeTool } from "./toolExecutor.js";
import { getSystemPrompt } from "./prompts.js";
import prisma from "../db/prismaClient.js";

const MAX_TOOL_ROUNDS = 5;

/**
 * Process a message through the AI brain.
 * @param {string} message - User's message
 * @param {string} phoneNumber - User's phone number or identifier
 * @param {string} channel - "whatsapp" | "telegram" | "web"
 * @param {string} [providerOverride] - Force a specific AI provider
 * @returns {Promise<string>} AI response text
 */
export async function processMessage(message, phoneNumber, channel = "whatsapp", providerOverride) {
  const startTime = Date.now();

  // Load or create session
  let session = await prisma.whatsAppSession.findUnique({
    where: { phone_number: phoneNumber },
  });

  if (!session) {
    session = await prisma.whatsAppSession.create({
      data: {
        phone_number: phoneNumber,
        state: "idle",
        context: JSON.stringify([]),
      },
    });
  }

  // Parse conversation history
  let history = [];
  try {
    history = JSON.parse(session.context || "[]").slice(-10);
  } catch (e) {
    history = [];
  }

  history.push({ role: "user", content: message });

  const systemPrompt = await getSystemPrompt(phoneNumber);
  let messages = [...history];
  let finalResponse = "";
  let toolsUsed = [];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await chat(messages, toolDefinitions, systemPrompt, providerOverride);

      if (result.type === "text") {
        finalResponse = result.content;
        break;
      }

      if (result.type === "function_call") {
        for (const call of result.calls) {
          toolsUsed.push(call.name);
          const toolResult = await executeTool(call.name, call.arguments);
          messages.push({
            role: "assistant",
            content: `[Executed tool ${call.name} with params ${JSON.stringify(call.arguments)}]`,
          });
          messages.push({
            role: "user",
            content: `[Tool Result for ${call.name}]: ${JSON.stringify(toolResult)}`,
          });
        }
      }
    }
  } catch (err) {
    console.error("AI Brain processing error:", err);
    finalResponse = `Hello! I received your message: "${message}". I am currently running in standby mode while my AI API keys are being configured. Please contact our support team or try again shortly!`;
  }

  if (!finalResponse) {
    finalResponse = "I have processed your request. Is there anything else I can assist you with?";
  }

  // Update session
  history.push({ role: "assistant", content: finalResponse });
  try {
    await prisma.whatsAppSession.update({
      where: { phone_number: phoneNumber },
      data: {
        context: JSON.stringify(history.slice(-20)),
        last_active: new Date(),
      },
    });
  } catch (e) {
    console.warn("Could not update WhatsAppSession:", e.message);
  }

  // Log interaction
  try {
    await prisma.agentLog.create({
      data: {
        phone_number: phoneNumber,
        channel,
        direction: "inbound",
        message,
        intent: toolsUsed[0] || "conversation",
        tools_used: JSON.stringify(toolsUsed),
        ai_response: finalResponse,
        latency_ms: Date.now() - startTime,
      },
    });
  } catch (e) {
    console.warn("Could not log agent interaction:", e.message);
  }

  return finalResponse;
}
