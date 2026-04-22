import dotenv from "dotenv";
import { defineConfig } from "@prisma/config";

const normalizeEnvironmentName = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "dev") return "development";
  if (normalized === "prod") return "production";
  return normalized;
};

const getRuntimeEnvironment = () =>
  normalizeEnvironmentName(process.env.NODE_ENV || process.env.APP_ENV || "development");

const loadEnvironmentConfig = () => {
  dotenv.config();
  const runtimeEnvironment = getRuntimeEnvironment();
  const envFile = `.env.${runtimeEnvironment}`;
  const loadedFile = dotenv.config({ path: envFile, override: true });
  const errorCode =
    loadedFile.error && "code" in loadedFile.error ? loadedFile.error.code : undefined;

  if (loadedFile.error && errorCode !== "ENOENT") {
    throw loadedFile.error;
  }

  return runtimeEnvironment;
};

const isPrismaGenerateCommand = () => process.argv.some((arg) => String(arg).trim() === "generate");

const PLACEHOLDER_DATABASE_URL =
  "postgresql://<db-user>:<db-password>@<db-host>:5432/<db-name>";

const resolveDatabaseUrl = () => {
  const environment = loadEnvironmentConfig();
  const runtimeUrl =
    environment === "production"
      ? process.env.DATABASE_URL_PRODUCTION
      : process.env.DATABASE_URL_DEVELOPMENT;
  const fallbackUrl = process.env.DATABASE_URL;
  const alternateRuntimeUrl =
    environment === "production"
      ? process.env.DATABASE_URL_DEVELOPMENT
      : process.env.DATABASE_URL_PRODUCTION;

  const resolvedUrl = String(
    runtimeUrl || fallbackUrl || (isPrismaGenerateCommand() ? alternateRuntimeUrl : "") || ""
  ).trim();

  if (!resolvedUrl) {
    if (isPrismaGenerateCommand()) {
      return PLACEHOLDER_DATABASE_URL;
    }

    const expectedVar =
      environment === "production" ? "DATABASE_URL_PRODUCTION" : "DATABASE_URL_DEVELOPMENT";

    throw new Error(
      `Missing database URL. Set ${expectedVar} or DATABASE_URL before running Prisma commands.`
    );
  }

  return resolvedUrl;
};

export default defineConfig({
  datasource: {
    url: resolveDatabaseUrl(),
  },
});