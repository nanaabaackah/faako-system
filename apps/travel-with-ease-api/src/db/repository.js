import { randomUUID } from "node:crypto";
import { transaction, verifyDatabaseIdentity } from "./database.js";

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
