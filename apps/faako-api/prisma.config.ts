import "dotenv/config";
import { createRequire } from "node:module";
import { defineConfig, env } from "prisma/config";

const LOCAL_APP_ENVS = new Set(["development", "dev", "local", "test"]);

const normalizeAppEnv = (value: unknown) => String(value || "").trim().toLowerCase();

const resolveDatabaseUrl = () => {
  const appEnv = normalizeAppEnv(process.env.APP_ENV || process.env.CONTEXT || process.env.NODE_ENV);

  if (LOCAL_APP_ENVS.has(appEnv)) {
    const localDatabaseUrl = process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL_LOCAL;
    if (localDatabaseUrl) return localDatabaseUrl;
    if (process.env.ALLOW_PRODUCTION_DATABASE_IN_DEV === "true") {
      return process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;
    }
    return "";
  }

  return (
    process.env.DATABASE_URL_PRODUCTION ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_DEVELOPMENT ||
    process.env.DATABASE_URL_LOCAL
  );
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: resolveDatabaseUrl() || env("DATABASE_URL")
  }
});
