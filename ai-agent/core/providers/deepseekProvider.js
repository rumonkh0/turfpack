import OpenAI from "openai";
import config from "../../config.js";
import { embed as geminiEmbed } from "./geminiProvider.js";
import { embed as openaiEmbed } from "./openaiProvider.js";

function getClient() {
  if (!config.deepseek.apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set in ai-agent/.env");
  }
  return new OpenAI({
    apiKey: config.deepseek.apiKey,
    baseURL: "https://api.deepseek.com",
  });
}

export async function chat(messages, tools, systemPrompt) {
  const deepseek = getClient();
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const params = {
    model: "deepseek-chat",
    messages: formattedMessages,
  };

  if (tools && tools.length > 0) {
    params.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  const response = await deepseek.chat.completions.create(params);
  const choice = response.choices[0];

  if (choice.finish_reason === "tool_calls" || choice.message.tool_calls) {
    return {
      type: "function_call",
      calls: choice.message.tool_calls.map((tc) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || "{}"),
      })),
    };
  }

  return { type: "text", content: choice.message.content };
}

// DeepSeek does not provide embedding endpoint — fallback to Gemini, then OpenAI
export async function embed(text) {
  if (config.gemini.apiKey) {
    return geminiEmbed(text);
  }
  if (config.openai.apiKey) {
    return openaiEmbed(text);
  }
  throw new Error("No embedding provider available (GEMINI_API_KEY or OPENAI_API_KEY required for embeddings)");
}
