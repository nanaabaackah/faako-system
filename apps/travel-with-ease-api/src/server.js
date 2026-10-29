import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { access } from "node:fs/promises";
import { createApp, createLimiter } from "./app.js";
import { ExchangeRateApiProvider } from "./currency/provider.js";
import { CurrencyService } from "./currency/service.js";
import { FileLeadRepository } from "./crm/repository.js";
import { EstimatorService } from "./estimator/service.js";
import { createLogger } from "@faako/logger";
import { readConfig, assertLocalFoundation } from "./config.js";
import { createDatabase } from "./db/database.js";
import { PostgresLeadRepository } from "./db/repository.js";
import { readAccessConfig } from "./auth/access-config.js";
import { createAccessVerifier } from "./auth/access.js";
import { Administration } from "./auth/administration.js";
import { administrationRoutes } from "./auth/administration-routes.js";
import { TutorialService } from "./onboarding/service.js";
import { tutorialRoutes } from "./onboarding/routes.js";
import { Invitations } from "./onboarding/invitations.js";
import { invitationRoutes } from "./onboarding/invitation-routes.js";
import { PostgresAuthStore } from "./auth/store.js";
import { createStaffAuth } from "./auth/routes.js";
import { ContentRepository } from "./content/repository.js";
import { PublicationRepository } from "./content/publication.js";
import { MediaService } from "./media/service.js";
import { readR2Config, R2Store } from "./media/r2.js";
import { prepareHostedStartup } from "./staging-startup.js";
import { readHostedPrerequisites, readinessFailureCode } from "./portal/readiness.js";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { environment, deployed, allowedOrigins, port } = readConfig();
if (deployed) readHostedPrerequisites(process.env);
else assertLocalFoundation(environment);
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
let startupReceipt;
if (deployed) {
  try {
    if (!pool) throw new Error("Hosted startup requires PostgreSQL.");
    startupReceipt = await prepareHostedStartup(process.env, pool);
  } catch (error) {
    await pool?.end();
    const reason = readinessFailureCode(error);
    logger.error({ eventName: "hosted.preflight.failed", reason }, `Hosted startup denied (${reason}): check runtime database configuration, identity, role and migrations.`);
    process.exit(1);
  }
}
const repository = pool
  ? new PostgresLeadRepository(pool, { environment, organisationId: process.env.TWE_ORGANISATION_ID })
  : new FileLeadRepository(process.env.TWE_LOCAL_DATA_FILE || path.join(directory, "data", "development.json"));
if (pool) await repository.ready();
const authSettings = readAccessConfig();
const accessVerifier = authSettings ? createAccessVerifier(authSettings) : null;
// The build packages the Vite CMS inside this API workspace for Railway runtime.
const portalDist = path.join(directory, "dist", "cms");
if (deployed) await access(path.join(portalDist, "index.html"));
if (authSettings && !pool) throw new Error("Staff authentication requires PostgreSQL.");
if (authSettings && !allowedOrigins.includes(authSettings.portalOrigin)) throw new Error("The staff portal origin must be explicitly allowed.");
const administration = pool && authSettings ? new Administration(pool, process.env.TWE_ORGANISATION_ID, authSettings, environment) : null;
const staffAuth = createStaffAuth({
  administration,
  settings: authSettings, provider: accessVerifier,
  store: pool ? new PostgresAuthStore(pool, process.env.TWE_ORGANISATION_ID) : null,
  limiter: createLimiter({ limit: 10, windowMs: 300_000 }), logger,
});
if (administration) staffAuth.administrationRouter = administrationRoutes(administration, staffAuth);
if (pool && authSettings) staffAuth.router.use(tutorialRoutes(new TutorialService(pool, process.env.TWE_ORGANISATION_ID), staffAuth));
if (pool && authSettings?.mode === "cloudflare_access") staffAuth.router.use(invitationRoutes(new Invitations(pool, process.env.TWE_ORGANISATION_ID, authSettings, environment, process.env.TWE_SETUP_OPERATOR_SUBJECT), staffAuth));
const contentRepository = pool ? new ContentRepository(pool, process.env.TWE_ORGANISATION_ID) : null;
const publicationRepository = pool ? new PublicationRepository(pool, { organisationId: process.env.TWE_ORGANISATION_ID, environment, sourceSha: process.env.TWE_RELEASE_SHA }) : null;
const mediaSettings = readR2Config();
if (mediaSettings && !pool) throw new Error("Media storage requires PostgreSQL.");
const mediaService = pool ? new MediaService(pool, process.env.TWE_ORGANISATION_ID, mediaSettings ? new R2Store(mediaSettings) : null, logger) : null;
const app = createApp({ repository, estimatorService: new EstimatorService({ currencyService, configuration }), contentRepository, publicationRepository, mediaService, allowedOrigins, staffAuth, startupReceipt, environment, logger,
  portal: deployed ? { settings: authSettings, verifier: accessVerifier, distDirectory: portalDist } : null,
});
const server = app.listen(port, () => logger.info({ port, environment }, "API listening"));
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => {
  server.close(async () => { if (pool) await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
});
