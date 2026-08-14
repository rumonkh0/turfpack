import path from "path";
import os from "os";
import bcrypt from "bcryptjs";
import prisma from "../server/db/prismaClient.js";

const email = process.env.DESKTOP_USER_EMAIL || "admin@mail.com";
const password = process.env.DESKTOP_USER_PASSWORD || "00000000";
const fullName = process.env.DESKTOP_USER_NAME || "Admin";

if (!process.env.SQLITE_PATH) {
  process.env.SQLITE_PATH = path.join(
    os.homedir(),
    ".config",
    "Electron",
    "data",
    "turfslot.sqlite",
  );
}

const hashed = await bcrypt.hash(password, 10);
const existing = await prisma.user.findFirst({ where: { email } });

if (existing) {
  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      full_name: existing.full_name || fullName,
      password: hashed,
      role: "admin",
      status: "active",
    }
  });
  console.log(
    `UPDATED_USER ${updated.email} (${updated.id}) in ${process.env.SQLITE_PATH}`,
  );
} else {
  const created = await prisma.user.create({
    data: {
      full_name: fullName,
      email,
      password: hashed,
      role: "admin",
      status: "active",
    }
  });
  console.log(
    `CREATED_USER ${created.email} (${created.id}) in ${process.env.SQLITE_PATH}`,
  );
}
