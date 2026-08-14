import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { setupTestDb, clearAll, createRecord } from "./setup.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

let db;
let reporting;
let ledger;

async function createPartner(name, email) {
  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync("test123", 4);
  await db.user.create({
    data: {
      id,
      full_name: name,
      email,
      password: hash,
      role: 'partner',
      status: 'active'
    }
  });
  return id;
}

async function createBooking(overrides = {}) {
  return await db.booking.create({ data: {
    turf_id: "turf-1",
    turf_name: "Test Turf",
    customer_name: "Customer",
    customer_phone: "01700000000",
    date: "2026-07-25",
    start_hour: 10,
    end_hour: 11,
    duration_hours: 1,
    
    total_price: 1000,
    
    
    
    payment_status: "paid",
    status: "confirmed",
    payment_method: "cash",
    payment_history: [],
    ...overrides,
  } });
}

async function createExpense(overrides = {}) {
  return await db.expense.create({ data: {
    category: "maintenance",
    amount: 500,
    date: "2026-07-25",
    payment_method: "cash",
    ...overrides,
  } });
}

beforeAll(async () => {
  db = await setupTestDb();
  reporting = await import("../services/reportingService.js");
  ledger = await import("../services/ledgerPostingService.js");
});

beforeEach(() => clearAll());

describe("ReportingService", () => {
  describe("resolvePeriod", () => {
    it("uses from/to when provided", async () => {
      const result = await reporting.resolvePeriod({ from: "2026-01-01", to: "2026-06-30" });
      expect(result.from).toBe("2026-01-01");
      expect(result.to).toBe("2026-06-30");
    });

    it("defaults to monthly", async () => {
      const result = await reporting.resolvePeriod({});
      expect(result.from).toMatch(/^\d{4}-\d{2}-01$/);
    });
  });

  describe("getProfitLoss", () => {
    it("returns zero when no entries exist", async () => {
      const pnl = await reporting.getProfitLoss({ from: "2026-07-01", to: "2026-07-31" });
      expect(pnl.revenue.total).toBe(0);
      expect(pnl.cogs.total).toBe(0);
      expect(pnl.expenses.total).toBe(0);
      expect(pnl.net_profit).toBe(0);
    });

    it("calculates revenue from bookings", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 2000, payment_method: "cash" });
      await ledger.postBookingCreated(booking, "admin");

      const pnl = await reporting.getProfitLoss({ from: "2026-07-01", to: "2026-07-31" });
      expect(pnl.revenue.total).toBe(200000); // 2000৳ in poisha
      expect(pnl.net_profit).toBe(200000);
    });

    it("calculates net_profit = revenue - cogs - expenses", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 5000, payment_method: "cash" });
      await ledger.postBookingCreated(booking, "admin");

      const order = await createRecord("orders", {
        customer_name: "Walk-in",
        created_at: new Date("2026-07-15").toISOString(),
        items: [],
        total_amount: 100,
        payment_method: "cash",
        payment_status: "paid",
      });
      await ledger.postOrderCreated(order, 40, "admin");

      const expense = await createRecord("expenses", {
        description: "Rent",
        amount: 1000,
        account_code: "6001",
        payment_method: "cash",
        entry_date: "2026-07-15",
      });
      await ledger.postExpense(expense, "admin");

      const pnl = await reporting.getProfitLoss({ from: "2026-07-01", to: "2026-07-31" });
      expect(pnl.revenue.total).toBe(510000); // 5000+100=5100৳
      expect(pnl.cogs.total).toBe(4000); // 40৳
      expect(pnl.expenses.total).toBe(100000); // 1000৳
      expect(pnl.net_profit).toBe(510000 - 4000 - 100000);
    });

    it("includes revenue breakdown by account", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 2000, payment_method: "cash" });
      await ledger.postBookingCreated(booking, "admin");

      const income = await createRecord("incomes", {
        description: "Sponsorship",
        amount: 500,
        account_code: "4099",
        payment_method: "cash",
        entry_date: "2026-07-20",
      });
      await ledger.postIncome(income, "admin");

      const pnl = await reporting.getProfitLoss({ from: "2026-07-01", to: "2026-07-31" });
      expect(pnl.revenue.breakdown).toHaveLength(2);
      const bookingRev = pnl.revenue.breakdown.find((r) => r.account_code === "4001");
      const miscRev = pnl.revenue.breakdown.find((r) => r.account_code === "4099");
      expect(bookingRev.amount).toBe(200000);
      expect(miscRev.amount).toBe(50000);
    });

    it("respects date range — excludes out-of-range entries", async () => {
      const booking1 = await createBooking({ payment_status: "paid", total_price: 1000, payment_method: "cash", date: "2026-07-15" });
      await ledger.postBookingCreated(booking1, "admin");

      const booking2 = await createBooking({ payment_status: "paid", total_price: 2000, payment_method: "cash", date: "2026-08-05" });
      await ledger.postBookingCreated(booking2, "admin");

      const pnl = await reporting.getProfitLoss({ from: "2026-07-01", to: "2026-07-31" });
      expect(pnl.revenue.total).toBe(100000); // only July booking
    });
  });

  describe("getCashPosition", () => {
    it("returns zero when no entries", async () => {
      const result = await reporting.getCashPosition({ as_of: "2026-07-31" });
      expect(result.total).toBe(0);
      expect(result.accounts).toHaveLength(0);
    });

    it("shows cash by payment method", async () => {
      const b1 = await createBooking({ payment_status: "paid", total_price: 2000, payment_method: "bkash" });
      await ledger.postBookingCreated(b1, "admin");

      const b2 = await createBooking({ payment_status: "paid", total_price: 1000, payment_method: "cash", start_hour: 14, end_hour: 15 });
      await ledger.postBookingCreated(b2, "admin");

      const result = await reporting.getCashPosition({ as_of: "2026-07-31" });
      expect(result.total).toBe(300000); // 3000৳ total

      const bkash = result.accounts.find((a) => a.code === "1001");
      const physical = result.accounts.find((a) => a.code === "1004");
      expect(bkash.balance).toBe(200000);
      expect(physical.balance).toBe(100000);
    });

    it("deducts expenses from cash", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 5000, payment_method: "cash" });
      await ledger.postBookingCreated(booking, "admin");

      const expense = await createRecord("expenses", {
        description: "Rent",
        amount: 2000,
        account_code: "6001",
        payment_method: "cash",
        entry_date: "2026-07-15",
      });
      await ledger.postExpense(expense, "admin");

      const result = await reporting.getCashPosition({ as_of: "2026-07-31" });
      expect(result.total).toBe(300000); // 5000-2000=3000৳
    });
  });

  describe("getReceivables", () => {
    it("shows zero receivable for paid bookings", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 2000, payment_method: "cash" });
      await ledger.postBookingCreated(booking, "admin");

      const result = await reporting.getReceivables({ as_of: "2026-07-31" });
      expect(result.total_outstanding).toBe(0);
    });

    it("shows correct receivable for unpaid bookings", async () => {
      const booking = await createBooking({ payment_status: "unpaid", total_price: 3000 });
      await ledger.postBookingCreated(booking, "admin");

      const result = await reporting.getReceivables({ as_of: "2026-07-31" });
      expect(result.total_outstanding).toBe(300000);
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].outstanding).toBe(300000);
    });

    it("shows partial receivable after installment", async () => {
      const booking = await createBooking({
        payment_status: "partial",
        total_price: 3000,
        paid_amount: 1000,
        payment_method: "nagad",
      });
      await ledger.postBookingCreated(booking, "admin");

      const installment = { amount: 500, date: "2026-07-26", method: "cash" };
      await ledger.postBookingInstallment(booking, installment, 1, "admin");

      const result = await reporting.getReceivables({ as_of: "2026-07-31" });
      expect(result.total_outstanding).toBe(150000); // 3000-1000-500=1500৳
    });
  });

  describe("getPartnerShares", () => {
    it("returns 'no partners' message when none exist", async () => {
      const result = await reporting.getPartnerShares(
        { from: "2026-07-01", to: "2026-07-31" },
        { _id: "admin-1", role: "admin" }
      );
      expect(result.message).toBe("No partners configured");
    });

    it("computes partner gross share from net profit", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 10000, payment_method: "cash" });
      await ledger.postBookingCreated(booking, "admin");

      const partnerId = await createPartner("Karim", "karim@test.com");
      const profitShare = await import("../services/profitShareService.js");
      await profitShare.assignInitialShare(partnerId);

      // Set effective_from to start of period
      await db.$executeRawUnsafe("UPDATE profit_share_ratios SET effective_from = '2026-07-01'");

      const result = await reporting.getPartnerShares(
        { from: "2026-07-01", to: "2026-07-31" },
        { _id: "admin-1", role: "admin" }
      );

      expect(result.shares).toHaveLength(1);
      expect(result.shares[0].effective_bp).toBe(10000);
      expect(result.shares[0].gross_share).toBe(1000000); // 100% of 10000৳
    });

    it("filters to own share when requesting user is partner", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 10000, payment_method: "cash", date: "2026-07-15" });
      await ledger.postBookingCreated(booking, "admin");

      const p1 = await createPartner("Karim", "karim@test.com");
      const p2 = await createPartner("Rahim", "rahim@test.com");
      const profitShare = await import("../services/profitShareService.js");
      await profitShare.assignInitialShare(p1);

      await profitShare.reallocateShares(
        [{ user_id: p1, share_bp: 6000 }, { user_id: p2, share_bp: 4000 }],
        "admin", "Split"
      );

      await db.profitShareRatio.deleteMany({ where: { version: 1 } });
      await db.profitShareRatio.updateMany({
        data: { effective_from: "2026-07-01" }
      });

      const result = await reporting.getPartnerShares(
        { from: "2026-07-01", to: "2026-07-31" },
        { id: p2, role: "partner" }
      );

      expect(result.shares).toHaveLength(1);
      expect(result.shares[0].user_id).toBe(p2);
    });
  });

  describe("getDashboard", () => {
    it("returns admin dashboard with cash and receivables", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 5000, payment_method: "cash" });
      await ledger.postBookingCreated(booking, "admin");

      const result = await reporting.getDashboard(
        { from: "2026-07-01", to: "2026-07-31" },
        { _id: "admin-1", role: "admin" }
      );

      expect(result.total_revenue).toBe(500000);
      expect(result.total_cash).toBeDefined();
      expect(result.total_receivables).toBeDefined();
      expect(result.partner_count).toBeDefined();
    });

    it("returns partner dashboard with my_share", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 5000, payment_method: "cash", date: "2026-07-15" });
      await ledger.postBookingCreated(booking, "admin");

      const partnerId = await createPartner("Karim", "karim@test.com");
      const profitShare = await import("../services/profitShareService.js");
      await profitShare.assignInitialShare(partnerId);

      await db.profitShareRatio.updateMany({ data: { effective_from: "2026-07-01" } });

      const result = await reporting.getDashboard(
        { from: "2026-07-01", to: "2026-07-31" },
        { id: partnerId, role: "partner" }
      );

      expect(result.my_share).toBeDefined();
      expect(result.my_share.effective_bp).toBe(10000);
      expect(result.total_cash).toBeUndefined(); // partner doesn't see cash position
    });
  });
});
