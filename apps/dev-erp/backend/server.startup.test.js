import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

test("server module registers routes without startup-time reference errors", async () => {
  const previousSkipStart = process.env.DEV_ERP_SKIP_SERVER_START;
  const previousAppEnv = process.env.APP_ENV;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDatabaseUrlDevelopment = process.env.DATABASE_URL_DEVELOPMENT;
  const previousJwtSecret = process.env.JWT_SECRET;

  process.env.DEV_ERP_SKIP_SERVER_START = "1";
  process.env.APP_ENV = "test";
  process.env.DATABASE_URL = "postgresql://dev_erp_test:dev_erp_test@localhost:5432/dev_erp_test";
  process.env.DATABASE_URL_DEVELOPMENT = process.env.DATABASE_URL;
  process.env.JWT_SECRET = "dev-erp-startup-test-jwt-secret";

  try {
    const serverModule = await import("./server.js?startup-test");
    assert.equal(typeof serverModule.app?.use, "function");
    assert.equal(typeof serverModule.start, "function");
  } finally {
    if (previousSkipStart === undefined) {
      delete process.env.DEV_ERP_SKIP_SERVER_START;
    } else {
      process.env.DEV_ERP_SKIP_SERVER_START = previousSkipStart;
    }

    if (previousAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = previousAppEnv;
    }

    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousDatabaseUrlDevelopment === undefined) {
      delete process.env.DATABASE_URL_DEVELOPMENT;
    } else {
      process.env.DATABASE_URL_DEVELOPMENT = previousDatabaseUrlDevelopment;
    }

    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }
  }
});
