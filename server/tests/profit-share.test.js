import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { setupTestDb, clearAll } from "./setup.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

let db;
let profitShare;

async function createPartner(name, email) {
  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync("test123", 4);
  const uniqueEmail = crypto.randomUUID() + "@test.com";
  await db.user.create({
    data: {
      id,
      full_name: name,
      email: uniqueEmail,
      password: hash,
      role: 'partner',
      status: 'active'
    }
  });
  return id;
}

beforeAll(async () => {
  db = await setupTestDb();
  profitShare = await import("../services/profitShareService.js");
});

beforeEach(() => clearAll());

describe("ProfitShareService", () => {
  let p1;

  beforeEach(async () => {
    p1 = await createPartner("Karim", "karim@test.com");
  });

  describe("assignInitialShare", () => {
    it("assigns 10000bp to the first partner", async () => {
      const partnerId = await createPartner("Karim2", "karim2@test.com");
      const result = await profitShare.assignInitialShare(partnerId);

      expect(result.version).toBe(1);
      expect(result.shares).toHaveLength(1);
      expect(result.shares[0].share_bp).toBe(10000);
    });

    it("rejects second call if partners already exist", async () => {
      
      await profitShare.assignInitialShare(p1);

      const p2 = await createPartner("Rahim", "rahim@test.com");
      await expect(profitShare.assignInitialShare(p2)).rejects.toThrow("Partners already exist");
    });
  });

  describe("reallocateShares", () => {
    it("requires sum == 10000bp", async () => {
      
      const p2 = await createPartner("Rahim", "rahim@test.com");
      await profitShare.assignInitialShare(p1);

      await expect(
        profitShare.reallocateShares(
          [{ user_id: p1, share_bp: 6000 }, { user_id: p2, share_bp: 3000 }],
        )
      ).rejects.toThrow("must equal 10000");
    });

    it("accepts exact 10000bp sum", async () => {
      
      const p2 = await createPartner("Rahim", "rahim@test.com");
      await profitShare.assignInitialShare(p1);

      const result = await profitShare.reallocateShares(
        [{ user_id: p1, share_bp: 6000 }, { user_id: p2, share_bp: 4000 }],
        "admin", "Split 60/40"
      );

      expect(result.version).toBe(2);
      expect(result.shares).toHaveLength(2);
    });

    it("rejects non-partner users", async () => {
      
      const p1 = await createPartner("Karim", "karim@test.com");
      await profitShare.assignInitialShare(p1);

      // Create a staff user
      const staffId = crypto.randomUUID();
      const hash = bcrypt.hashSync("test123", 4);
      await db.user.create({
        data: {
          id: staffId,
          full_name: "Staff User",
          email: "staff@test.com",
          password: hash,
          role: 'staff',
          status: 'active'
        }
      });

      await expect(
        profitShare.reallocateShares(
          [{ user_id: p1, share_bp: 5000 }, { user_id: staffId, share_bp: 5000 }],
          "admin", "test"
        )
      ).rejects.toThrow("is not a partner");
    });

    it("closes previous version and creates new", async () => {
      
      const p2 = await createPartner("Rahim", "rahim@test.com");
      await profitShare.assignInitialShare(p1);

      await profitShare.reallocateShares(
        [{ user_id: p1, share_bp: 7000 }, { user_id: p2, share_bp: 3000 }],
        "admin", "re-split"
      );

      const current = await profitShare.getCurrentShares();
      expect(current).toHaveLength(2);
      expect(current.every((s) => s.effective_to === null)).toBe(true);

      const version = await profitShare.getCurrentVersion();
      expect(version).toBe(2);
    });

    it("logs the change with snapshot", async () => {
      
      await profitShare.assignInitialShare(p1);

      const p2 = await createPartner("Rahim", "rahim@test.com");
      await profitShare.reallocateShares(
        [{ user_id: p1, share_bp: 5000 }, { user_id: p2, share_bp: 5000 }],
        "admin", "Equal split"
      );

      const history = await profitShare.getShareHistory(10);
      expect(history).toHaveLength(2); // version 1 (assign) + version 2 (reallocate)
    });
  });

  describe("getCurrentShares", () => {
    it("returns empty array when no partners", async () => {
      const shares = await profitShare.getCurrentShares();
      expect(shares).toHaveLength(0);
    });

    it("returns only active (effective_to=NULL) shares", async () => {
      
      const p2 = await createPartner("Rahim", "rahim@test.com");
      await profitShare.assignInitialShare(p1);

      await profitShare.reallocateShares(
        [{ user_id: p1, share_bp: 6000 }, { user_id: p2, share_bp: 4000 }],
        "admin", "re-split"
      );

      const current = await profitShare.getCurrentShares();
      expect(current).toHaveLength(2);
      const sumBp = current.reduce((s, r) => s + r.share_bp, 0);
      expect(sumBp).toBe(10000);
    });
  });

  describe("getEffectiveShares (time-slicing)", () => {
    it("returns 100% to single partner for any period", async () => {
      await profitShare.assignInitialShare(p1);
      
      await db.profitShareRatio.updateMany({
        where: { version: 1 },
        data: { effective_from: new Date("2026-07-01").toISOString() }
      });

      const effective = await profitShare.getEffectiveShares("2026-07-01", "2026-07-31");
      expect(effective).toHaveLength(1);
      expect(effective[0].effective_bp).toBe(10000);
    });

    it("time-slices when ratio changes mid-period", async () => {
      
      await profitShare.assignInitialShare(p1);

      // Manually set effective_from to start of period
      await db.$executeRawUnsafe("UPDATE profit_share_ratios SET effective_from = '2026-07-01' WHERE version = 1");
      const p2 = await createPartner("Rahim", "rahim@test.com");
      await profitShare.reallocateShares([{user_id: p1, share_bp: 5000}, {user_id: p2, share_bp: 5000}], "admin", "test");
      await db.$executeRawUnsafe("UPDATE profit_share_ratios SET effective_from = '2026-07-16' WHERE version = 2");

      await db.$executeRawUnsafe("UPDATE profit_share_ratios SET effective_to = '2026-07-15T23:59:59Z' WHERE version = 1");

      const effective = await profitShare.getEffectiveShares("2026-07-01", "2026-07-31");
      expect(effective.length).toBeGreaterThanOrEqual(2);

      // Sum must always be 10000
      const sum = effective.reduce((s, e) => s + e.effective_bp, 0);
      expect(sum).toBe(10000);

      // Karim should have more (100% for first 15 days + 50% for last 16 days)
      const karimShare = effective.find((e) => e.user_id === p1);
      expect(karimShare.effective_bp).toBeGreaterThan(5000);
    });

    it("returns empty for period with no partners", async () => {
      const effective = await profitShare.getEffectiveShares("2026-01-01", "2026-01-31");
      expect(effective).toHaveLength(0);
    });

    it("largest-remainder rounding preserves 10000bp sum", async () => {
      const p1 = await createPartner("A", "a@test.com");
      const p2 = await createPartner("B", "b@test.com");
      const p3 = await createPartner("C", "c@test.com");

      // Set up 3-way split that would cause rounding error
      await db.profitShareRatio.createMany({
        data: [
          { user_id: p1, share_bp: 3333, effective_from: "2026-07-01", version: 1 },
          { user_id: p2, share_bp: 3333, effective_from: "2026-07-01", version: 1 },
          { user_id: p3, share_bp: 3334, effective_from: "2026-07-01", version: 1 }
        ]
      });

      const effective = await profitShare.getEffectiveShares("2026-07-01", "2026-07-31");
      const sum = effective.reduce((s, e) => s + e.effective_bp, 0);
      expect(sum).toBe(10000);
    });
  });
});
