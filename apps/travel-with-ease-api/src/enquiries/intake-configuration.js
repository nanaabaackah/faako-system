import { Router } from "express";
import { z } from "zod";
import { createSuccessResponse, createErrorResponse } from "@faako/api-contracts";
import { hasPermission } from "../auth/permissions.js";
import { transaction } from "../db/database.js";
import { appendAudit } from "../audit.js";
import { ContentError } from "../content/schema.js";
import { INTAKE_FORM_ID, INTAKE_BASELINE_VERSION, defaultIntakeDefinition, intakeDefinitionSchema } from "./intake-definition.js";

import { DETAILED_FORM_ID, DETAILED_BASELINE_VERSION, defaultDetailedDefinition, detailedDefinitionSchema } from "./questionnaires/configuration.js";

const forms = Object.freeze({
  [INTAKE_FORM_ID]: { baseline: INTAKE_BASELINE_VERSION, defaults: defaultIntakeDefinition, schema: intakeDefinitionSchema, lock: "twe-intake" },
  [DETAILED_FORM_ID]: { baseline: DETAILED_BASELINE_VERSION, defaults: defaultDetailedDefinition, schema: detailedDefinitionSchema, lock: "twe-detailed" },
});

const revisionSchema = z.number().int().min(0).max(2147483646);
const versionSchema = z.number().int().min(1).max(2147483646);
const unavailable = () => new ContentError(404, "not_found", "Form version is unavailable.");

export class IntakeConfiguration {
  constructor(pool, organisationId, formId = INTAKE_FORM_ID) {
    if (!Object.hasOwn(forms, formId)) throw new Error("Unsupported enquiry form.");
    this.formId = formId;
    this.config = forms[formId];
    this.pool = pool;
    this.organisationId = organisationId;
  }
  check(actor, publish = false) {
    if (!hasPermission(actor, publish ? "content.publish" : "content.write", this.organisationId))
      throw new ContentError(403, "permission_error", "Form configuration access denied.");
  }
  async get(actor) {
    this.check(actor);
    const { rows } = await this.pool.query(
      "SELECT revision,active_version,draft FROM twe.enquiry_form_drafts WHERE organisation_id=$1 AND form_id=$2",
      [this.organisationId, this.formId],
    );
    const row = rows[0];
    return { formId: this.formId, revision: row?.revision ?? 0, activeVersion: row?.active_version ?? this.config.baseline,
      draft: this.config.schema.parse(row?.draft ?? this.config.defaults()) };
  }
  // The version is resolved only from server-owned activated rows. A submitted
  // version can outlive a newer activation; drafts are never public.
  async version(version, client = this.pool) {
    versionSchema.parse(version);
    const { rows } = await client.query(
      "SELECT definition FROM twe.enquiry_form_versions WHERE organisation_id=$1 AND form_id=$2 AND version=$3",
      [this.organisationId, this.formId, version],
    );
    if (!rows[0] && version !== this.config.baseline) throw unavailable();
    return { formId: this.formId, version, definition: this.config.schema.parse(rows[0]?.definition ?? this.config.defaults()) };
  }
  async active() {
    const { rows } = await this.pool.query(
      "SELECT active_version FROM twe.enquiry_form_drafts WHERE organisation_id=$1 AND form_id=$2",
      [this.organisationId, this.formId],
    );
    return this.version(rows[0]?.active_version ?? this.config.baseline);
  }
  async history(actor) {
    this.check(actor);
    const { rows } = await this.pool.query(
      "SELECT version,activated_at FROM twe.enquiry_form_versions WHERE organisation_id=$1 AND form_id=$2 ORDER BY version DESC LIMIT 50",
      [this.organisationId, this.formId],
    );
    return rows.length ? rows : [{ version: this.config.baseline, activated_at: null }];
  }
  async change(actor, requestId, expectedRevision, definition, action = "draft") {
    this.check(actor, action === "activate");
    revisionSchema.parse(expectedRevision);
    const validated = action === "activate" ? null : this.config.schema.parse(definition);
    return transaction(this.pool, async client => {
      if (action === "activate") await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${this.config.lock}:${this.organisationId}`]);
      await client.query(
        "INSERT INTO twe.enquiry_form_drafts (organisation_id,form_id,updated_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [this.organisationId, this.formId, actor.id],
      );
      const { rows: [row] } = await client.query(
        "SELECT revision,active_version,draft FROM twe.enquiry_form_drafts WHERE organisation_id=$1 AND form_id=$2 FOR UPDATE",
        [this.organisationId, this.formId],
      );
      if (row.revision !== expectedRevision) throw new ContentError(409, "conflict", "This form changed. Reload before saving.");
      // Freeze the original definition on first edit, including its version.
      await client.query(
        "INSERT INTO twe.enquiry_form_versions (organisation_id,form_id,version,definition,activated_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [this.organisationId, this.formId, this.config.baseline, this.config.defaults(), actor.id],
      );
      const draft = action === "activate" ? this.config.schema.parse(row.draft ?? this.config.defaults()) : validated;
      const nextVersion = action === "activate" ? row.active_version + 1 : row.active_version;
      if (action === "activate") {
        versionSchema.parse(nextVersion);
        await client.query(
          "INSERT INTO twe.enquiry_form_versions (organisation_id,form_id,version,definition,activated_by) VALUES ($1,$2,$3,$4,$5)",
          [this.organisationId, this.formId, nextVersion, draft, actor.id],
        );
      }
      const { rows: [updated] } = await client.query(
        "UPDATE twe.enquiry_form_drafts SET revision=revision+1,active_version=$3,draft=$4,updated_by=$5,updated_at=now() WHERE organisation_id=$1 AND form_id=$2 RETURNING revision,active_version,draft",
        [this.organisationId, this.formId, nextVersion, draft, actor.id],
      );
      await appendAudit(client, { organisationId: this.organisationId, actorId: actor.id, requestId, action: "enquiry_form." + (this.formId === DETAILED_FORM_ID ? "detailed." : "") + action });
      return { formId: this.formId, revision: updated.revision, activeVersion: updated.active_version, draft: updated.draft };
    });
  }
  async restore(actor, requestId, expectedRevision, version) {
    this.check(actor);
    const snapshot = await this.version(version);
    return this.change(actor, requestId, expectedRevision, snapshot.definition, "restored");
  }
}

export function intakeConfigurationRoutes(service, auth) {
  const router = Router();
  router.use(auth.requirePermission("content.write"));
  const send = (req, res, data) => res.json(createSuccessResponse(data, { requestId: req.requestId }));
  router.get("/", async (req, res) => send(req, res, await service.get(req.staff)));
  router.get("/history", async (req, res) => send(req, res, { items: await service.history(req.staff) }));
  router.post("/draft", auth.requireMutation, async (req, res) => {
    const { expectedRevision, definition } = z.object({ expectedRevision: revisionSchema, definition: service.config.schema }).strict().parse(req.body);
    send(req, res, await service.change(req.staff, req.requestId, expectedRevision, definition));
  });
  router.post("/activate", auth.requireMutation, auth.requirePermission("content.publish"), async (req, res) => {
    const { expectedRevision } = z.object({ expectedRevision: revisionSchema }).strict().parse(req.body);
    send(req, res, await service.change(req.staff, req.requestId, expectedRevision, null, "activate"));
  });
  router.post("/restore", auth.requireMutation, async (req, res) => {
    const { expectedRevision, version } = z.object({ expectedRevision: revisionSchema, version: versionSchema }).strict().parse(req.body);
    send(req, res, await service.restore(req.staff, req.requestId, expectedRevision, version));
  });
  router.use((error, req, res, next) => {
    if (!(error instanceof z.ZodError) && !(error instanceof ContentError)) return next(error);
    res.status(error.status || 400).json(createErrorResponse({
      code: error.code || "validation_error", message: error instanceof z.ZodError ? "Check the form configuration." : error.message,
    }, { requestId: req.requestId }));
  });
  return router;
}
