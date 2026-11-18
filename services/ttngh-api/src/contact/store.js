import { createHash, randomUUID } from "node:crypto";

const fingerprintOf = input => createHash("sha256")
  .update(JSON.stringify([input.name, input.email, input.topic, input.message, input.consent]))
  .digest("hex");

// Access only the dedicated TTNGH database. This store must never be exposed publicly.
export class EnquiryStore {
  constructor(pool) { this.pool = pool; }

  async create(input, { acknowledgement = true } = {}) {
    const fingerprint = fingerprintOf(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO ttngh_contact.enquiries (id,fingerprint,name,email,topic,message)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING RETURNING id`,
        [input.submissionId, fingerprint, input.name, input.email, input.topic, input.message]
      );
      if (!inserted.rowCount) {
        const existing = await client.query("SELECT fingerprint FROM ttngh_contact.enquiries WHERE id=$1", [input.submissionId]);
        if (!existing.rows[0] || existing.rows[0].fingerprint !== fingerprint) throw new Error("Submission identifier conflict");
      } else {
        await client.query(
          `INSERT INTO ttngh_contact.notification_outbox (enquiry_id,recipient_kind)
           VALUES ($1,'staff')${acknowledgement ? ",($1,'visitor')" : ""}`,
          [input.submissionId]
        );
      }
      await client.query("COMMIT");
      return { created: Boolean(inserted.rowCount) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async claim(submissionId = null) {
    // Never auto-retry after 18 hours of uncertainty: the provider's idempotency
    // window may have elapsed. Preserve the record for explicit operator review.
    await this.pool.query(
      `UPDATE ttngh_contact.notification_outbox
       SET state='review',lease_token=NULL,lease_until=NULL,updated_at=now()
       WHERE state IN ('queued','sending') AND
         (attempts >= 5 OR (first_attempt_at IS NOT NULL AND first_attempt_at < now() - interval '18 hours'))`
    );
    await this.pool.query(
      `UPDATE ttngh_contact.notification_outbox v SET state='review',updated_at=now()
       WHERE v.recipient_kind='visitor' AND v.state='queued' AND EXISTS (
         SELECT 1 FROM ttngh_contact.notification_outbox s
         WHERE s.enquiry_id=v.enquiry_id AND s.recipient_kind='staff' AND s.state='review')`
    );
    const leaseToken = randomUUID();
    const result = await this.pool.query(
      `WITH next AS (
         SELECT n.id FROM ttngh_contact.notification_outbox n
         WHERE ($2::uuid IS NULL OR n.enquiry_id=$2::uuid)
           AND (n.state='queued' OR (n.state='sending' AND n.lease_until < now()))
           AND n.attempts < 5 AND n.next_attempt_at <= now()
           AND (n.first_attempt_at IS NULL OR n.first_attempt_at >= now() - interval '18 hours')
           AND (n.recipient_kind='staff' OR EXISTS (
             SELECT 1 FROM ttngh_contact.notification_outbox s
             WHERE s.enquiry_id=n.enquiry_id AND s.recipient_kind='staff' AND s.state='sent'))
         ORDER BY n.enquiry_id, CASE WHEN n.recipient_kind='staff' THEN 0 ELSE 1 END, n.id
         FOR UPDATE OF n SKIP LOCKED LIMIT 1
       ), claimed AS (
         UPDATE ttngh_contact.notification_outbox n
         SET state='sending',lease_token=$1::uuid,lease_until=now()+interval '45 seconds',
             first_attempt_at=COALESCE(first_attempt_at,now()),
             attempts=attempts+1,updated_at=now()
         FROM next WHERE n.id=next.id
         RETURNING n.id,n.enquiry_id,n.recipient_kind,n.lease_token,n.attempts
       )
       SELECT c.*,e.name,e.email,e.topic,e.message,
              e.id AS submission_id
       FROM claimed c JOIN ttngh_contact.enquiries e ON e.id=c.enquiry_id`,
      [leaseToken,submissionId]
    );
    return result.rows[0] || null;
  }

  async sent(job, providerId) {
    const result=await this.pool.query(
      `UPDATE ttngh_contact.notification_outbox
       SET state='sent',provider_id=$3,sent_at=now(),lease_token=NULL,
           lease_until=NULL,updated_at=now()
       WHERE id=$1 AND lease_token=$2::uuid AND state='sending'`,
      [job.id,job.lease_token,providerId]
    );
    if (result.rowCount !== 1) throw new Error("Notification lease could not be completed");
  }

  async failed(job) {
    const result=await this.pool.query(
      `UPDATE ttngh_contact.notification_outbox
       SET state=CASE WHEN attempts >= 5 THEN 'review' ELSE 'queued' END,
           lease_token=NULL,lease_until=NULL,
           next_attempt_at=now()+(CASE attempts WHEN 1 THEN 1 WHEN 2 THEN 5
             WHEN 3 THEN 15 ELSE 60 END)*interval '1 minute',
           updated_at=now()
       WHERE id=$1 AND lease_token=$2::uuid AND state='sending'`,
      [job.id,job.lease_token]
    );
    if (result.rowCount !== 1) throw new Error("Notification failure lease could not be completed");
  }
}
