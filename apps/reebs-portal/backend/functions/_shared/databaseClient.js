import { Client } from "pg";
import { resolvePgSslConfig } from "../../../runtimeEnv.js";
import { createLogger } from "./logger.js";

const CONNECTION_ERROR_CODES = new Set([
  "08000",
  "08003",
  "08006",
  "57P01",
  "57P02",
  "57P03",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
]);

const CONNECTION_ERROR_PATTERN =
  /connection (?:terminated|closed|error)|connection is not queryable|server closed the connection|socket hang up/i;

export const isDatabaseConnectionError = (error) => {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || error || "").trim();
  return CONNECTION_ERROR_CODES.has(code) || CONNECTION_ERROR_PATTERN.test(message);
};

export const createDatabaseClient = ({ component = "database-client", onConnectionError } = {}) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });
  const logger = createLogger(component);

  client.on("error", (error) => {
    if (typeof onConnectionError === "function") {
      onConnectionError(error);
      return;
    }
    logger.error({
      err: error,
      code: error?.code || undefined,
      recoverable: isDatabaseConnectionError(error),
      eventName: "database.client.connection_error",
    }, "Database client connection failed");
  });

  return client;
};
