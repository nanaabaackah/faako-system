import { readConfig } from "../config.js";
import { createDatabase, verifyDatabaseIdentity } from "../db/database.js";
import { createLogger } from "@faako/logger";
import { readNotificationConfig, ResendSender } from "./resend.js";
import { NotificationOutbox, deliverOne } from "./outbox.js";
import { EmailTemplates } from "./templates.js";
import { verifyHostedDatabase } from "../portal/readiness.js";
import { runNotificationLoop } from "./loop.js";
import { InvitationDeliveryOutbox, InvitationEmailSender, deliverOneInvitation } from "./invitations.js";
import { readInvitationDeliveryConfig, readInvitationPortalOrigin } from "../onboarding/invitation-email.js";
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
let invitationConfig = null;
let invitationPortalOrigin = null;
try {
  invitationConfig = readInvitationDeliveryConfig(process.env);
  invitationPortalOrigin = invitationConfig ? readInvitationPortalOrigin(process.env) : null;
} catch {
  // Invalid optional invitation settings must not interrupt customer enquiry
  // acknowledgements. Never log secret contents or portal configuration values.
  invitationConfig = null;
  invitationPortalOrigin = null;
  logger.error({ eventName: "invitation.delivery_configuration_invalid" },
    "Optional staff invitation delivery disabled; review its environment configuration");
}
const pool = createDatabase(process.env, "DATABASE_URL", logger);
try {
  await verifyDatabaseIdentity(pool, { environment, organisationId: process.env.TWE_ORGANISATION_ID });
  if (deployed) await verifyHostedDatabase(pool, { environment, organisationId: process.env.TWE_ORGANISATION_ID });
  const templates = new EmailTemplates(pool, process.env.TWE_ORGANISATION_ID);
  const outbox = new NotificationOutbox(pool, process.env.TWE_ORGANISATION_ID);
  const invitationOutbox = invitationConfig
    ? new InvitationDeliveryOutbox(pool, process.env.TWE_ORGANISATION_ID, environment) : null;
  const invitationSender = invitationConfig
    ? new InvitationEmailSender(config, invitationConfig, invitationPortalOrigin) : null;
  const tick = async () => {
    // Preserve customer acknowledgement delivery even when optional staff
    // invitation processing is unconfigured or needs a manual repair.
    const enquiryAttempted = await deliverOne(outbox, new ResendSender(config, fetch, (enquiry, client) => templates.activeForEnquiry(enquiry, client), continuationLinks), logger);
    let invitationAttempted = false;
    if (invitationOutbox) {
      try {
        const invitationCopy = await templates.activeCopy("staff-invitation");
        invitationAttempted = await deliverOneInvitation(invitationOutbox, invitationSender, invitationCopy, logger);
      } catch {
        logger.warn({ eventName: "invitation.delivery_unavailable" },
          "Invitation delivery needs operator review; enquiry acknowledgements remain active");
      }
    }
    return invitationAttempted || enquiryAttempted;
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
