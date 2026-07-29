import fs from "fs";
import os from "os";
import path from "path";
import { beforeAll, afterAll } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "turfslot-test-"));
const dbPath = path.join(tmpDir, "test.sqlite");

process.env.SQLITE_PATH = dbPath;

let dbModule;

export async function setupTestDb() {
  dbModule = await import("../db/sqlite.js");
  dbModule.initDatabase();
  return dbModule;
}

export function getDb() {
  return dbModule;
}

export function clearAll() {
  dbModule.clearAllTables();
}

export function cleanup() {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}
