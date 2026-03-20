/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../runtimeEnv.js";
import { Client } from "pg";
import { hashPassword } from "../utils/passwords.js";

const HASH_PREFIX = "scrypt$";

const shouldRehash = (password) => {
  if (typeof password !== "string" || !password.trim()) return false;
  return !password.startsWith(HASH_PREFIX);
};

const main = async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const result = await client.query(`SELECT id, password FROM "user"`);
    const rows = result.rows || [];

    let updated = 0;
    for (const row of rows) {
      if (!shouldRehash(row.password)) continue;
      const hashed = await hashPassword(row.password);
      await client.query(
        `UPDATE "user" SET "password" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [hashed, row.id]
      );
      updated += 1;
    }

    console.log(`✅ Rehashed ${updated} user password(s).`);
  } catch (err) {
    console.error("❌ Rehash failed:", err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
};

main();
