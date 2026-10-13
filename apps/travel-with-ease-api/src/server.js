import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createApp, createLimiter } from "./app.js";
import { ExchangeRateApiProvider } from "./currency/provider.js";
import { CurrencyService } from "./currency/service.js";
import { FileLeadRepository } from "./crm/repository.js";
import { EstimatorService } from "./estimator/service.js";
import { createLogger } from "@faako/logger";
import { readConfig, assertLocalFoundation } from "./config.js";
import { createDatabase } from "./db/database.js";
import { PostgresLeadRepository } from "./db/repository.js";
import { readAuthConfig } from "./auth/config.js";
import { createOidcProvider } from "./auth/oidc.js";
import { PostgresAuthStore } from "./auth/store.js";
import { createStaffAuth } from "./auth/routes.js";
import { ContentRepository } from "./content/repository.js";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { environment, allowedOrigins, port } = readConfig();
assertLocalFoundation(environment);
const logger = createLogger("travel-with-ease-api", { environment });

const configuration = JSON.parse(readFileSync(path.join(directory, "config", "estimator.json"), "utf8"));
const currencies = JSON.parse(readFileSync(path.join(directory, "config", "currencies.json"), "utf8"));

const provider = new ExchangeRateApiProvider({
  ...(process.env.EXCHANGE_RATE_API_BASE_URL ? { baseUrl: process.env.EXCHANGE_RATE_API_BASE_URL } : {}),
  apiKey: process.env.EXCHANGE_RATE_API_KEY,
  timeoutMs: Number(process.env.EXCHANGE_RATE_TIMEOUT_MS || 5000),
});
const currencyService = new CurrencyService({ provider, supportedCurrencies: currencies.filter((currency) => currency.enabled).map((currency) => currency.code), ttlMs: Number(process.env.EXCHANGE_RATE_CACHE_TTL_SECONDS || 21600) * 1000 });
const pool = process.env.DATABASE_URL ? createDatabase(process.env, "DATABASE_URL", logger) : null;
const repository = pool
  ? new PostgresLeadRepository(pool, { environment, organisationId: process.env.TWE_ORGANISATION_ID })
  : new FileLeadRepository(process.env.TWE_LOCAL_DATA_FILE || path.join(directory, "data", "development.json"));
if (pool) await repository.ready();
const authSettings = readAuthConfig();
if (authSettings && !pool) throw new Error("Staff authentication requires PostgreSQL.");
if (authSettings && !allowedOrigins.includes(authSettings.portalOrigin)) throw new Error("The staff portal origin must be explicitly allowed.");
const staffAuth = createStaffAuth({
  settings: authSettings, provider: authSettings ? await createOidcProvider(authSettings) : null,
  store: pool ? new PostgresAuthStore(pool, process.env.TWE_ORGANISATION_ID) : null,
  limiter: createLimiter({ limit: 10, windowMs: 300_000 }), logger,
});
const contentRepository = pool ? new ContentRepository(pool, process.env.TWE_ORGANISATION_ID) : null;
const app = createApp({ repository, estimatorService: new EstimatorService({ currencyService, configuration }), contentRepository, allowedOrigins, staffAuth, environment, logger });
const server = app.listen(port, () => logger.info({ port, environment }, "API listening"));
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => {
  server.close(async () => { if (pool) await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
});
