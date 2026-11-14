import { readConfig } from "../config.js";
import { createDatabase, verifyDatabaseIdentity } from "../db/database.js";
import { createLogger } from "@faako/logger";
import { readNotificationConfig, ResendSender } from "./resend.js";
import { NotificationOutbox, deliverOne } from "./outbox.js";
import { EmailTemplates } from "./templates.js";
import { verifyHostedDatabase } from "../portal/readiness.js";
import { runNotificationLoop } from "./loop.js";
import { createContinuationLinks, readContinuationConfig } from "../enquiries/continuation-links.js";

const continuous = process.argv[2] === "--continuous";
if (process.argv.slice(2).length > (continuous ? 1 : 0)) throw new Error("Unknown notification worker option.");
const shutdown = new AbortController();
const stop = () => shutdown.abort();
if (continuous) for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);

const { environment, deployed } = readConfig();
if (deployed && process.env.TWE_NOTIFICATION_WORKER_ENABLED !== "true") throw new Error("Hosted notification delivery requires explicit worker activation.");
const config = readNotificationConfig();
if (!config) throw new Error("Notification delivery is not configured.");
const continuationSettings = readContinuationConfig(process.env);
if (!continuationSettings) throw new Error("Enquiry continuation links are not configured.");
const continuationLinks = createContinuationLinks(continuationSettings);
const logger = createLogger("twe-notification-worker", { environment });
const pool = createDatabase(process.env, "DATABASE_URL", logger);
try {
  await verifyDatabaseIdentity(pool, { environment, organisationId: process.env.TWE_ORGANISATION_ID });
  if (deployed) await verifyHostedDatabase(pool, { environment, organisationId: process.env.TWE_ORGANISATION_ID });
  const templates = new EmailTemplates(pool, process.env.TWE_ORGANISATION_ID);
  const outbox = new NotificationOutbox(pool, process.env.TWE_ORGANISATION_ID);
  const tick = async () => {
    const copy = await templates.activeCopy();
    return deliverOne(outbox, new ResendSender(config, fetch, copy, continuationLinks), logger);
  };
  logger.info({ eventName: "notification.worker_ready", continuous }, "Notification worker verified its environment and database.");
  if (continuous) await runNotificationLoop({ tick, signal: shutdown.signal });
  else await tick();
} catch {
  logger.error({ eventName: "notification.worker_failed" }, "Notification worker needs operator review");
  process.exitCode = 1;
} finally {
  for (const signal of ["SIGINT", "SIGTERM"]) process.removeListener(signal, stop);
  await pool.end();
}
