import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const JSON_COLUMNS = {
  Turf: ["amenities"],
  Booking: ["payment_history"],
  Order: ["items"],
  Tournament: ["teams"],
  ProfitShareChangeLog: ["snapshot"]
};

// Build valid fields set for every model dynamically from Prisma DMMF
const MODEL_FIELDS = {};
if (Prisma && Prisma.dmmf && Prisma.dmmf.datamodel && Prisma.dmmf.datamodel.models) {
  for (const m of Prisma.dmmf.datamodel.models) {
    MODEL_FIELDS[m.name] = new Set(m.fields.map(f => f.name));
  }
}

// Map Prisma model names (e.g. 'User') to table names used in controllers (e.g. 'users')
const TABLE_MODEL_MAP = {
  users: "User",
  turfs: "Turf",
  bookings: "Booking",
  payments: "Payment",
  products: "Product",
  orders: "Order",
  tournaments: "Tournament",
  accounts: "Account",
  journal_entries: "JournalEntry",
  journal_lines: "JournalLine",
  profit_share_ratios: "ProfitShareRatio",
  profit_share_change_log: "ProfitShareChangeLog",
  expenses: "Expense",
  incomes: "Income",
  app_settings: "AppSetting"
};

const sanitizeModelData = (data, modelName) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const validFields = MODEL_FIELDS[modelName];
  if (!validFields) return data;

  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (validFields.has(key)) {
      clean[key] = value;
    }
  }
  return clean;
};

const prisma = new PrismaClient().$extends({
  result: {
    $allModels: {
      _id: {
        needs: { id: true },
        compute(record) {
          return record.id;
        },
      },
    },
  },
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Sanitize extra/unknown fields and handle JSON columns before writing to DB
        if (["create", "update", "updateMany", "createMany"].includes(operation) && args.data) {
          const jsonCols = JSON_COLUMNS[model];

          if (Array.isArray(args.data)) { // createMany
            args.data = args.data.map(row => {
              const clean = sanitizeModelData(row, model);
              if (jsonCols) {
                for (const col of jsonCols) {
                  if (clean[col] !== undefined && typeof clean[col] !== "string") {
                    clean[col] = JSON.stringify(clean[col]);
                  }
                }
              }
              return clean;
            });
          } else { // create, update
            args.data = sanitizeModelData(args.data, model);
            if (jsonCols) {
              for (const col of jsonCols) {
                if (args.data[col] !== undefined && typeof args.data[col] !== "string") {
                  args.data[col] = JSON.stringify(args.data[col]);
                }
              }
            }
          }
        }

        const result = await query(args);

        // Parse JSON columns after reading from DB
        const parseRow = (row) => {
          if (!row) return row;
          const jsonCols = JSON_COLUMNS[model];
          if (jsonCols) {
            for (const col of jsonCols) {
              if (typeof row[col] === "string") {
                try {
                  row[col] = JSON.parse(row[col]);
                } catch {
                  row[col] = null;
                }
              }
            }
          }
          // Preserve createdAt alias from old ORM
          if (row.created_at) {
            row.createdAt = row.created_at;
          }
          return row;
        };

        if (Array.isArray(result)) {
          return result.map(parseRow);
        } else {
          return parseRow(result);
        }
      },
    },
  },
});

export default prisma;

// Helper to keep old API compatibility for App Settings
export const getSetting = async (key) => {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  return setting ? setting.value : null;
};

export const setSetting = async (key, value) => {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
};
