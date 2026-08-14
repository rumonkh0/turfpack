import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { beforeAll, afterAll } from "vitest";
import { seedAccounts } from "./seedAccounts.js";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "mysql://root:00000000@localhost:3306/turfslot_test";

let prisma;

export async function setupTestDb() {
  try {
    execSync("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='yes' npx prisma db push --accept-data-loss", { env: process.env, stdio: "ignore" });
  } catch (err) {}
  
  const prismaModule = await import("../db/prismaClient.js");

  prisma = prismaModule.default;
  
  if (await prisma.account.count() === 0) {
    for (const acc of seedAccounts) {
      await prisma.account.create({ data: { code: acc.code, name: acc.name, type: acc.type, normal_side: acc.normal_side, description: acc.description, is_system: 1, status: 'active' } });
    }
  }
  
  return prisma;
}

export async function createRecord(table, data) {
  const tableToModel = {
    "bookings": "booking",
    "payments": "payment",
    "products": "product",
    "orders": "order",
    "tournaments": "tournament",
    "accounts": "account",
    "journal_entries": "journalEntry",
    "journal_lines": "journalLine",
    "profit_share_ratios": "profitShareRatio",
    "profit_share_change_log": "profitShareChangeLog",
    "expenses": "expense",
    "incomes": "income",
    "app_settings": "appSetting"
  };
  const model = tableToModel[table];
  if (table === 'orders') {
      data.items = data.items || [];
  }
  return await prisma[model].create({ data });
}

export function getDb() {
  return prisma;
}

export async function clearAll() {
  if (prisma) {
    await prisma.payment.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.turf.deleteMany();
    await prisma.profitShareChangeLog.deleteMany();
    await prisma.profitShareRatio.deleteMany();
    await prisma.journalLine.deleteMany();
    await prisma.journalEntry.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.income.deleteMany();
    await prisma.tournament.deleteMany();
    await prisma.user.deleteMany();
  }
}

export async function cleanup() {
  try {
    if (prisma) {
      await prisma.$disconnect();
    }
  } catch {}
}
