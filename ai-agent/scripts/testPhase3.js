import prisma from "../db/prismaClient.js";
import { extractTrxId, reconcilePayment, dailyPaymentAudit } from "../automation/paymentReconciler.js";
import { syncCustomerProfiles, getCustomerProfile } from "../automation/customerCRM.js";
import { calculateStockVelocity, recordRestock } from "../automation/inventoryMonitor.js";
import { executeTool } from "../core/toolExecutor.js";

async function runPhase3Tests() {
  console.log("🧪 Starting TurfSlot Phase 3 Automation Suite Tests...\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // --- 1. Test TrxID Extraction Patterns ---
  console.log("--- 1. Testing bKash / Nagad TrxID Extraction ---");
  const t1 = extractTrxId("I paid via bkash, TrxID: BLA7X8Y9Z0 please check");
  assert(t1 === "BLA7X8Y9Z0", `Explicit label TrxID extraction (got: ${t1})`);

  const t2 = extractTrxId("Amar bkash txn id is 9K8B7C6D5E done");
  assert(t2 === "9K8B7C6D5E", `Word pattern TrxID extraction (got: ${t2})`);

  const t3 = extractTrxId("Taka pathaisi 8A7B6C5D");
  assert(t3 === "8A7B6C5D", `Nagad 8-char pattern extraction (got: ${t3})`);

  const t4 = extractTrxId("Hello can I book a slot for tomorrow?");
  assert(t4 === null, "Null return when no TrxID present");

  // --- 2. Test Payment Reconciliation & Duplicate Prevention ---
  console.log("\n--- 2. Testing Payment Reconciliation & Duplicate Prevention ---");
  const testPhone = "01899999999";
  const uniqueTxn = `TEST${Date.now().toString().slice(-6)}`;

  // Find an active turf for creating test booking
  const turf = await prisma.turf.findFirst({ where: { status: "active" } });
  let testBooking = null;

  try {
    testBooking = await prisma.booking.create({
      data: {
        turf_id: turf.id,
        turf_name: turf.name,
        customer_name: "Phase3 Test User",
        customer_phone: testPhone,
        date: "2026-10-01",
        start_hour: 10,
        end_hour: 11,
        duration_hours: 1,
        total_price: 1500,
        paid_amount: 0,
        payment_status: "unpaid",
        status: "confirmed",
      },
    });

    // Reconcile payment
    const reconResult = await reconcilePayment({
      phone: testPhone,
      text: `Paid via bKash TrxID: ${uniqueTxn}`,
      notify: false,
    });

    assert(reconResult.success === true, `Payment successfully reconciled for booking (ID: ${testBooking.id.slice(0, 8)})`);
    assert(reconResult.booking.payment_status === "paid", `Booking payment_status updated to 'paid' (got: ${reconResult.booking?.payment_status})`);
    assert(reconResult.booking.paid_amount === 1500, `Booking paid_amount matches total (got: ${reconResult.booking?.paid_amount})`);

    // Verify duplicate TrxID prevention
    const dupResult = await reconcilePayment({
      phone: testPhone,
      txnId: uniqueTxn,
      notify: false,
    });
    assert(dupResult.success === false && dupResult.reason === "DUPLICATE_TRX_ID", "Duplicate TrxID was correctly rejected");

  } finally {
    // Cleanup test data
    if (testBooking) {
      await prisma.payment.deleteMany({ where: { booking_id: testBooking.id } });
      await prisma.booking.delete({ where: { id: testBooking.id } });
    }
  }

  // --- 3. Test Customer CRM & Segmentation ---
  console.log("\n--- 3. Testing Customer CRM & Segmentation ---");
  const syncResult = await syncCustomerProfiles();
  assert(syncResult && syncResult.syncedCount >= 0, `CRM sync executed (${syncResult?.syncedCount} profiles processed)`);

  const sampleProfile = await prisma.customerProfile.findFirst();
  if (sampleProfile) {
    const fetched = await getCustomerProfile(sampleProfile.phone_number);
    assert(fetched && fetched.segment !== undefined, `Customer profile fetched: ${fetched.name} (Segment: ${fetched.segment}, Total Bookings: ${fetched.total_bookings})`);
  } else {
    console.log("ℹ️ No existing profiles to inspect; sync succeeded.");
  }

  // --- 4. Test Inventory Velocity & Run-Rate ---
  console.log("\n--- 4. Testing Inventory Velocity & Stock Run-Rate ---");
  const velocity = await calculateStockVelocity(14);
  assert(Array.isArray(velocity), `calculateStockVelocity returned ${velocity.length} products with run-rates`);
  if (velocity.length > 0) {
    const top = velocity[0];
    console.log(`   Sample: ${top.name} — Current: ${top.currentStock} ${top.unit}, Run-Rate: ${top.dailyRunRate}/day, Stockout: ${top.daysUntilStockout}`);
  }

  // Test restock recording
  const product = await prisma.product.findFirst({ where: { status: "active" } });
  if (product) {
    const originalStock = product.stock;
    const restockRes = await recordRestock({
      productId: product.id,
      quantity: 5,
      supplierNote: "Automated test restock",
    });
    assert(restockRes.stock === originalStock + 5, `recordRestock incremented stock by 5 (${originalStock} -> ${restockRes.stock})`);

    // Reset stock
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: originalStock },
    });
  }

  // --- 5. Test New AI Tools Execution ---
  console.log("\n--- 5. Testing Phase 3 AI Brain Tools via toolExecutor ---");
  const crmToolRes = await executeTool("get_customer_profile", { phone: "01711111111" });
  assert(crmToolRes !== undefined, "executeTool('get_customer_profile') ran without throwing");

  const payToolRes = await executeTool("verify_customer_payment", {
    phone: "01900000000",
    txn_id: "FAKETRX9999",
  });
  assert(payToolRes.success === false, `executeTool('verify_customer_payment') handled non-existent booking correctly: ${payToolRes.reason}`);

  console.log("\n==========================================");
  console.log(`📊 Phase 3 Test Results: ${passed} passed, ${failed} failed`);
  console.log("==========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
