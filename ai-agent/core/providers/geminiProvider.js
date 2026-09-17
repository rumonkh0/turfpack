import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../../config.js";

function getClient() {
  if (!config.gemini.apiKey) {
    throw new Error("GEMINI_API_KEY is not set in ai-agent/.env");
  }
  return new GoogleGenerativeAI(config.gemini.apiKey);
}

export async function chat(messages, tools, systemPrompt) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    tools: tools && tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content || "" }],
  }));

  const chatSession = model.startChat({ history });

  const lastMessage = messages[messages.length - 1];
  const result = await chatSession.sendMessage(lastMessage.content || "");
  const response = result.response;

  // Check for function calls
  const candidates = response.candidates || [];
  const parts = candidates[0]?.content?.parts || [];
  const functionCalls = parts
    .filter((p) => p.functionCall)
    .map((p) => ({
      name: p.functionCall.name,
      arguments: p.functionCall.args || {},
    }));

  if (functionCalls && functionCalls.length > 0) {
    return { type: "function_call", calls: functionCalls };
  }

  return { type: "text", content: response.text() };
}

export async function embed(text) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
