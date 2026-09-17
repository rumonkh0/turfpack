import { executeTool } from "../core/toolExecutor.js";
import { indexAll } from "../rag/indexer.js";
import { searchKnowledge } from "../rag/retriever.js";
import { getSystemPrompt } from "../core/prompts.js";
import prisma from "../db/prismaClient.js";

async function runTests() {
  console.log("🧪 Starting TurfSlot AI CEO Agent Verification Suite...\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      failed++;
    }
  }

  try {
    // 1. Database Connection & Turf List
    console.log("--- 1. Testing Database & Turf Listing ---");
    const turfs = await executeTool("get_turf_list", {});
    assert(Array.isArray(turfs) && turfs.length > 0, `get_turf_list returned ${turfs?.length || 0} active turfs`);
    const firstTurf = turfs[0];
    console.log(`   Sample Turf: ${firstTurf.name} (Base Price: ৳${firstTurf.base_price})`);

    // 2. Check Availability Tool
    console.log("\n--- 2. Testing Slot Availability & Pricing ---");
    const today = new Date().toISOString().slice(0, 10);
    const availability = await executeTool("check_availability", { date: today, turf_id: firstTurf.id });
    assert(availability && availability.slots && availability.slots.length > 0, `check_availability returned ${availability?.slots?.length || 0} slots`);

    const pricing = await executeTool("get_pricing", {
      turf_id: firstTurf.id,
      date: today,
      start_hour: 17,
      end_hour: 19,
    });
    assert(pricing && pricing.price > 0, `get_pricing returned ৳${pricing?.price} for 2 hours`);
    console.log(`   Pricing for 5 PM - 7 PM: ৳${pricing.price}`);

    // 3. Products Listing
    console.log("\n--- 3. Testing Products Inventory ---");
    const products = await executeTool("list_products", {});
    assert(Array.isArray(products) && products.length > 0, `list_products returned ${products.length} products`);
    console.log(`   Sample Product: ${products[0].name} (৳${products[0].price}, Stock: ${products[0].stock})`);

    // 4. Financial & Reporting Tools
    console.log("\n--- 4. Testing Reporting & Dashboard ---");
    const dash = await executeTool("get_dashboard", { period: "monthly" });
    assert(dash && dash.total_revenue !== undefined, `get_dashboard returned total_revenue: ৳${(dash?.total_revenue || 0) / 100}`);

    const pnl = await executeTool("get_profit_loss", { period: "monthly" });
    assert(pnl && pnl.net_profit !== undefined, `get_profit_loss returned net_profit: ৳${(pnl?.net_profit || 0) / 100}`);

    const receivables = await executeTool("get_receivables", {});
    assert(receivables && receivables.total_outstanding !== undefined, `get_receivables returned total_outstanding: ৳${(receivables?.total_outstanding || 0) / 100}`);

    // 5. RAG Indexing & Retrieval
    console.log("\n--- 5. Testing RAG Knowledge Base ---");
    await indexAll();
    
    const parkingQuery = await searchKnowledge("Do you have car parking?");
    assert(parkingQuery.length > 0, `searchKnowledge found ${parkingQuery.length} results for 'parking'`);
    console.log(`   Top Match: ${parkingQuery[0]?.text?.slice(0, 80)}...`);

    const rainQuery = await searchKnowledge("What is your rain and cancellation policy?");
    assert(rainQuery.length > 0, `searchKnowledge found ${rainQuery.length} results for 'rain policy'`);
    console.log(`   Top Match: ${rainQuery[0]?.text?.slice(0, 80)}...`);

    // 6. Prompts Generation
    console.log("\n--- 6. Testing Persona System Prompts ---");
    const customerPrompt = await getSystemPrompt("01700000000");
    assert(customerPrompt.includes("CUSTOMER"), "getSystemPrompt generated CUSTOMER persona prompt");

    const adminPrompt = await getSystemPrompt("8801XXXXXXXXX"); // configured in .env as admin
    assert(adminPrompt.includes("ADMIN") || adminPrompt.includes("CEO"), "getSystemPrompt generated ADMIN persona prompt");

    console.log("\n==========================================");
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
    console.log("==========================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("\n💥 Unhandled error in test suite:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
