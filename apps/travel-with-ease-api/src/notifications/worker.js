import { readConfig, assertLocalFoundation } from "../config.js";
import { createDatabase, verifyDatabaseIdentity } from "../db/database.js";
import { createLogger } from "@faako/logger";
import { readNotificationConfig, ResendSender } from "./resend.js";
import { NotificationOutbox, deliverOne } from "./outbox.js";
import { EmailTemplates } from "./templates.js";

const { environment } = readConfig();
assertLocalFoundation(environment);
const config = readNotificationConfig();
if (!config) throw new Error("Notification delivery is not configured.");
const logger = createLogger("twe-notification-worker", { environment });
const pool = createDatabase(process.env, "DATABASE_URL", logger);
try {
  await verifyDatabaseIdentity(pool, { environment, organisationId: process.env.TWE_ORGANISATION_ID });
  const copy = await new EmailTemplates(pool, process.env.TWE_ORGANISATION_ID).activeCopy();
  await deliverOne(new NotificationOutbox(pool, process.env.TWE_ORGANISATION_ID), new ResendSender(config, fetch, copy), logger);
} catch {
  logger.error({ eventName: "notification.worker_failed" }, "Notification worker needs operator review");
  process.exitCode = 1;
} finally { await pool.end(); }
