import "./runtimeEnv.js";
import { defineConfig } from "@prisma/config";

const PLACEHOLDER_DATABASE_URL = "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || PLACEHOLDER_DATABASE_URL,
  },
});
