import { embed } from "../core/providers/index.js";

const documents = []; // { id, text, embedding, metadata }

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function keywordSimilarity(query, text) {
  const qTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (qTokens.length === 0) return 0;
  const target = text.toLowerCase();
  let matches = 0;
  for (const token of qTokens) {
    if (target.includes(token)) matches++;
  }
  return matches / qTokens.length;
}

export async function addDocument(id, text, metadata = {}) {
  let embedding = null;
  try {
    embedding = await embed(text);
  } catch (err) {
    // Fall back to keyword search if provider is offline or key missing
  }

  const existing = documents.findIndex((d) => d.id === id);
  const doc = { id, text, embedding, metadata };
  if (existing >= 0) {
    documents[existing] = doc;
  } else {
    documents.push(doc);
  }
}

export async function search(query, topK = 5) {
  let queryEmbedding = null;
  try {
    queryEmbedding = await embed(query);
  } catch (err) {
    // Embeddings unavailable, rely on keyword score
  }

  const scored = documents.map((doc) => {
    let score = 0;
    if (queryEmbedding && doc.embedding) {
      score = cosineSimilarity(queryEmbedding, doc.embedding);
    } else {
      score = keywordSimilarity(query, doc.text);
    }
    return { ...doc, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((d) => d.score > 0.15);
}

export function getDocumentCount() {
  return documents.length;
}
