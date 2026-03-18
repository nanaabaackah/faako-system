import { resolvePgSslConfig } from "./runtimeEnv.js";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolvePgSslConfig(),
  });

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
