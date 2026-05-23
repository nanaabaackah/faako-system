import "dotenv/config";
import { createRequire } from "node:module";
import { defineConfig, env } from "prisma/config";

const resolveDatabaseUrl = () => process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: resolveDatabaseUrl() || env("DATABASE_URL")
  }
});
