import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createApp } from "./app.js";
import { ExchangeRateApiProvider } from "./currency/provider.js";
import { CurrencyService } from "./currency/service.js";
import { FileLeadRepository } from "./crm/repository.js";
import { EstimatorService } from "./estimator/service.js";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const environment = process.env.APP_ENV || process.env.NODE_ENV || "development";
if (environment === "production") throw new Error("The reviewed PostgreSQL repository and staff authentication adapters must be implemented before production launch.");

const configuration = JSON.parse(readFileSync(path.join(directory, "config", "estimator.json"), "utf8"));
const currencies = JSON.parse(readFileSync(path.join(directory, "config", "currencies.json"), "utf8"));

const provider = new ExchangeRateApiProvider({
  ...(process.env.EXCHANGE_RATE_API_BASE_URL ? { baseUrl: process.env.EXCHANGE_RATE_API_BASE_URL } : {}),
  apiKey: process.env.EXCHANGE_RATE_API_KEY,
  timeoutMs: Number(process.env.EXCHANGE_RATE_TIMEOUT_MS || 5000),
});
const currencyService = new CurrencyService({ provider, supportedCurrencies: currencies.filter((currency) => currency.enabled).map((currency) => currency.code), ttlMs: Number(process.env.EXCHANGE_RATE_CACHE_TTL_SECONDS || 21600) * 1000 });
const repository = new FileLeadRepository(process.env.TWE_LOCAL_DATA_FILE || path.join(directory, "data", "development.json"));
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "http://localhost:4328,http://localhost:5188").split(",").map((value) => value.trim()).filter(Boolean);
const app = createApp({ repository, estimatorService: new EstimatorService({ currencyService, configuration }), allowedOrigins, agentToken: process.env.TWE_AGENT_API_TOKEN || "", environment });
const port = Number(process.env.PORT || 3090);
app.listen(port, () => console.log(JSON.stringify({ level: "info", service: "travel-with-ease-api", port, environment })));
