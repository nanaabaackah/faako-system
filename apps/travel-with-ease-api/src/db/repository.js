import { randomUUID } from "node:crypto";
import { transaction, verifyDatabaseIdentity } from "./database.js";
import { submissionRecord, replaySubmission } from "../enquiries/submission.js";

export class PostgresLeadRepository {
  constructor(pool, { organisationId, environment }) {
    if (!organisationId) throw new Error("Server-owned organisation scope is required.");
    this.pool = pool;
    this.organisationId = organisationId;
    this.environment = environment;
  }

  async ready() {
    await verifyDatabaseIdentity(this.pool, { environment: this.environment, organisationId: this.organisationId });
    const { rows } = await this.pool.query("SELECT id FROM twe.organisations WHERE id = $1", [this.organisationId]);
    if (!rows.length) throw new Error("Organisation is not provisioned.");
  }

  async createNativeEnquiry(data) {
    const record = submissionRecord(data);
    return transaction(this.pool, async client => {
      // Serialize only this tenant/submission pair. No new table or destructive
      // migration: idempotency metadata is stored in the existing JSON details.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        [this.organisationId, record.submissionId]);
      const prior = await client.query(
        "SELECT id, details->>'submissionFingerprint' AS fingerprint FROM twe.enquiries WHERE organisation_id = $1 AND details->>'submissionId' = $2",
        [this.organisationId, record.submissionId]);
      if (prior.rows[0]) return replaySubmission(prior.rows[0], record.fingerprint);
      await client.query(
        `INSERT INTO twe.enquiries (id, organisation_id, kind, contact, details, notice_at)
         VALUES ($1, $2, 'personalised', $3, $4, $5)`,
        [record.id, this.organisationId, record.contact, record.details, record.noticeAt]);
      await client.query(
        "INSERT INTO twe.notification_outbox (id, organisation_id, enquiry_id) VALUES ($1, $2, $3)",
        [randomUUID(), this.organisationId, record.id]);
      return { inquiryId: record.id, status: "received", replayed: false };
    });
  }

  // Compatibility adapter for the deferred estimator. New enquiry screens and
  // delivery workers are deliberately not part of this adapter.
  async createLeadWithInquiry(record) {
    return transaction(this.pool, async (client) => {
      await client.query(`INSERT INTO twe.enquiries
        (id, organisation_id, kind, contact, details, notice_at, created_at, updated_at)
        VALUES ($1, $2, 'legacy_estimator', $3, $4, $5, $6, $6)`,
      [record.inquiry.id, this.organisationId, record.contact,
        { legacyLeadId: record.id, inquiry: record.inquiry }, record.inquiry.consentAt, record.createdAt]);
      await client.query(`INSERT INTO twe.notification_outbox (id, organisation_id, enquiry_id)
        VALUES ($1, $2, $3)`, [randomUUID(), this.organisationId, record.inquiry.id]);
      return record;
    });
  }

  async listLeads() {
    const { rows } = await this.pool.query(`SELECT id, status, contact, details, created_at, updated_at
      FROM twe.enquiries WHERE organisation_id = $1 AND kind = 'legacy_estimator'
      ORDER BY created_at DESC, id DESC LIMIT 100`, [this.organisationId]);
    return rows.map((row) => ({
      id: row.details.legacyLeadId, stage: row.status, contact: row.contact,
      inquiry: row.details.inquiry, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    }));
  }
}
