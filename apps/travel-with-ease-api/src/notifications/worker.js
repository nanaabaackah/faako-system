import { readConfig } from "../config.js";
import { createDatabase, verifyDatabaseIdentity } from "../db/database.js";
import { createLogger } from "@faako/logger";
import { readNotificationConfig, ResendSender } from "./resend.js";
import { NotificationOutbox, deliverOne } from "./outbox.js";
import { EmailTemplates } from "./templates.js";
import { verifyHostedDatabase } from "../portal/readiness.js";

const { environment, deployed } = readConfig();
if (deployed && process.env.TWE_NOTIFICATION_WORKER_ENABLED !== "true") throw new Error("Hosted notification delivery requires explicit worker activation.");
const config = readNotificationConfig();
if (!config) throw new Error("Notification delivery is not configured.");
const logger = createLogger("twe-notification-worker", { environment });
const pool = createDatabase(process.env, "DATABASE_URL", logger);
try {
  await verifyDatabaseIdentity(pool, { environment, organisationId: process.env.TWE_ORGANISATION_ID });
  if (deployed) await verifyHostedDatabase(pool, { environment, organisationId: process.env.TWE_ORGANISATION_ID });
  const copy = await new EmailTemplates(pool, process.env.TWE_ORGANISATION_ID).activeCopy();
  await deliverOne(new NotificationOutbox(pool, process.env.TWE_ORGANISATION_ID), new ResendSender(config, fetch, copy), logger);
} catch {
  logger.error({ eventName: "notification.worker_failed" }, "Notification worker needs operator review");
  process.exitCode = 1;
} finally { await pool.end(); }
