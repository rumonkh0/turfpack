import config from "../../config.js";
import * as gemini from "./geminiProvider.js";
import * as openai from "./openaiProvider.js";
import * as deepseek from "./deepseekProvider.js";

const providers = { gemini, openai, deepseek };

export function getProvider(name) {
  const selectedName = name || config.aiProvider || "gemini";
  const provider = providers[selectedName];
  if (!provider) {
    throw new Error(`Unknown AI provider: "${selectedName}". Supported providers: gemini, openai, deepseek`);
  }
  return provider;
}

export function chat(messages, tools, systemPrompt, providerName) {
  return getProvider(providerName).chat(messages, tools, systemPrompt);
}

export function embed(text, providerName) {
  return getProvider(providerName).embed(text);
}
