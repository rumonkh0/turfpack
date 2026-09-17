import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../db/prismaClient.js";
import { addDocument } from "./vectorStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, "../knowledge");

export async function indexAll() {
  console.log("📚 Indexing knowledge base...");

  // 1. Index markdown files from knowledge/ directory
  if (fs.existsSync(KNOWLEDGE_DIR)) {
    const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf-8");
      // Split into sections by ## headers
      const sections = content.split(/^## /m).filter(Boolean);
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim();
        if (section.length > 20) {
          await addDocument(`kb_${file}_${i}`, section, { source: file });
        }
      }
    }
    console.log(`  ✅ Indexed ${files.length} knowledge files`);
  }

  // 2. Index turfs from database
  try {
    const turfs = await prisma.turf.findMany({ where: { status: "active" } });
    for (const turf of turfs) {
      const text = `Turf: ${turf.name}. Type: ${turf.type}. Size: ${turf.size || "N/A"}. Location: ${turf.location || "N/A"}. ${turf.description || ""}. Amenities: ${turf.amenities || "[]"}. Base price: ${turf.base_price} taka/hour. Peak price: ${turf.peak_price} taka/hour (${turf.peak_hours_start}:00 - ${turf.peak_hours_end}:00). Night price: ${turf.night_price} taka/hour (21:00+). Weekend multiplier: ${turf.weekend_multiplier}x. Hours: ${turf.opening_hour}:00 to ${turf.closing_hour}:00.`;
      await addDocument(`turf_${turf.id}`, text, { type: "turf", id: turf.id });
    }
    console.log(`  ✅ Indexed ${turfs.length} turfs`);
  } catch (err) {
    console.warn("  ⚠️ Could not index turfs:", err.message);
  }

  // 3. Index products
  try {
    const products = await prisma.product.findMany({ where: { status: "active" } });
    for (const p of products) {
      const text = `Product: ${p.name}. Category: ${p.category}. Price: ${p.price} taka. Stock: ${p.stock} ${p.unit}. ${p.description || ""}`;
      await addDocument(`product_${p.id}`, text, { type: "product", id: p.id });
    }
    console.log(`  ✅ Indexed ${products.length} products`);
  } catch (err) {
    console.warn("  ⚠️ Could not index products:", err.message);
  }

  // 4. Index active tournaments
  try {
    const tournaments = await prisma.tournament.findMany({
      where: { status: { in: ["upcoming", "ongoing"] } },
    });
    for (const t of tournaments) {
      let teamCount = 0;
      try {
        const teams = typeof t.teams === "string" ? JSON.parse(t.teams) : (t.teams || []);
        teamCount = teams.length;
      } catch (e) {
        teamCount = 0;
      }
      const text = `Tournament: ${t.name}. Turf: ${t.turf_name}. Dates: ${t.start_date} to ${t.end_date}. Format: ${t.format}. Entry fee: ${t.entry_fee} taka. Prize pool: ${t.prize_pool} taka. Max teams: ${t.max_teams}. Registered teams: ${teamCount}. Available slots: ${t.max_teams - teamCount}. Status: ${t.status}. ${t.description || ""}`;
      await addDocument(`tournament_${t.id}`, text, { type: "tournament", id: t.id });
    }
    console.log(`  ✅ Indexed ${tournaments.length} tournaments`);
  } catch (err) {
    console.warn("  ⚠️ Could not index tournaments:", err.message);
  }

  console.log("📚 Knowledge base indexing complete!");
}
