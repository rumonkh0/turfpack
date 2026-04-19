import path from "path";
import os from "os";
import bcrypt from "bcryptjs";
import {
  initDatabase,
  findOne,
  createRecord,
  updateById,
  getDbPath,
} from "../server/db/sqlite.js";

const email = process.env.DESKTOP_USER_EMAIL || "rumon@turfslot.com";
const password = process.env.DESKTOP_USER_PASSWORD || "00000000";
const fullName = process.env.DESKTOP_USER_NAME || "Rumon";

if (!process.env.SQLITE_PATH) {
  process.env.SQLITE_PATH = path.join(
    os.homedir(),
    ".config",
    "Electron",
    "data",
    "turfslot.sqlite",
  );
}

initDatabase();

const hashed = await bcrypt.hash(password, 10);
const existing = findOne("users", "email = ?", [email], {
  includePassword: true,
});

if (existing) {
  const updated = updateById("users", existing.id, {
    full_name: existing.full_name || fullName,
    password: hashed,
    role: "admin",
    status: "active",
  });
  console.log(
    `UPDATED_USER ${updated.email} (${updated.id}) in ${getDbPath()}`,
  );
} else {
  const created = createRecord("users", {
    full_name: fullName,
    email,
    password: hashed,
    role: "admin",
    status: "active",
  });
  console.log(
    `CREATED_USER ${created.email} (${created.id}) in ${getDbPath()}`,
  );
}
