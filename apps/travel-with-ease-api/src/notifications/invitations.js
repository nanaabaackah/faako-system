import { randomUUID } from "node:crypto";
import { transaction } from "../db/database.js";
import { invitationEmailCode, invitationEmailTestRecipient } from "../onboarding/invitation-email.js";
import { invitationTemplate } from "./enquiry-template.js";

const safeReason = (error) =>
  ["provider_rejected", "invalid_provider_response", "delivery_configuration_changed"].includes(error?.message)
    ? error.message : "delivery_failed";

export class InvitationDeliveryOutbox {
  constructor(pool, organisationId, environment) {
    Object.assign(this, { pool, organisationId, environment });
  }

  async claim(templateCopy) {
    return transaction(this.pool, async (client) => {
      // A revoked, accepted, or expired invitation must never be newly emailed.
      await client.query(`
        UPDATE twe.staff_invitation_deliveries d
        SET status='cancelled', lease_token=NULL, lease_until=NULL, last_error='invitation_unavailable'
        FROM twe.staff_invitations i
        WHERE d.organisation_id=$1 AND d.environment=$2 AND i.id=d.invitation_id
          AND d.status IN ('pending','processing')
          AND (i.revoked_at IS NOT NULL OR i.accepted_at IS NOT NULL OR i.expires_at<=now())
          AND (d.lease_until IS NULL OR d.lease_until<=now())`,
        [this.organisationId, this.environment]);
      await client.query(`
        UPDATE twe.staff_invitation_deliveries
        SET status='failed', lease_token=NULL, lease_until=NULL, last_error='retry_window_expired'
        WHERE organisation_id=$1 AND environment=$2 AND status IN ('pending','processing')
          AND (lease_until IS NULL OR lease_until<=now())
          AND (attempts>=5 OR first_attempt_at<now()-interval '23 hours')`,
        [this.organisationId, this.environment]);

      const result = await client.query(`
        WITH candidate AS (
          SELECT d.invitation_id FROM twe.staff_invitation_deliveries d
          JOIN twe.staff_invitations i ON i.id=d.invitation_id
          WHERE d.organisation_id=$1 AND d.environment=$2
            AND i.organisation_id=$1 AND i.environment=$2
            AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>now()
            AND ((d.status='pending' AND d.available_at<=now())
              OR (d.status='processing' AND d.lease_until<=now()))
          ORDER BY d.created_at, d.invitation_id FOR UPDATE OF d SKIP LOCKED LIMIT 1
        )
        UPDATE twe.staff_invitation_deliveries d
        SET status='processing', attempts=d.attempts+1, lease_token=$3,
            lease_until=now()+interval '1 minute',
            first_attempt_at=COALESCE(d.first_attempt_at,now()),
            template_snapshot=COALESCE(d.template_snapshot,$4::jsonb)
        FROM candidate c, twe.staff_invitations i
        WHERE d.invitation_id=c.invitation_id AND i.id=d.invitation_id
        RETURNING d.*,i.subject,i.role,i.expires_at`,
        [this.organisationId, this.environment, randomUUID(), JSON.stringify(templateCopy)]);
      return result.rows[0];
    });
  }

  async isStillValid(job) {
    const { rows } = await this.pool.query(`
      SELECT 1 FROM twe.staff_invitations
      WHERE id=$1 AND organisation_id=$2 AND environment=$3 AND subject=$4
        AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()`,
      [job.invitation_id, this.organisationId, this.environment, job.subject]);
    return rows.length === 1;
  }

  async finish(job, providerId) {
    const result = await this.pool.query(`
      UPDATE twe.staff_invitation_deliveries
      SET status='sent', provider_id=$3, last_error=NULL, lease_token=NULL,lease_until=NULL
      WHERE invitation_id=$1 AND organisation_id=$2 AND status='processing' AND lease_token=$4`,
      [job.invitation_id, this.organisationId, providerId, job.lease_token]);
    return result.rowCount === 1;
  }

  async fail(job, reason) {
    await this.pool.query(`
      UPDATE twe.staff_invitation_deliveries
      SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,
        available_at=now()+interval '1 minute'*power(2,attempts),
        lease_token=NULL,lease_until=NULL,last_error=$4
      WHERE invitation_id=$1 AND organisation_id=$2 AND status='processing' AND lease_token=$3`,
      [job.invitation_id, this.organisationId, job.lease_token, reason]);
  }

  async cancel(job) {
    await this.pool.query(`
      UPDATE twe.staff_invitation_deliveries
      SET status='cancelled', lease_token=NULL,lease_until=NULL,last_error='invitation_unavailable'
      WHERE invitation_id=$1 AND organisation_id=$2 AND status='processing' AND lease_token=$3`,
      [job.invitation_id, this.organisationId, job.lease_token]);
  }
}

export class InvitationEmailSender {
  constructor(config, deliveryConfig, portalOrigin, fetcher = fetch) {
    Object.assign(this, { config, deliveryConfig, portalOrigin, fetcher });
  }

  payload(job) {
    const production = this.config.environment === "production";
    if (job.environment !== this.config.environment || !job.template_snapshot ||
        typeof job.recipient_email !== "string" || job.recipient_email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.recipient_email) || !job.subject)
      throw new Error("delivery_configuration_changed");
    const code = invitationEmailCode(this.deliveryConfig, {
      id: job.invitation_id, organisationId: job.organisation_id,
      environment: job.environment, subject: job.subject,
    });
    // Code is never persisted as plaintext in the queue or provider logs.
    const mail = invitationTemplate({
      copy: job.template_snapshot, code,
      role: job.role, expiresAt: job.expires_at, portalOrigin: this.portalOrigin,
    });
    return {
      from: this.config.from,
      to: [production ? job.recipient_email : invitationEmailTestRecipient],
      ...mail,
    };
  }

  async send(job) {
    const payload = this.payload(job);
    if (payload.to.length !== 1 || typeof payload.to[0] !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.to[0]) ||
        payload.from !== this.config.from || "cc" in payload || "bcc" in payload ||
        (this.config.environment !== "production" && payload.to[0] !== invitationEmailTestRecipient))
      throw new Error("delivery_configuration_changed");
    const response = await this.fetcher("https://api.resend.com/emails", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `twe-${this.config.environment}-invitation-${job.invitation_id}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("provider_rejected");
    const result = await response.json();
    if (typeof result.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(result.id))
      throw new Error("invalid_provider_response");
    return result.id;
  }
}

export async function deliverOneInvitation(outbox, sender, templateCopy, logger) {
  const job = await outbox.claim(templateCopy);
  if (!job) return false;
  try {
    if (!(await outbox.isStillValid(job))) {
      await outbox.cancel(job);
      return true;
    }
    const providerId = await sender.send(job);
    if (!(await outbox.finish(job, providerId))) {
      logger?.warn({ eventName: "invitation.delivery_lease_lost", invitationId: job.invitation_id },
        "Invitation delivery requires reconciliation");
    }
  } catch (error) {
    const reason = safeReason(error);
    await outbox.fail(job, reason);
    logger?.warn({ eventName: "invitation.delivery_failed", invitationId: job.invitation_id, reason },
      "Invitation email follows bounded retry policy");
  }
  return true;
}
