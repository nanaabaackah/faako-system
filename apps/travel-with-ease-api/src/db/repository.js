import { randomUUID } from "node:crypto";
import { transaction, verifyDatabaseIdentity } from "./database.js";
import { DETAILED_FORM_ID } from "../enquiries/questionnaires/configuration.js";
import { QUESTIONNAIRE_VERSION } from "../enquiries/questionnaires/index.js";
import { INTAKE_FORM_ID, INTAKE_BASELINE_VERSION } from "../enquiries/intake-definition.js";
import { continuationRecord, replayContinuation, submissionRecord, replaySubmission } from "../enquiries/submission.js";

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
      if (!data.questionnaireId) {
        // Shared lock serializes new intake submissions with activation. Keep
        // replay checks above this gate so accepted retries still work.
        await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended($1, 0))", [`twe-intake:${this.organisationId}`]);
        const { rows } = await client.query("SELECT active_version FROM twe.enquiry_form_drafts WHERE organisation_id=$1 AND form_id=$2", [this.organisationId, INTAKE_FORM_ID]);
        if ((data.intakeVersion ?? INTAKE_BASELINE_VERSION) !== (rows[0]?.active_version ?? INTAKE_BASELINE_VERSION)) {
          throw Object.assign(new Error("Outdated enquiry form."), { code: "intake_version_changed" });
        }
      }
      if (!data.questionnaireId) {
        await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended($1, 0))", [`twe-detailed:${this.organisationId}`]);
        const { rows } = await client.query("SELECT active_version FROM twe.enquiry_form_drafts WHERE organisation_id=$1 AND form_id=$2", [this.organisationId, DETAILED_FORM_ID]);
        // Baseline retains the old wire contract; later versions are pinned
        // at intake creation and are never chosen by the visitor.
        record.details.pinnedQuestionnaireVersion = rows[0]?.active_version > 1 ? `cms.${rows[0].active_version}` : QUESTIONNAIRE_VERSION;
      }
      await client.query(
        `INSERT INTO twe.enquiries (id, organisation_id, kind, contact, details, notice_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [record.id, this.organisationId, record.kind, record.contact, record.details, record.noticeAt]);
      await client.query(
        "INSERT INTO twe.notification_outbox (id, organisation_id, enquiry_id) VALUES ($1, $2, $3)",
        [randomUUID(), this.organisationId, record.id]);
      return { inquiryId: record.id, status: "received", replayed: false };
    });
  }

  async continuationContext(enquiryId) {
    const { rows } = await this.pool.query(
      `SELECT id, contact, details FROM twe.enquiries
       WHERE organisation_id = $1 AND id = $2`,
      [this.organisationId, enquiryId]);
    const row = rows[0];
    if (!row || !["website_intake", "website_progressive_enquiry"].includes(row.details?.source) || row.details?.questionnaireCompletedAt) return null;
    return {
      inquiryId: row.id,
      contact: row.contact,
      entryType: row.details.entryType || "general",
      questionnaireVersion: row.details.pinnedQuestionnaireVersion || QUESTIONNAIRE_VERSION,
      context: {
        ...(row.details.selectedServiceId && row.details.selectedServiceTitle ? {
          serviceId: row.details.selectedServiceId, serviceTitle: row.details.selectedServiceTitle,
        } : {}),
        ...(row.details.selectedPackageId && row.details.selectedPackageTitle ? {
          packageId: row.details.selectedPackageId, packageTitle: row.details.selectedPackageTitle,
        } : {}),
      },
    };
  }

  async completeEnquiryContinuation(enquiryId, data) {
    return transaction(this.pool, async (client) => {
      const { rows } = await client.query(
        `SELECT id, details FROM twe.enquiries
         WHERE organisation_id = $1 AND id = $2 FOR UPDATE`,
        [this.organisationId, enquiryId]);
      const prior = rows[0];
      if (!prior || !["website_intake", "website_progressive_enquiry"].includes(prior.details?.source)) {
        const error = new Error("Enquiry continuation is unavailable.");
        error.code = "enquiry_continuation_unavailable";
        throw error;
      }
      if (data.questionnaireVersion !== (prior.details.pinnedQuestionnaireVersion || QUESTIONNAIRE_VERSION)) {
        throw Object.assign(new Error("Questionnaire version mismatch."), { code: "enquiry_continuation_unavailable" });
      }
      const expectedContext = {
        ...(prior.details.selectedServiceId && prior.details.selectedServiceTitle ? { serviceId: prior.details.selectedServiceId, serviceTitle: prior.details.selectedServiceTitle } : {}),
        ...(prior.details.selectedPackageId && prior.details.selectedPackageTitle ? { packageId: prior.details.selectedPackageId, packageTitle: prior.details.selectedPackageTitle } : {}),
      };
      if (!prior.details.questionnaireCompletedAt && ((prior.details.entryType || "general") !== data.entryType ||
        Object.keys({ ...expectedContext, ...data.context }).some(key => expectedContext[key] !== data.context[key]))) {
        throw Object.assign(new Error("Questionnaire context mismatch."), { code: "enquiry_continuation_unavailable" });
      }
      const next = continuationRecord(prior.details, data);
      if (prior.details.questionnaireCompletedAt) return replayContinuation(prior, data.submissionId, next.fingerprint);
      await client.query(
        `UPDATE twe.enquiries SET kind = $3, contact = $4, details = $5, updated_at = now()
         WHERE organisation_id = $1 AND id = $2`,
        [this.organisationId, enquiryId, next.kind, next.contact, next.details]);
      return { inquiryId: enquiryId, status: "completed", replayed: false };
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
