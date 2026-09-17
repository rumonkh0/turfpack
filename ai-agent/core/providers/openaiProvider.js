import OpenAI from "openai";
import config from "../../config.js";

function getClient() {
  if (!config.openai.apiKey) {
    throw new Error("OPENAI_API_KEY is not set in ai-agent/.env");
  }
  return new OpenAI({ apiKey: config.openai.apiKey });
}

export async function chat(messages, tools, systemPrompt) {
  const openai = getClient();
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const params = {
    model: "gpt-4o-mini",
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

  const response = await openai.chat.completions.create(params);
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

export async function embed(text) {
  const openai = getClient();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}
