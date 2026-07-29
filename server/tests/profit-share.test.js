import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { setupTestDb, clearAll } from "./setup.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

let db;
let profitShare;

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

beforeAll(async () => {
  db = await setupTestDb();
  profitShare = await import("../services/profitShareService.js");
});

beforeEach(() => clearAll());

describe("ProfitShareService", () => {
  describe("assignInitialShare", () => {
    it("assigns 10000bp to the first partner", () => {
      const partnerId = createPartner("Karim", "karim@test.com");
      const result = profitShare.assignInitialShare(partnerId);

      expect(result.version).toBe(1);
      expect(result.shares).toHaveLength(1);
      expect(result.shares[0].share_bp).toBe(10000);
    });

    it("rejects second call if partners already exist", () => {
      const p1 = createPartner("Karim", "karim@test.com");
      profitShare.assignInitialShare(p1);

      const p2 = createPartner("Rahim", "rahim@test.com");
      expect(() => profitShare.assignInitialShare(p2)).toThrow("Partners already exist");
    });
  });

  describe("reallocateShares", () => {
    it("requires sum == 10000bp", () => {
      const p1 = createPartner("Karim", "karim@test.com");
      const p2 = createPartner("Rahim", "rahim@test.com");
      profitShare.assignInitialShare(p1);

      expect(() =>
        profitShare.reallocateShares(
          [{ user_id: p1, share_bp: 6000 }, { user_id: p2, share_bp: 3000 }],
          "admin", "test"
        )
      ).toThrow("10000 bp");
    });

    it("accepts exact 10000bp sum", () => {
      const p1 = createPartner("Karim", "karim@test.com");
      const p2 = createPartner("Rahim", "rahim@test.com");
      profitShare.assignInitialShare(p1);

      const result = profitShare.reallocateShares(
        [{ user_id: p1, share_bp: 6000 }, { user_id: p2, share_bp: 4000 }],
        "admin", "Split 60/40"
      );

      expect(result.version).toBe(2);
      expect(result.shares).toHaveLength(2);
    });

    it("rejects non-partner users", () => {
      const p1 = createPartner("Karim", "karim@test.com");
      profitShare.assignInitialShare(p1);

      // Create a staff user
      const database = db.getDatabase();
      const staffId = crypto.randomUUID();
      const hash = bcrypt.hashSync("test123", 4);
      const now = new Date().toISOString();
      database.prepare(
        "INSERT INTO users (id, full_name, email, password, role, status, created_at) VALUES (?, ?, ?, ?, 'staff', 'active', ?)"
      ).run(staffId, "Staff User", "staff@test.com", hash, now);

      expect(() =>
        profitShare.reallocateShares(
          [{ user_id: p1, share_bp: 5000 }, { user_id: staffId, share_bp: 5000 }],
          "admin", "test"
        )
      ).toThrow("not a partner");
    });

    it("closes previous version and creates new", () => {
      const p1 = createPartner("Karim", "karim@test.com");
      const p2 = createPartner("Rahim", "rahim@test.com");
      profitShare.assignInitialShare(p1);

      profitShare.reallocateShares(
        [{ user_id: p1, share_bp: 7000 }, { user_id: p2, share_bp: 3000 }],
        "admin", "re-split"
      );

      const current = profitShare.getCurrentShares();
      expect(current).toHaveLength(2);
      expect(current.every((s) => s.effective_to === null)).toBe(true);

      const version = profitShare.getCurrentVersion();
      expect(version).toBe(2);
    });

    it("logs the change with snapshot", () => {
      const p1 = createPartner("Karim", "karim@test.com");
      profitShare.assignInitialShare(p1);

      const p2 = createPartner("Rahim", "rahim@test.com");
      profitShare.reallocateShares(
        [{ user_id: p1, share_bp: 5000 }, { user_id: p2, share_bp: 5000 }],
        "admin", "Equal split"
      );

      const history = profitShare.getShareHistory(10);
      expect(history).toHaveLength(2); // version 1 (assign) + version 2 (reallocate)
    });
  });

  describe("getCurrentShares", () => {
    it("returns empty array when no partners", () => {
      const shares = profitShare.getCurrentShares();
      expect(shares).toHaveLength(0);
    });

    it("returns only active (effective_to=NULL) shares", () => {
      const p1 = createPartner("Karim", "karim@test.com");
      const p2 = createPartner("Rahim", "rahim@test.com");
      profitShare.assignInitialShare(p1);

      profitShare.reallocateShares(
        [{ user_id: p1, share_bp: 6000 }, { user_id: p2, share_bp: 4000 }],
        "admin", "re-split"
      );

      const current = profitShare.getCurrentShares();
      expect(current).toHaveLength(2);
      const sumBp = current.reduce((s, r) => s + r.share_bp, 0);
      expect(sumBp).toBe(10000);
    });
  });

  describe("getEffectiveShares (time-slicing)", () => {
    it("returns 100% to single partner for any period", () => {
      const p1 = createPartner("Karim", "karim@test.com");
      profitShare.assignInitialShare(p1);

      const effective = profitShare.getEffectiveShares("2026-07-01", "2026-07-31");
      expect(effective).toHaveLength(1);
      expect(effective[0].effective_bp).toBe(10000);
    });

    it("time-slices when ratio changes mid-period", () => {
      const p1 = createPartner("Karim", "karim@test.com");
      profitShare.assignInitialShare(p1);

      // Manually set effective_from to start of period
      const database = db.getDatabase();
      database.prepare("UPDATE profit_share_ratios SET effective_from = '2026-07-01'").run();

      const p2 = createPartner("Rahim", "rahim@test.com");

      // Override the effective_to of version 1 and create version 2 mid-period
      database.prepare("UPDATE profit_share_ratios SET effective_to = '2026-07-15' WHERE version = 1").run();
      const now = new Date().toISOString();
      database.prepare(`
        INSERT INTO profit_share_ratios (id, user_id, share_bp, effective_from, effective_to, version, created_at)
        VALUES (?, ?, 5000, '2026-07-16', NULL, 2, ?)
      `).run(crypto.randomUUID(), p1, now);
      database.prepare(`
        INSERT INTO profit_share_ratios (id, user_id, share_bp, effective_from, effective_to, version, created_at)
        VALUES (?, ?, 5000, '2026-07-16', NULL, 2, ?)
      `).run(crypto.randomUUID(), p2, now);

      const effective = profitShare.getEffectiveShares("2026-07-01", "2026-07-31");
      expect(effective.length).toBeGreaterThanOrEqual(2);

      // Sum must always be 10000
      const sum = effective.reduce((s, e) => s + e.effective_bp, 0);
      expect(sum).toBe(10000);

      // Karim should have more (100% for first 15 days + 50% for last 16 days)
      const karimShare = effective.find((e) => e.user_id === p1);
      expect(karimShare.effective_bp).toBeGreaterThan(5000);
    });

    it("returns empty for period with no partners", () => {
      const effective = profitShare.getEffectiveShares("2026-01-01", "2026-01-31");
      expect(effective).toHaveLength(0);
    });

    it("largest-remainder rounding preserves 10000bp sum", () => {
      const p1 = createPartner("A", "a@test.com");
      const p2 = createPartner("B", "b@test.com");
      const p3 = createPartner("C", "c@test.com");

      // Set up 3-way split that would cause rounding error
      const database = db.getDatabase();
      const now = new Date().toISOString();
      database.prepare(`
        INSERT INTO profit_share_ratios (id, user_id, share_bp, effective_from, effective_to, version, created_at)
        VALUES (?, ?, 3333, '2026-07-01', NULL, 1, ?)
      `).run(crypto.randomUUID(), p1, now);
      database.prepare(`
        INSERT INTO profit_share_ratios (id, user_id, share_bp, effective_from, effective_to, version, created_at)
        VALUES (?, ?, 3333, '2026-07-01', NULL, 1, ?)
      `).run(crypto.randomUUID(), p2, now);
      database.prepare(`
        INSERT INTO profit_share_ratios (id, user_id, share_bp, effective_from, effective_to, version, created_at)
        VALUES (?, ?, 3334, '2026-07-01', NULL, 1, ?)
      `).run(crypto.randomUUID(), p3, now);

      const effective = profitShare.getEffectiveShares("2026-07-01", "2026-07-31");
      const sum = effective.reduce((s, e) => s + e.effective_bp, 0);
      expect(sum).toBe(10000);
    });
  });
});
