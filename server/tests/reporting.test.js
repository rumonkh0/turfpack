import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { setupTestDb, clearAll } from "./setup.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

let db;
let reporting;
let ledger;

function createPartner(name, email) {
  const database = db.getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const hash = bcrypt.hashSync("test123", 4);
  database.prepare(
    "INSERT INTO users (id, full_name, email, password, role, status, created_at) VALUES (?, ?, ?, ?, 'partner', 'active', ?)"
  ).run(id, name, email, hash, now);
  return id;
}

function createBooking(overrides = {}) {
  return db.createRecord("bookings", {
    turf_id: "turf-1",
    turf_name: "Test Turf",
    customer_name: "Customer",
    customer_phone: "01700000000",
    date: "2026-07-25",
    start_hour: 10,
    end_hour: 11,
    duration_hours: 1,
    total_price: 2000,
    payment_status: "unpaid",
    ...overrides,
  });
}

beforeAll(async () => {
  db = await setupTestDb();
  reporting = await import("../services/reportingService.js");
  ledger = await import("../services/ledgerPostingService.js");
});

beforeEach(() => clearAll());

describe("ReportingService", () => {
  describe("resolvePeriod", () => {
    it("uses from/to when provided", () => {
      const result = reporting.resolvePeriod({ from: "2026-01-01", to: "2026-06-30" });
      expect(result.from).toBe("2026-01-01");
      expect(result.to).toBe("2026-06-30");
    });

    it("defaults to monthly", () => {
      const result = reporting.resolvePeriod({});
      expect(result.from).toMatch(/^\d{4}-\d{2}-01$/);
    });
  });

  describe("getProfitLoss", () => {
    it("returns zero when no entries exist", () => {
      const pnl = reporting.getProfitLoss({ from: "2026-07-01", to: "2026-07-31" });
      expect(pnl.revenue.total).toBe(0);
      expect(pnl.cogs.total).toBe(0);
      expect(pnl.expenses.total).toBe(0);
      expect(pnl.net_profit).toBe(0);
    });

    it("calculates revenue from bookings", () => {
      const booking = createBooking({ payment_status: "paid", total_price: 2000, payment_method: "cash" });
      ledger.postBookingCreated(booking, "admin");

      const pnl = reporting.getProfitLoss({ from: "2026-07-01", to: "2026-07-31" });
      expect(pnl.revenue.total).toBe(200000); // 2000৳ in poisha
      expect(pnl.net_profit).toBe(200000);
    });

    it("calculates net_profit = revenue - cogs - expenses", () => {
      const booking = createBooking({ payment_status: "paid", total_price: 5000, payment_method: "cash" });
      ledger.postBookingCreated(booking, "admin");

      const order = db.createRecord("orders", {
        customer_name: "Walk-in",
        items: [],
        total_amount: 100,
        payment_method: "cash",
        payment_status: "paid",
      });
      ledger.postOrderCreated(order, 40, "admin");

      const expense = db.createRecord("expenses", {
        description: "Rent",
        amount: 1000,
        account_code: "6001",
        payment_method: "cash",
        entry_date: "2026-07-15",
      });
      ledger.postExpense(expense, "admin");

      const pnl = reporting.getProfitLoss({ from: "2026-07-01", to: "2026-07-31" });
      expect(pnl.revenue.total).toBe(510000); // 5000+100=5100৳
      expect(pnl.cogs.total).toBe(4000); // 40৳
      expect(pnl.expenses.total).toBe(100000); // 1000৳
      expect(pnl.net_profit).toBe(510000 - 4000 - 100000);
    });

    it("includes revenue breakdown by account", () => {
      const booking = createBooking({ payment_status: "paid", total_price: 2000, payment_method: "cash" });
      ledger.postBookingCreated(booking, "admin");

      const income = db.createRecord("incomes", {
        description: "Sponsorship",
        amount: 500,
        account_code: "4099",
        payment_method: "cash",
        entry_date: "2026-07-20",
      });
      ledger.postIncome(income, "admin");

      const pnl = reporting.getProfitLoss({ from: "2026-07-01", to: "2026-07-31" });
      expect(pnl.revenue.breakdown).toHaveLength(2);
      const bookingRev = pnl.revenue.breakdown.find((r) => r.account_code === "4001");
      const miscRev = pnl.revenue.breakdown.find((r) => r.account_code === "4099");
      expect(bookingRev.amount).toBe(200000);
      expect(miscRev.amount).toBe(50000);
    });

    it("respects date range — excludes out-of-range entries", () => {
      const booking1 = createBooking({ payment_status: "paid", total_price: 1000, payment_method: "cash", date: "2026-07-15" });
      ledger.postBookingCreated(booking1, "admin");

      const booking2 = createBooking({ payment_status: "paid", total_price: 2000, payment_method: "cash", date: "2026-08-05" });
      ledger.postBookingCreated(booking2, "admin");

      const pnl = reporting.getProfitLoss({ from: "2026-07-01", to: "2026-07-31" });
      expect(pnl.revenue.total).toBe(100000); // only July booking
    });
  });

  describe("getCashPosition", () => {
    it("returns zero when no entries", () => {
      const result = reporting.getCashPosition({ as_of: "2026-07-31" });
      expect(result.total).toBe(0);
      expect(result.accounts).toHaveLength(0);
    });

    it("shows cash by payment method", () => {
      const b1 = createBooking({ payment_status: "paid", total_price: 2000, payment_method: "bkash" });
      ledger.postBookingCreated(b1, "admin");

      const b2 = createBooking({ payment_status: "paid", total_price: 1000, payment_method: "cash", start_hour: 14, end_hour: 15 });
      ledger.postBookingCreated(b2, "admin");

      const result = reporting.getCashPosition({ as_of: "2026-07-31" });
      expect(result.total).toBe(300000); // 3000৳ total

      const bkash = result.accounts.find((a) => a.code === "1001");
      const physical = result.accounts.find((a) => a.code === "1004");
      expect(bkash.balance).toBe(200000);
      expect(physical.balance).toBe(100000);
    });

    it("deducts expenses from cash", () => {
      const booking = createBooking({ payment_status: "paid", total_price: 5000, payment_method: "cash" });
      ledger.postBookingCreated(booking, "admin");

      const expense = db.createRecord("expenses", {
        description: "Rent",
        amount: 2000,
        account_code: "6001",
        payment_method: "cash",
        entry_date: "2026-07-15",
      });
      ledger.postExpense(expense, "admin");

      const result = reporting.getCashPosition({ as_of: "2026-07-31" });
      expect(result.total).toBe(300000); // 5000-2000=3000৳
    });
  });

  describe("getReceivables", () => {
    it("shows zero receivable for paid bookings", () => {
      const booking = createBooking({ payment_status: "paid", total_price: 2000, payment_method: "cash" });
      ledger.postBookingCreated(booking, "admin");

      const result = reporting.getReceivables({ as_of: "2026-07-31" });
      expect(result.total_outstanding).toBe(0);
    });

    it("shows correct receivable for unpaid bookings", () => {
      const booking = createBooking({ payment_status: "unpaid", total_price: 3000 });
      ledger.postBookingCreated(booking, "admin");

      const result = reporting.getReceivables({ as_of: "2026-07-31" });
      expect(result.total_outstanding).toBe(300000);
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].outstanding).toBe(300000);
    });

    it("shows partial receivable after installment", () => {
      const booking = createBooking({
        payment_status: "partial",
        total_price: 3000,
        paid_amount: 1000,
        payment_method: "nagad",
      });
      ledger.postBookingCreated(booking, "admin");

      const installment = { amount: 500, date: "2026-07-26", method: "cash" };
      ledger.postBookingInstallment(booking, installment, 1, "admin");

      const result = reporting.getReceivables({ as_of: "2026-07-31" });
      expect(result.total_outstanding).toBe(150000); // 3000-1000-500=1500৳
    });
  });

  describe("getPartnerShares", () => {
    it("returns 'no partners' message when none exist", () => {
      const result = reporting.getPartnerShares(
        { from: "2026-07-01", to: "2026-07-31" },
        { _id: "admin-1", role: "admin" }
      );
      expect(result.message).toBe("No partners configured");
    });

    it("computes partner gross share from net profit", async () => {
      const booking = createBooking({ payment_status: "paid", total_price: 10000, payment_method: "cash" });
      ledger.postBookingCreated(booking, "admin");

      const partnerId = createPartner("Karim", "karim@test.com");
      const profitShare = await import("../services/profitShareService.js");
      profitShare.assignInitialShare(partnerId);

      // Set effective_from to start of period
      const database = db.getDatabase();
      database.prepare("UPDATE profit_share_ratios SET effective_from = '2026-07-01'").run();

      const result = reporting.getPartnerShares(
        { from: "2026-07-01", to: "2026-07-31" },
        { _id: "admin-1", role: "admin" }
      );

      expect(result.shares).toHaveLength(1);
      expect(result.shares[0].effective_bp).toBe(10000);
      expect(result.shares[0].gross_share).toBe(1000000); // 100% of 10000৳
    });

    it("filters to own share when requesting user is partner", async () => {
      const booking = createBooking({ payment_status: "paid", total_price: 10000, payment_method: "cash" });
      ledger.postBookingCreated(booking, "admin");

      const p1 = createPartner("Karim", "karim@test.com");
      const p2 = createPartner("Rahim", "rahim@test.com");

      const profitShare = await import("../services/profitShareService.js");
      profitShare.assignInitialShare(p1);

      const database = db.getDatabase();
      database.prepare("UPDATE profit_share_ratios SET effective_from = '2026-07-01'").run();

      profitShare.reallocateShares(
        [{ user_id: p1, share_bp: 6000 }, { user_id: p2, share_bp: 4000 }],
        "admin", "Split"
      );

      // Fix effective_from for the new version
      database.prepare("UPDATE profit_share_ratios SET effective_from = '2026-07-01' WHERE version = 2").run();

      const result = reporting.getPartnerShares(
        { from: "2026-07-01", to: "2026-07-31" },
        { _id: p2, role: "partner" }
      );

      expect(result.shares).toHaveLength(1);
      expect(result.shares[0].user_id).toBe(p2);
    });
  });

  describe("getDashboard", () => {
    it("returns admin dashboard with cash and receivables", () => {
      const booking = createBooking({ payment_status: "paid", total_price: 5000, payment_method: "cash" });
      ledger.postBookingCreated(booking, "admin");

      const result = reporting.getDashboard(
        { from: "2026-07-01", to: "2026-07-31" },
        { _id: "admin-1", role: "admin" }
      );

      expect(result.total_revenue).toBe(500000);
      expect(result.total_cash).toBeDefined();
      expect(result.total_receivables).toBeDefined();
      expect(result.partner_count).toBeDefined();
    });

    it("returns partner dashboard with my_share", async () => {
      const booking = createBooking({ payment_status: "paid", total_price: 5000, payment_method: "cash" });
      ledger.postBookingCreated(booking, "admin");

      const partnerId = createPartner("Karim", "karim@test.com");
      const profitShare = await import("../services/profitShareService.js");
      profitShare.assignInitialShare(partnerId);

      const database = db.getDatabase();
      database.prepare("UPDATE profit_share_ratios SET effective_from = '2026-07-01'").run();

      const result = reporting.getDashboard(
        { from: "2026-07-01", to: "2026-07-31" },
        { _id: partnerId, role: "partner" }
      );

      expect(result.my_share).toBeDefined();
      expect(result.my_share.effective_bp).toBe(10000);
      expect(result.total_cash).toBeUndefined(); // partner doesn't see cash position
    });
  });
});
