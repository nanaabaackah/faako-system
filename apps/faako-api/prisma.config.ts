import "dotenv/config";
import { createRequire } from "node:module";
import { defineConfig, env } from "prisma/config";

const require = createRequire(import.meta.url);
const { resolveDatabaseUrl } = require("./src/runtimeConfig.js");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: resolveDatabaseUrl() || env("DATABASE_URL")
  }
});
