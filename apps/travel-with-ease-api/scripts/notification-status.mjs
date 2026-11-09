// Read-only operational summary. No recipients, message bodies or credentials.
import { readConfig } from "../src/config.js";
import { createDatabase, verifyDatabaseIdentity } from "../src/db/database.js";
import { readNotificationConfig } from "../src/notifications/resend.js";
const { environment } = readConfig();
let pool;
try {
  const configured = Boolean(readNotificationConfig());
  pool = createDatabase();
  await verifyDatabaseIdentity(pool, {
    environment,
    organisationId: process.env.TWE_ORGANISATION_ID,
  });
  const counts = await pool.query(
    "SELECT status,count(*)::int AS count,min(created_at) AS oldest FROM twe.notification_outbox WHERE organisation_id=$1 GROUP BY status ORDER BY status",
    [process.env.TWE_ORGANISATION_ID],
  );
  const errors = await pool.query(
    "SELECT CASE WHEN last_error IN ('provider_rejected','delivery_configuration_changed','invalid_provider_response','delivery_failed','retry_window_expired','invalid_delivery_payload') THEN last_error ELSE 'other_redacted' END AS reason,count(*)::int AS count FROM twe.notification_outbox WHERE organisation_id=$1 AND last_error IS NOT NULL GROUP BY 1 ORDER BY 1",
    [process.env.TWE_ORGANISATION_ID],
  );
  console.log(
    JSON.stringify({
      environment,
      configured,
      workerEnabledHere: process.env.TWE_NOTIFICATION_WORKER_ENABLED === "true",
      counts: counts.rows,
      errors: errors.rows,
    }),
  );
} catch {
  console.error(
    "Notification status unavailable. Verify environment, database identity, runtime grants and notification configuration. No data was changed.",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
