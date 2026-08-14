import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { setupTestDb, clearAll, createRecord } from "./setup.js";

let db;

beforeAll(async () => {
  db = await setupTestDb();
});

beforeEach(() => clearAll());

async function createBooking(overrides = {}) {
  return await createRecord("bookings", {
    turf_id: "turf-1",
    turf_name: "Test Turf",
    customer_name: "Test Customer",
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

async function getJournalLines(entryId) {
  return await db.journalLine.findMany({ where: { journal_entry_id: entryId } });
}

async function getAllJournalLines() {
  return await db.journalLine.findMany();
}

async function getAllJournalEntries() {
  return await db.journalEntry.findMany();
}

async function sumByAccount(code) {
  const result = await db.$queryRawUnsafe(
    "SELECT COALESCE(SUM(debit),0) as total_debit, COALESCE(SUM(credit),0) as total_credit FROM journal_lines WHERE account_code = ?",
    code
  );
  const row = result[0] || { total_debit: 0, total_credit: 0 };
  const debit = Number(row.total_debit);
  const credit = Number(row.total_credit);
  return { debit, credit, net: debit - credit };
}

describe("LedgerPostingService", () => {
  let ledger;

  beforeAll(async () => {
    ledger = await import("../services/ledgerPostingService.js");
  });

  describe("postBookingCreated", () => {
    it("posts balanced entry for unpaid booking (2 lines)", async () => {
      const booking = await createBooking({ payment_status: "unpaid", total_price: 2000 });
      const entryId = await ledger.postBookingCreated(booking, "admin-1");
      const lines = await getJournalLines(entryId);

      expect(lines).toHaveLength(2);
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBe(200000); // 2000 taka = 200000 poisha
    });

    it("posts balanced entry for fully paid booking (4 lines)", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 2000, payment_method: "bkash" });
      const entryId = await ledger.postBookingCreated(booking, "admin-1");
      const lines = await getJournalLines(entryId);

      expect(lines).toHaveLength(4);
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it("AR nets to zero for fully paid booking", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 2000, payment_method: "cash" });
      await ledger.postBookingCreated(booking, "admin-1");

      const ar = await sumByAccount("1100");
      expect(ar.net).toBe(0);
    });

    it("AR equals outstanding for partial booking", async () => {
      const booking = await createBooking({
        payment_status: "partial",
        total_price: 3000,
        paid_amount: 1000,
        payment_method: "nagad",
      });
      await ledger.postBookingCreated(booking, "admin-1");

      const ar = await sumByAccount("1100");
      expect(ar.net).toBe(200000); // 3000-1000 = 2000৳ = 200000 poisha
    });

    it("is idempotent — second call returns existing entry id", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 2000, payment_method: "cash" });
      const id1 = await ledger.postBookingCreated(booking, "admin-1");
      const id2 = await ledger.postBookingCreated(booking, "admin-1");
      expect(id1).toBe(id2);
      expect(await getAllJournalEntries()).toHaveLength(1);
    });
  });

  describe("postBookingInstallment", () => {
    it("posts balanced 2-line entry for installment", async () => {
      const booking = await createBooking({ payment_status: "partial", total_price: 3000, paid_amount: 1000, payment_method: "nagad" });
      await ledger.postBookingCreated(booking, "admin-1");

      const installment = { amount: 500, date: "2026-07-26", method: "cash" };
      const entryId = await ledger.postBookingInstallment(booking, installment, 1, "admin-1");
      const lines = await getJournalLines(entryId);

      expect(lines).toHaveLength(2);
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBe(50000);
    });

    it("reduces AR by installment amount", async () => {
      const booking = await createBooking({ payment_status: "partial", total_price: 3000, paid_amount: 1000, payment_method: "nagad" });
      await ledger.postBookingCreated(booking, "admin-1");

      const installment = { amount: 1000, date: "2026-07-26", method: "cash" };
      await ledger.postBookingInstallment(booking, installment, 1, "admin-1");

      const ar = await sumByAccount("1100");
      expect(ar.net).toBe(100000); // 3000 - 1000 - 1000 = 1000৳
    });
  });

  describe("postBookingCancelled", () => {
    it("posts balanced reversal for unpaid booking", async () => {
      const booking = await createBooking({ payment_status: "unpaid", total_price: 2000 });
      await ledger.postBookingCreated(booking, "admin-1");
      const entryId = await ledger.postBookingCancelled(booking, "admin-1");
      const lines = await getJournalLines(entryId);

      expect(lines).toHaveLength(2);
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it("zeroes out AR and revenue after cancel", async () => {
      const booking = await createBooking({ payment_status: "unpaid", total_price: 2000 });
      await ledger.postBookingCreated(booking, "admin-1");
      await ledger.postBookingCancelled(booking, "admin-1");

      const ar = await sumByAccount("1100");
      const revenue = await sumByAccount("4001");
      expect(ar.net).toBe(0);
      expect(revenue.net).toBe(0); // revenue has normal_side credit, so net = debit-credit; revenue credit => net is negative normally
    });
  });

  describe("postBookingRefund", () => {
    it("posts balanced refund for fully paid booking", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 2000, payment_method: "bkash" });
      await ledger.postBookingCreated(booking, "admin-1");
      const entryId = await ledger.postBookingRefund(booking, "admin-1");
      const lines = await getJournalLines(entryId);

      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it("net revenue is zero after full refund", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 2000, payment_method: "bkash" });
      await ledger.postBookingCreated(booking, "admin-1");
      await ledger.postBookingRefund(booking, "admin-1");

      const revenue = await sumByAccount("4001");
      expect(revenue.debit - revenue.credit).toBe(0);
    });

    it("handles partial-paid booking refund correctly", async () => {
      const booking = await createBooking({
        payment_status: "partial",
        total_price: 3000,
        paid_amount: 1000,
        payment_method: "nagad",
      });
      await ledger.postBookingCreated(booking, "admin-1");
      const entryId = await ledger.postBookingRefund(booking, "admin-1");
      const lines = await getJournalLines(entryId);

      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBe(300000); // full revenue reversal
    });
  });

  describe("postOrderCreated", () => {
    it("posts balanced entry with revenue + COGS (4 lines)", async () => {
      const order = await createRecord("orders", {
        customer_name: "Walk-in",
        items: [{ product_id: "p1", name: "Water", quantity: 2, price: 25 }],
        total_amount: 50,
        payment_method: "cash",
        payment_status: "paid",
      });
      const entryId = await ledger.postOrderCreated(order, 24, "admin-1");
      const lines = await getJournalLines(entryId);

      expect(lines).toHaveLength(4);
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it("posts 2 lines when cost is zero", async () => {
      const order = await createRecord("orders", {
        customer_name: "Walk-in",
        items: [],
        total_amount: 50,
        payment_method: "cash",
        payment_status: "paid",
      });
      const entryId = await ledger.postOrderCreated(order, 0, "admin-1");
      const lines = await getJournalLines(entryId);
      expect(lines).toHaveLength(2);
    });
  });

  describe("postOrderCancelled", () => {
    it("posts balanced reversal", async () => {
      const order = await createRecord("orders", {
        customer_name: "Walk-in",
        items: [{ product_id: "p1", name: "Water", quantity: 2, price: 25 }],
        total_amount: 50,
        payment_method: "cash",
        payment_status: "paid",
      });
      await ledger.postOrderCreated(order, 24, "admin-1");
      const entryId = await ledger.postOrderCancelled(order, 24, "admin-1");
      const lines = await getJournalLines(entryId);

      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it("nets revenue and COGS to zero after cancel", async () => {
      const order = await createRecord("orders", {
        customer_name: "Walk-in",
        items: [],
        total_amount: 100,
        payment_method: "cash",
        payment_status: "paid",
      });
      await ledger.postOrderCreated(order, 40, "admin-1");
      await ledger.postOrderCancelled(order, 40, "admin-1");

      const revenue = await sumByAccount("4002");
      const cogs = await sumByAccount("5001");
      expect(revenue.debit - revenue.credit).toBe(0);
      expect(cogs.debit - cogs.credit).toBe(0);
    });
  });

  describe("postExpense", () => {
    it("posts balanced 2-line entry", async () => {
      const expense = await createRecord("expenses", {
        description: "Electricity",
        amount: 5000,
        account_code: "6002",
        payment_method: "bkash",
        entry_date: "2026-07-25",
      });
      const entryId = await ledger.postExpense(expense, "admin-1");
      const lines = await getJournalLines(entryId);

      expect(lines).toHaveLength(2);
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBe(500000);
    });
  });

  describe("postExpenseReversal", () => {
    it("nets expense account to zero after reversal", async () => {
      const expense = await createRecord("expenses", {
        description: "Electricity",
        amount: 5000,
        account_code: "6002",
        payment_method: "cash",
        entry_date: "2026-07-25",
      });
      await ledger.postExpense(expense, "admin-1");
      await ledger.postExpenseReversal(expense, "admin-1");

      const utilities = await sumByAccount("6002");
      expect(utilities.net).toBe(0);
    });
  });

  describe("postIncome", () => {
    it("posts balanced 2-line entry", async () => {
      const income = await createRecord("incomes", {
        description: "Sponsorship",
        amount: 15000,
        account_code: "4099",
        payment_method: "bkash",
        entry_date: "2026-07-20",
      });
      const entryId = await ledger.postIncome(income, "admin-1");
      const lines = await getJournalLines(entryId);

      expect(lines).toHaveLength(2);
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
    });
  });

  describe("postIncomeReversal", () => {
    it("nets income account to zero after reversal", async () => {
      const income = await createRecord("incomes", {
        description: "Sponsorship",
        amount: 15000,
        account_code: "4099",
        payment_method: "cash",
        entry_date: "2026-07-20",
      });
      await ledger.postIncome(income, "admin-1");
      await ledger.postIncomeReversal(income, "admin-1");

      const misc = await sumByAccount("4099");
      expect(misc.net).toBe(0);
    });
  });

  describe("postPartnerPayout", () => {
    it("posts balanced 2-line entry", async () => {
      const partner = { full_name: "Karim" };
      const entryId = await ledger.postPartnerPayout("payout-1", partner, 50000, "bkash", "2026-07-25", "admin-1");
      const lines = await getJournalLines(entryId);

      expect(lines).toHaveLength(2);
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBe(5000000);
    });
  });

  describe("payment method mapping", () => {
    it("maps all known methods to the correct cash account", async () => {
      expect(await ledger.cashAccount("bkash")).toBe("1001");
      expect(await ledger.cashAccount("nagad")).toBe("1002");
      expect(await ledger.cashAccount("rocket")).toBe("1003");
      expect(await ledger.cashAccount("cash")).toBe("1004");
      expect(await ledger.cashAccount("card")).toBe("1005");
      expect(await ledger.cashAccount("other")).toBe("1006");
      expect(await ledger.cashAccount("unknown")).toBe("1006");
    });
  });

  describe("toPoisha conversion", () => {
    it("converts taka to poisha correctly", async () => {
      expect(await ledger.toPoisha(100)).toBe(10000);
      expect(await ledger.toPoisha(0.01)).toBe(1);
      expect(await ledger.toPoisha(0)).toBe(0);
      expect(await ledger.toPoisha(999.99)).toBe(99999);
    });

    it("rounds fractional poisha", async () => {
      expect(await ledger.toPoisha(10.005)).toBe(1001);
      expect(await ledger.toPoisha(10.004)).toBe(1000);
    });
  });

  describe("global balance invariant", () => {
    it("all journal lines across multiple events always balance", async () => {
      const booking = await createBooking({ payment_status: "paid", total_price: 2000, payment_method: "bkash" });
      await ledger.postBookingCreated(booking, "admin-1");

      const order = await createRecord("orders", {
        customer_name: "Walk-in",
        items: [],
        total_amount: 100,
        payment_method: "cash",
        payment_status: "paid",
      });
      await ledger.postOrderCreated(order, 40, "admin-1");

      const expense = await createRecord("expenses", {
        description: "Rent",
        amount: 25000,
        account_code: "6001",
        payment_method: "cash",
        entry_date: "2026-07-01",
      });
      await ledger.postExpense(expense, "admin-1");

      const allLines = await getAllJournalLines();
      const totalDebit = allLines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = allLines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
    });
  });

  
});
