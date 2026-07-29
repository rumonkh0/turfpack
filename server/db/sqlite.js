import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const loadBetterSqlite3 = () => {
  if (process.versions?.electron) {
    const candidatePaths = [
      path.resolve(__dirname, "../../node_modules/better-sqlite3"),
      path.resolve(
        process.resourcesPath || "",
        "app.asar.unpacked/node_modules/better-sqlite3",
      ),
      path.resolve(
        process.resourcesPath || "",
        "app.asar/node_modules/better-sqlite3",
      ),
      path.resolve(process.resourcesPath || "", "node_modules/better-sqlite3"),
    ];

    for (const candidatePath of candidatePaths) {
      try {
        return require(candidatePath);
      } catch {
        // Try the next packaged layout.
      }
    }
  }
  return require("better-sqlite3");
};

const Database = loadBetterSqlite3();

const getDbFilePath = () => {
  return (
    process.env.SQLITE_PATH ||
    path.join(path.resolve(__dirname, "../data"), "turfslot.sqlite")
  );
};

let db;

const TABLE_CONFIG = {
  users: {
    columns: [
      "full_name",
      "email",
      "password",
      "role",
      "reset_password_token",
      "reset_password_expire",
      "image_url",
      "image_public_id",
      "status",
    ],
    jsonColumns: [],
    defaults: { role: "user", status: "active" },
    allowedSort: ["id", "full_name", "email", "role", "status", "created_at"],
  },
  turfs: {
    columns: [
      "name",
      "type",
      "size",
      "location",
      "description",
      "image_url",
      "image_public_id",
      "status",
      "base_price",
      "peak_price",
      "night_price",
      "opening_hour",
      "closing_hour",
      "peak_hours_start",
      "peak_hours_end",
      "weekend_multiplier",
      "amenities",
    ],
    jsonColumns: ["amenities"],
    defaults: {
      status: "active",
      base_price: 0,
      peak_price: 0,
      night_price: 0,
      opening_hour: 6,
      closing_hour: 23,
      peak_hours_start: 17,
      peak_hours_end: 21,
      weekend_multiplier: 1.2,
      amenities: [],
    },
    allowedSort: ["id", "name", "type", "status", "base_price", "created_at"],
  },
  bookings: {
    columns: [
      "turf_id",
      "turf_name",
      "customer_name",
      "customer_phone",
      "customer_email",
      "date",
      "start_hour",
      "end_hour",
      "duration_hours",
      "total_price",
      "paid_amount",
      "payment_history",
      "status",
      "payment_status",
      "payment_method",
      "notes",
      "txn_id",
    ],
    jsonColumns: ["payment_history"],
    defaults: {
      status: "confirmed",
      payment_status: "unpaid",
      payment_method: "bkash",
      paid_amount: 0,
      payment_history: [],
    },
    allowedSort: [
      "id",
      "date",
      "start_hour",
      "end_hour",
      "status",
      "payment_status",
      "created_at",
    ],
  },
  payments: {
    columns: [
      "booking_id",
      "amount",
      "status",
      "method",
      "transaction_id",
      "customer_name",
      "customer_phone",
    ],
    jsonColumns: [],
    defaults: { status: "completed" },
    allowedSort: ["id", "amount", "status", "method", "created_at"],
  },
  products: {
    columns: [
      "name",
      "category",
      "price",
      "cost_price",
      "stock",
      "unit",
      "sku",
      "status",
      "image_url",
      "image_public_id",
      "description",
      "low_stock_alert",
    ],
    jsonColumns: [],
    defaults: {
      cost_price: 0,
      stock: 0,
      unit: "pcs",
      status: "active",
      low_stock_alert: 5,
    },
    allowedSort: [
      "id",
      "name",
      "category",
      "price",
      "stock",
      "status",
      "created_at",
    ],
  },
  orders: {
    columns: [
      "customer_name",
      "customer_phone",
      "items",
      "total_amount",
      "status",
      "payment_method",
      "payment_status",
      "notes",
    ],
    jsonColumns: ["items"],
    defaults: {
      status: "confirmed",
      payment_method: "cash",
      payment_status: "paid",
      items: [],
    },
    allowedSort: [
      "id",
      "customer_name",
      "status",
      "payment_status",
      "total_amount",
      "created_at",
    ],
  },
  tournaments: {
    columns: [
      "name",
      "turf_id",
      "turf_name",
      "start_date",
      "end_date",
      "max_teams",
      "entry_fee",
      "prize_pool",
      "status",
      "format",
      "description",
      "rules",
      "teams",
    ],
    jsonColumns: ["teams"],
    defaults: {
      max_teams: 8,
      entry_fee: 0,
      prize_pool: 0,
      status: "upcoming",
      format: "knockout",
      teams: [],
    },
    allowedSort: [
      "id",
      "name",
      "status",
      "format",
      "start_date",
      "end_date",
      "created_at",
    ],
  },
  accounts: {
    columns: [
      "code",
      "name",
      "type",
      "normal_side",
      "description",
      "is_system",
      "status",
    ],
    jsonColumns: [],
    defaults: { is_system: 1, status: "active" },
    allowedSort: ["id", "code", "name", "type", "status", "created_at"],
  },
  journal_entries: {
    columns: [
      "entry_date",
      "description",
      "reference_type",
      "reference_id",
      "posting_event",
      "created_by",
    ],
    jsonColumns: [],
    defaults: {},
    allowedSort: [
      "id",
      "entry_date",
      "reference_type",
      "posting_event",
      "created_at",
    ],
  },
  journal_lines: {
    columns: [
      "journal_entry_id",
      "account_code",
      "debit",
      "credit",
      "description",
    ],
    jsonColumns: [],
    defaults: { debit: 0, credit: 0 },
    allowedSort: ["id", "journal_entry_id", "account_code", "created_at"],
  },
  profit_share_ratios: {
    columns: [
      "user_id",
      "share_bp",
      "effective_from",
      "effective_to",
      "version",
    ],
    jsonColumns: [],
    defaults: {},
    allowedSort: [
      "id",
      "user_id",
      "share_bp",
      "effective_from",
      "version",
      "created_at",
    ],
  },
  profit_share_change_log: {
    columns: [
      "version",
      "changed_by",
      "reason",
      "snapshot",
    ],
    jsonColumns: ["snapshot"],
    defaults: {},
    allowedSort: ["id", "version", "created_at"],
  },
  expenses: {
    columns: [
      "description",
      "amount",
      "account_code",
      "payment_method",
      "payment_status",
      "entry_date",
      "notes",
      "created_by",
    ],
    jsonColumns: [],
    defaults: { account_code: "6099", payment_method: "cash", payment_status: "paid" },
    allowedSort: [
      "id",
      "amount",
      "account_code",
      "payment_method",
      "entry_date",
      "created_at",
    ],
  },
  incomes: {
    columns: [
      "description",
      "amount",
      "account_code",
      "payment_method",
      "payment_status",
      "entry_date",
      "notes",
      "created_by",
    ],
    jsonColumns: [],
    defaults: { account_code: "4099", payment_method: "cash", payment_status: "paid" },
    allowedSort: [
      "id",
      "amount",
      "account_code",
      "payment_method",
      "entry_date",
      "created_at",
    ],
  },
};

const mapSortField = (field) => {
  if (field === "created_date" || field === "createdAt") return "created_at";
  return field;
};

const sortToOrderBy = (table, sort = "-createdAt") => {
  const config = TABLE_CONFIG[table];
  const parts = (sort || "-createdAt")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const clauses = [];

  for (const part of parts) {
    const desc = part.startsWith("-");
    const rawField = desc ? part.slice(1) : part;
    const field = mapSortField(rawField);
    if (!config.allowedSort.includes(field)) continue;
    clauses.push(`${field} ${desc ? "DESC" : "ASC"}`);
  }

  if (!clauses.length) {
    clauses.push("created_at DESC");
  }

  return clauses.join(", ");
};

const serializeValue = (table, key, value) => {
  if (value === undefined) return undefined;
  const { jsonColumns } = TABLE_CONFIG[table];
  if (jsonColumns.includes(key)) {
    return JSON.stringify(value ?? null);
  }
  return value;
};

const parseRow = (table, row, { includePassword = false } = {}) => {
  if (!row) return null;

  const out = { ...row };
  for (const jsonColumn of TABLE_CONFIG[table].jsonColumns) {
    if (typeof out[jsonColumn] === "string") {
      try {
        out[jsonColumn] = JSON.parse(out[jsonColumn]);
      } catch {
        out[jsonColumn] = null;
      }
    }
  }

  out._id = out.id;
  out.createdAt = out.created_at;
  out.created_date = out.created_at;
  delete out.created_at;

  if (table === "users" && !includePassword) {
    delete out.password;
  }

  return out;
};

export const initDatabase = () => {
  if (db) return db;

  const dbPath = getDbFilePath();
  const dbDir = path.dirname(dbPath);
  console.log(`📂 Ensuring database directory exists at: ${dbDir}`);

  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log("✅ Directory created successfully.");
    }
  } catch (err) {
    console.error(`❌ Failed to create directory ${dbDir}:`, err.message);
  }

  console.log(`🗄️ Attempting to open SQLite database at: ${dbPath}`);
  try {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    console.log("✅ Database opened and WAL mode enabled.");
  } catch (err) {
    console.error("❌ SQLite Open Error:", err.message);
    throw err;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      reset_password_token TEXT,
      reset_password_expire TEXT,
      image_url TEXT,
      image_public_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS turfs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size TEXT,
      location TEXT,
      description TEXT,
      image_url TEXT,
      image_public_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      base_price REAL NOT NULL DEFAULT 0,
      peak_price REAL NOT NULL DEFAULT 0,
      night_price REAL NOT NULL DEFAULT 0,
      opening_hour INTEGER NOT NULL DEFAULT 6,
      closing_hour INTEGER NOT NULL DEFAULT 23,
      peak_hours_start INTEGER NOT NULL DEFAULT 17,
      peak_hours_end INTEGER NOT NULL DEFAULT 21,
      weekend_multiplier REAL NOT NULL DEFAULT 1.2,
      amenities TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      turf_id TEXT NOT NULL,
      turf_name TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      date TEXT NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      duration_hours REAL,
      total_price REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      payment_history TEXT,
      status TEXT NOT NULL DEFAULT 'confirmed',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT NOT NULL DEFAULT 'bkash',
      notes TEXT,
      txn_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      booking_id TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      method TEXT NOT NULL,
      transaction_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pcs',
      sku TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      image_url TEXT,
      image_public_id TEXT,
      description TEXT,
      low_stock_alert INTEGER NOT NULL DEFAULT 5,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT,
      customer_phone TEXT,
      items TEXT,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      payment_method TEXT NOT NULL DEFAULT 'cash',
      payment_status TEXT NOT NULL DEFAULT 'paid',
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      turf_id TEXT NOT NULL,
      turf_name TEXT,
      start_date TEXT,
      end_date TEXT,
      max_teams INTEGER NOT NULL DEFAULT 8,
      entry_fee REAL NOT NULL DEFAULT 0,
      prize_pool REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'upcoming',
      format TEXT NOT NULL DEFAULT 'knockout',
      description TEXT,
      rules TEXT,
      teams TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_turf_date_time
    ON bookings (turf_id, date, start_hour, end_hour);

    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      normal_side TEXT NOT NULL,
      description TEXT,
      is_system INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      entry_date TEXT NOT NULL,
      description TEXT,
      reference_type TEXT,
      reference_id TEXT,
      posting_event TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_journal_entries_ref
    ON journal_entries (reference_type, reference_id, posting_event);

    CREATE INDEX IF NOT EXISTS idx_journal_entries_date
    ON journal_entries (entry_date);

    CREATE TABLE IF NOT EXISTS journal_lines (
      id TEXT PRIMARY KEY,
      journal_entry_id TEXT NOT NULL,
      account_code TEXT NOT NULL,
      debit INTEGER NOT NULL DEFAULT 0,
      credit INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_journal_lines_entry
    ON journal_lines (journal_entry_id);

    CREATE INDEX IF NOT EXISTS idx_journal_lines_account_date
    ON journal_lines (account_code);

    CREATE TABLE IF NOT EXISTS profit_share_ratios (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      share_bp INTEGER NOT NULL,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_profit_share_ratios_user
    ON profit_share_ratios (user_id);

    CREATE INDEX IF NOT EXISTS idx_profit_share_ratios_version
    ON profit_share_ratios (version);

    CREATE TABLE IF NOT EXISTS profit_share_change_log (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      changed_by TEXT NOT NULL,
      reason TEXT,
      snapshot TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      account_code TEXT NOT NULL DEFAULT '6099',
      payment_method TEXT NOT NULL DEFAULT 'cash',
      payment_status TEXT NOT NULL DEFAULT 'paid',
      entry_date TEXT NOT NULL,
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_date
    ON expenses (entry_date);

    CREATE TABLE IF NOT EXISTS incomes (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      account_code TEXT NOT NULL DEFAULT '4099',
      payment_method TEXT NOT NULL DEFAULT 'cash',
      payment_status TEXT NOT NULL DEFAULT 'paid',
      entry_date TEXT NOT NULL,
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_incomes_date
    ON incomes (entry_date);
  `);

  // Migration: ensure bookings table has paid_amount and payment_history
  try {
    const bookingsColumns = db.prepare("PRAGMA table_info(bookings)").all();
    const columnNames = bookingsColumns.map((col) => col.name);

    if (
      !columnNames.includes("paid_amount") ||
      !columnNames.includes("payment_history")
    ) {
      console.log("⚠️ Bookings table missing columns. Migrating...");
      db.exec("DROP TABLE IF EXISTS bookings;");
      db.exec(`
        CREATE TABLE bookings (
          id TEXT PRIMARY KEY,
          turf_id TEXT NOT NULL,
          turf_name TEXT,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          customer_email TEXT,
          date TEXT NOT NULL,
          start_hour INTEGER NOT NULL,
          end_hour INTEGER NOT NULL,
          duration_hours REAL,
          total_price REAL NOT NULL,
          paid_amount REAL NOT NULL DEFAULT 0,
          payment_history TEXT,
          status TEXT NOT NULL DEFAULT 'confirmed',
          payment_status TEXT NOT NULL DEFAULT 'unpaid',
          payment_method TEXT NOT NULL DEFAULT 'bkash',
          notes TEXT,
          txn_id TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_bookings_turf_date_time
        ON bookings (turf_id, date, start_hour, end_hour);
      `);
      console.log("✅ Bookings table migrated successfully");
    }
  } catch (err) {
    console.error("⚠️ Migration check failed:", err.message);
  }

  // Seed default desktop users if they don't exist
  try {
    const defaultUsers = [
      {
        full_name: process.env.DEFAULT_ADMIN_NAME || "Rumon",
        email: process.env.DEFAULT_ADMIN_EMAIL || "rumon@turfslot.com",
        password: process.env.DEFAULT_ADMIN_PASSWORD || "00000000",
      },
      {
        full_name: "Admin User",
        email: "admin@mail.com",
        password: "00000000",
      },
    ];

    for (const seedUser of defaultUsers) {
      const exists = db
        .prepare("SELECT id FROM users WHERE email = ?")
        .get(seedUser.email);

      if (exists) continue;

      const id = crypto.randomUUID();
      const hashedPassword = bcrypt.hashSync(seedUser.password, 10);
      const now = new Date().toISOString();

      db.prepare(
        `
          INSERT INTO users (id, full_name, email, password, role, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        id,
        seedUser.full_name,
        seedUser.email,
        hashedPassword,
        "admin",
        "active",
        now,
      );

      console.log(
        `✅ Default desktop user created: ${seedUser.email} / ${seedUser.password}`,
      );
    }
  } catch (err) {
    console.error("❌ Failed to seed default desktop users:", err.message);
  }

  // Migration: rename role 'user' → 'staff' (non-destructive, idempotent)
  try {
    const hasOldRole = db
      .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'")
      .get();
    if (hasOldRole.count > 0) {
      db.prepare("UPDATE users SET role = 'staff' WHERE role = 'user'").run();
      console.log(
        `✅ Role migration: ${hasOldRole.count} user(s) renamed to 'staff'`,
      );
    }
  } catch (err) {
    console.error("⚠️ Role migration failed:", err.message);
  }

  // Seed Chart of Accounts (idempotent — skips existing codes)
  try {
    const seedAccounts = [
      // Assets (1xxx)
      { code: "1001", name: "Cash - bKash", type: "asset", normal_side: "debit", description: "Mobile banking - bKash" },
      { code: "1002", name: "Cash - Nagad", type: "asset", normal_side: "debit", description: "Mobile banking - Nagad" },
      { code: "1003", name: "Cash - Rocket", type: "asset", normal_side: "debit", description: "Mobile banking - Rocket" },
      { code: "1004", name: "Cash - Physical", type: "asset", normal_side: "debit", description: "Physical cash on hand" },
      { code: "1005", name: "Cash - Card", type: "asset", normal_side: "debit", description: "Card terminal receipts" },
      { code: "1006", name: "Cash - Other", type: "asset", normal_side: "debit", description: "Other payment channels" },
      { code: "1100", name: "Accounts Receivable", type: "asset", normal_side: "debit", description: "Unpaid/partial booking balances" },
      { code: "1200", name: "Inventory", type: "asset", normal_side: "debit", description: "Product stock at cost" },
      // Liabilities (2xxx)
      { code: "2001", name: "Accounts Payable", type: "liability", normal_side: "credit", description: "Unpaid obligations" },
      // Equity (3xxx)
      { code: "3000", name: "Retained Earnings", type: "equity", normal_side: "credit", description: "Accumulated net profit" },
      { code: "3100", name: "Partner Drawings", type: "equity", normal_side: "debit", description: "Payouts to partners (contra-equity)" },
      // Revenue (4xxx)
      { code: "4001", name: "Booking Revenue", type: "revenue", normal_side: "credit", description: "Turf rental income" },
      { code: "4002", name: "Product Sales Revenue", type: "revenue", normal_side: "credit", description: "POS/retail product sales" },
      { code: "4003", name: "Tournament Revenue", type: "revenue", normal_side: "credit", description: "Tournament entry fees" },
      { code: "4099", name: "Miscellaneous Revenue", type: "revenue", normal_side: "credit", description: "Other income (sponsorships, etc.)" },
      // COGS (5xxx)
      { code: "5001", name: "Cost of Goods Sold", type: "cogs", normal_side: "debit", description: "Product cost basis on sale" },
      // Expenses (6xxx)
      { code: "6001", name: "Rent", type: "expense", normal_side: "debit", description: "Venue/space rental" },
      { code: "6002", name: "Utilities", type: "expense", normal_side: "debit", description: "Electric, water, internet" },
      { code: "6003", name: "Salaries & Wages", type: "expense", normal_side: "debit", description: "Staff compensation" },
      { code: "6004", name: "Maintenance", type: "expense", normal_side: "debit", description: "Turf/facility upkeep" },
      { code: "6005", name: "Marketing", type: "expense", normal_side: "debit", description: "Advertising, promotions" },
      { code: "6006", name: "Equipment", type: "expense", normal_side: "debit", description: "Gear, tools, hardware" },
      { code: "6099", name: "Miscellaneous Expense", type: "expense", normal_side: "debit", description: "Uncategorized expenses" },
    ];

    const insertAccount = db.prepare(`
      INSERT OR IGNORE INTO accounts (id, code, name, type, normal_side, description, is_system, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'active', ?)
    `);

    const now = new Date().toISOString();
    let seeded = 0;
    for (const acct of seedAccounts) {
      const result = insertAccount.run(
        crypto.randomUUID(),
        acct.code,
        acct.name,
        acct.type,
        acct.normal_side,
        acct.description,
        now,
      );
      if (result.changes > 0) seeded++;
    }
    if (seeded > 0) {
      console.log(`✅ Chart of Accounts seeded: ${seeded} account(s) created`);
    }
  } catch (err) {
    console.error("❌ Failed to seed Chart of Accounts:", err.message);
  }

  return db;
};

export const getDatabase = () => {
  if (!db) return initDatabase();
  return db;
};

export const runTransaction = (fn) => {
  const database = getDatabase();
  const transaction = database.transaction(fn);
  return transaction();
};

export const createRecord = (table, payload = {}) => {
  const database = getDatabase();
  const config = TABLE_CONFIG[table];
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  const merged = {
    ...config.defaults,
    ...payload,
    id,
    created_at,
  };

  const columns = ["id", ...config.columns, "created_at"];
  const values = columns.map((column) =>
    serializeValue(table, column, merged[column]),
  );

  const placeholders = columns.map(() => "?").join(", ");
  const stmt = database.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
  );
  stmt.run(values);

  return findById(table, id, { includePassword: true });
};

export const listRecords = (
  table,
  { sort = "-createdAt", limit = 500, where = "", params = [] } = {},
) => {
  const database = getDatabase();
  const orderBy = sortToOrderBy(table, sort);
  const parsedLimit = Number.isFinite(Number(limit)) ? Number(limit) : 500;
  const whereSql = where ? `WHERE ${where}` : "";

  const rows = database
    .prepare(`SELECT * FROM ${table} ${whereSql} ORDER BY ${orderBy} LIMIT ?`)
    .all(...params, parsedLimit);
  return rows.map((row) => parseRow(table, row));
};

export const findById = (table, id, options = {}) => {
  const database = getDatabase();
  const row = database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return parseRow(table, row, options);
};

export const findOne = (table, where, params = [], options = {}) => {
  const database = getDatabase();
  const row = database
    .prepare(`SELECT * FROM ${table} WHERE ${where} LIMIT 1`)
    .get(...params);
  return parseRow(table, row, options);
};

export const updateById = (table, id, payload = {}) => {
  const database = getDatabase();
  const config = TABLE_CONFIG[table];
  const keys = Object.keys(payload).filter((key) =>
    config.columns.includes(key),
  );

  if (!keys.length) {
    return findById(table, id, { includePassword: true });
  }

  const setClause = keys.map((key) => `${key} = ?`).join(", ");
  const values = keys.map((key) => serializeValue(table, key, payload[key]));

  database
    .prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`)
    .run(...values, id);
  return findById(table, id, { includePassword: true });
};

export const deleteById = (table, id) => {
  const database = getDatabase();
  const result = database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return result.changes > 0;
};

export const incrementColumn = (table, id, column, value) => {
  const database = getDatabase();
  database
    .prepare(
      `UPDATE ${table} SET ${column} = COALESCE(${column}, 0) + ? WHERE id = ?`,
    )
    .run(value, id);
  return findById(table, id, { includePassword: true });
};

export const clearAllTables = () => {
  const database = getDatabase();
  database.exec(`
    DELETE FROM journal_lines;
    DELETE FROM journal_entries;
    DELETE FROM profit_share_ratios;
    DELETE FROM profit_share_change_log;
    DELETE FROM expenses;
    DELETE FROM incomes;
    DELETE FROM payments;
    DELETE FROM bookings;
    DELETE FROM orders;
    DELETE FROM tournaments;
    DELETE FROM products;
    DELETE FROM turfs;
    DELETE FROM users;
  `);
};

export const getDbPath = () => getDbFilePath();

export const getSetting = (key) => {
  const database = getDatabase();
  const row = database
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key);
  return row ? row.value : null;
};

export const setSetting = (key, value) => {
  const database = getDatabase();
  database
    .prepare(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
};
