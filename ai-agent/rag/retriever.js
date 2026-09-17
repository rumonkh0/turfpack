import { search } from "./vectorStore.js";

export async function searchKnowledge(query) {
  const results = await search(query, 5);
  return results.map((r) => ({
    text: r.text,
    source: r.metadata.source || r.metadata.type || "unknown",
    relevance: Math.round(r.score * 100) + "%",
  }));
}
