import { randomUUID } from "node:crypto";
import { transaction } from "../db/database.js";

export class NotificationOutbox {
  constructor(pool, organisationId) { this.pool = pool; this.organisationId = organisationId; }
  async claim(payload) {
    return transaction(this.pool, async (client) => {
      // Never retry an ambiguous send outside the provider's 24-hour dedup window.
      await client.query(`UPDATE twe.notification_outbox SET status = 'failed', last_error = 'retry_window_expired', lease_token = NULL, lease_until = NULL
        WHERE organisation_id = $1 AND status IN ('pending', 'processing')
        AND (lease_until IS NULL OR lease_until <= now())
        AND (attempts >= 5 OR first_attempt_at < now() - interval '23 hours')`, [this.organisationId]);
      const { rows } = await client.query(`WITH candidate AS (
        SELECT id FROM twe.notification_outbox WHERE organisation_id = $1 AND
        ((status = 'pending' AND available_at <= now()) OR (status = 'processing' AND lease_until <= now()))
        ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1
      ) UPDATE twe.notification_outbox o SET status = 'processing', attempts = attempts + 1,
        lease_token = $2, lease_until = now() + interval '1 minute', first_attempt_at = COALESCE(first_attempt_at, now()),
        delivery_payload = COALESCE(delivery_payload, $3::jsonb)
        FROM candidate WHERE o.id = candidate.id RETURNING o.*`, [this.organisationId, randomUUID(), JSON.stringify(payload)]);
      return rows[0];
    });
  }
  async finish(job, providerId) {
    const result = await this.pool.query(`UPDATE twe.notification_outbox SET status = 'sent', provider_id = $1,
      lease_until = NULL, lease_token = NULL, last_error = NULL WHERE organisation_id = $2 AND id = $3
      AND status = 'processing' AND lease_token = $4`, [providerId, this.organisationId, job.id, job.lease_token]);
    return result.rowCount === 1;
  }
  async fail(job) {
    await this.pool.query(`UPDATE twe.notification_outbox SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
      available_at = now() + interval '1 minute' * power(2, attempts), lease_until = NULL, lease_token = NULL,
      last_error = 'delivery_failed' WHERE organisation_id = $1 AND id = $2 AND status = 'processing' AND lease_token = $3`, [this.organisationId, job.id, job.lease_token]);
  }
}

export async function deliverOne(outbox, sender, logger) {
  const job = await outbox.claim(sender.payload());
  if (!job) return false;
  try {
    const providerId = await sender.send(job);
    if (!await outbox.finish(job, providerId)) logger?.warn({ eventName: "notification.lease_lost", jobId: job.id }, "Notification needs reconciliation");
  } catch {
    await outbox.fail(job);
    logger?.warn({ eventName: "notification.failed", jobId: job.id }, "Notification will follow bounded retry policy");
  }
  return true;
}
