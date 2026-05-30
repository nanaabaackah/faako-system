/**
 * Reads prisma/seeds/users.csv and upserts each user into the DB.
 * Passwords are hashed with scrypt before writing — plain text never reaches the DB.
 *
 * Usage:
 *   node prisma/seed-users.mjs
 *
 * Edit prisma/seeds/users.csv first, then delete it after seeding.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import prismaPkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const CSV_PATH = path.join(__dirname, "seeds", "users.csv");

const envName = String(process.env.APP_ENV || process.env.NODE_ENV || "development")
  .trim()
  .toLowerCase();
dotenv.config({ path: path.join(appRoot, `.env.${envName}`), override: true });

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString("hex");
  return `${salt}:${hash}`;
};

const parseCSV = (raw) => {
  const lines = raw.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(",").map((h) => h.trim());
  return rows.map((row) => {
    const values = row.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
};

const { PrismaClient } = prismaPkg;

const connectionString =
  envName === "production"
    ? process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL
    : process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL_DEVELOPMENT, DATABASE_URL_PRODUCTION, or DATABASE_URL.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const run = async () => {
  console.log(`Target environment: ${envName}`);

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const users = parseCSV(raw);

  if (users.length === 0) {
    console.log("No users found in CSV.");
    return;
  }

  console.log(`Seeding ${users.length} user(s)…`);

  for (const { username, password, role } of users) {
    if (!username || !password) {
      console.warn(`  Skipping row with missing username or password.`);
      continue;
    }

    const normalizedRole = role === "ADMIN" ? "ADMIN" : "VIEWER";
    const passwordHash = hashPassword(password);

    await prisma.siteUser.upsert({
      where: { username: username.toLowerCase() },
      update: { passwordHash, role: normalizedRole },
      create: { username: username.toLowerCase(), passwordHash, role: normalizedRole },
    });

    console.log(`  ✓ ${username.toLowerCase()} (${normalizedRole})`);
  }

  console.log("\nDone. Delete prisma/seeds/users.csv now — it contains plain-text passwords.");
};

run()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
