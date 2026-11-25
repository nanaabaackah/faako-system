import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@faako/api-contracts";
import { hasPermission } from "../auth/permissions.js";
import { transaction } from "../db/database.js";
import { appendAudit } from "../audit.js";
import { ContentError } from "../content/schema.js";
import {
  defaultTemplateCopies,
  renderEmailTemplate,
} from "./template-catalogue.js";

const singleLine = (max) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) =>
      [...value].every((character) => character.charCodeAt(0) >= 32),
    );
export const templateCopySchema = z
  .object({
    subject: singleLine(160),
    heading: singleLine(160),
    message: z.string().trim().min(1).max(3000),
    ctaLabel: singleLine(60),
  })
  .strict();
const versionSchema = z.number().int().min(0).max(2147483646);
const defaultSlug = "enquiry-acknowledgement";
export const templateSlugSchema = z.enum([
  "enquiry-acknowledgement",
  "staff-invitation",
]);

export class EmailTemplates {
  constructor(pool, organisationId, testSenderFactory = null) {
    this.pool = pool;
    this.organisationId = organisationId;
    this.testSenderFactory = testSenderFactory;
  }
  check(actor) {
    if (!hasPermission(actor, "templates.manage", this.organisationId))
      throw new ContentError(
        403,
        "permission_error",
        "Template access denied.",
      );
  }
  async get(actor, templateSlug = defaultSlug) {
    this.check(actor);
    const slug = templateSlugSchema.parse(templateSlug);
    const defaultCopy = defaultTemplateCopies[slug];
    const { rows } = await this.pool.query(
      "SELECT version,draft,active,active_version FROM twe.email_templates WHERE organisation_id=$1 AND slug=$2",
      [this.organisationId, slug],
    );
    return {
      ...(rows[0] || {
        version: 0,
        active_version: null,
      }),
      draft: rows[0]?.draft || defaultCopy,
      active: rows[0]?.active || defaultCopy,
    };
  }
  async history(actor, templateSlug = defaultSlug) {
    this.check(actor);
    const slug = templateSlugSchema.parse(templateSlug);
    const { rows } = await this.pool.query(
      "SELECT version,kind,copy,created_at FROM twe.email_template_revisions WHERE organisation_id=$1 AND slug=$2 ORDER BY version DESC LIMIT 50",
      [this.organisationId, slug],
    );
    return rows;
  }
  async restore(actor, requestId, expectedVersion, revision, templateSlug = defaultSlug) {
    this.check(actor);
    const slug = templateSlugSchema.parse(templateSlug);
    versionSchema.parse(revision);
    const { rows } = await this.pool.query(
      "SELECT copy FROM twe.email_template_revisions WHERE organisation_id=$1 AND slug=$2 AND version=$3",
      [this.organisationId, slug, revision],
    );
    if (!rows[0]) throw new ContentError(404, "not_found", "Template revision not found.");
    return this.change(actor, requestId, expectedVersion, rows[0].copy, false, slug, revision);
  }
  async sendTest(actor, requestId, copy, templateSlug = defaultSlug) {
    this.check(actor);
    const slug = templateSlugSchema.parse(templateSlug);
    const validated = templateCopySchema.parse(copy);
    const sender = this.testSenderFactory?.();
    if (!sender) throw new ContentError(503, "service_unavailable", "Test email delivery is not configured.");
    const attemptId = randomUUID();
    // Persist the attempt before contacting the provider. A tenant-wide lock
    // prevents concurrent requests bypassing the shared rate limit.
    await transaction(this.pool, async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`twe-template-test:${this.organisationId}`]);
      const { rows } = await client.query(
        "SELECT count(*) FILTER (WHERE created_at > now() - interval '1 minute')::int AS recent, count(*)::int AS hourly FROM twe.audit_records WHERE organisation_id=$1 AND action='email_template.test_requested' AND created_at > now() - interval '1 hour'",
        [this.organisationId],
      );
      if (rows[0].recent >= 1 || rows[0].hourly >= 10) throw new ContentError(429, "rate_limited", "Test email limit reached. Try again later.");
      await appendAudit(client, { organisationId: this.organisationId, actorId: actor.id, action: "email_template.test_requested", recordId: attemptId, requestId });
    });
    try {
      await sender.sendTemplateTest(slug, validated, attemptId);
    } catch {
      // The provider may have accepted an unacknowledged request. No retry.
      throw new ContentError(503, "service_unavailable", "Test delivery was not confirmed. Check the test inbox before sending again.");
    }
    return { status: "provider_accepted", recipient: "testing@travelwitheasegh.com" };
  }
  async activeCopy(templateSlug = defaultSlug) {
    const slug = templateSlugSchema.parse(templateSlug);
    const { rows } = await this.pool.query(
      "SELECT active FROM twe.email_templates WHERE organisation_id=$1 AND slug=$2",
      [this.organisationId, slug],
    );
    return templateCopySchema.parse(
      rows[0]?.active || defaultTemplateCopies[slug],
    );
  }
  async change(
    actor,
    requestId,
    expectedVersion,
    copy,
    activate = false,
    templateSlug = defaultSlug,
    restoredFrom = null,
  ) {
    this.check(actor);
    const slug = templateSlugSchema.parse(templateSlug);
    versionSchema.parse(expectedVersion);
    const validated = activate ? null : templateCopySchema.parse(copy);
    return transaction(this.pool, async (client) => {
      await client.query(
        "INSERT INTO twe.email_templates (organisation_id,slug,updated_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [this.organisationId, slug, actor.id],
      );
      const {
        rows: [row],
      } = await client.query(
        "SELECT version,draft FROM twe.email_templates WHERE organisation_id=$1 AND slug=$2 FOR UPDATE",
        [this.organisationId, slug],
      );
      if (row.version !== expectedVersion)
        throw new ContentError(
          409,
          "conflict",
          "This template changed. Reload before saving.",
        );
      if (activate && !row.draft)
        throw new ContentError(
          409,
          "conflict",
          "Save a draft before activating it.",
        );
      const result = activate
        ? await client.query(
            "UPDATE twe.email_templates SET active=draft,active_version=version,version=version+1,updated_by=$3,updated_at=now() WHERE organisation_id=$1 AND slug=$2 RETURNING version,draft,active,active_version",
            [this.organisationId, slug, actor.id],
          )
        : await client.query(
            "UPDATE twe.email_templates SET draft=$3,version=version+1,updated_by=$4,updated_at=now() WHERE organisation_id=$1 AND slug=$2 RETURNING version,draft,active,active_version",
            [this.organisationId, slug, validated, actor.id],
          );
      await client.query(
        "INSERT INTO twe.email_template_revisions (organisation_id,slug,version,kind,copy,created_by) VALUES ($1,$2,$3,$4,$5,$6)",
        [this.organisationId, slug, result.rows[0].version, activate ? "activated" : restoredFrom !== null ? "restored" : "draft", result.rows[0].draft, actor.id],
      );
      await appendAudit(client, {
        organisationId: this.organisationId,
        actorId: actor.id,
        action:
          restoredFrom !== null ? "email_template.restored" : slug === "staff-invitation"
            ? activate
              ? "email_template.staff_invitation.approved"
              : "email_template.staff_invitation.saved"
            : activate
              ? "email_template.activated"
              : "email_template.saved",
        recordId: null,
        requestId,
      });
      return {
        ...result.rows[0],
        active: result.rows[0].active || defaultTemplateCopies[slug],
      };
    });
  }
}

export function emailTemplateRoutes(service, auth) {
  const router = Router();
  router.use(auth.requirePermission("templates.manage"));
  const send = (req, res, data) =>
    res.json(createSuccessResponse(data, { requestId: req.requestId }));
  router.get(["/", "/:slug"], async (req, res) =>
    send(req, res, await service.get(req.staff, req.params.slug)),
  );
  router.get("/:slug/history", async (req, res) =>
    send(req, res, { items: await service.history(req.staff, req.params.slug) }),
  );
  router.post("/:slug/test", auth.requireMutation, async (req, res) => {
    send(req, res, await service.sendTest(req.staff, req.requestId, templateCopySchema.parse(req.body), req.params.slug));
  });
  router.post("/:slug/restore", auth.requireMutation, async (req, res) => {
    const input = z.object({ expectedVersion: versionSchema, revision: versionSchema }).strict().parse(req.body);
    send(req, res, await service.restore(req.staff, req.requestId, input.expectedVersion, input.revision, req.params.slug));
  });
  router.post(
    ["/preview", "/:slug/preview"],
    auth.requireMutation,
    async (req, res) => {
      service.check(req.staff);
      const slug = templateSlugSchema.parse(req.params.slug || defaultSlug);
      const copy = templateCopySchema.parse(req.body);
      send(req, res, {
        ...renderEmailTemplate(slug, copy),
        preview: true,
      });
    },
  );
  router.post(
    ["/draft", "/:slug/draft"],
    auth.requireMutation,
    async (req, res) => {
      const input = z
        .object({ expectedVersion: versionSchema, copy: templateCopySchema })
        .strict()
        .parse(req.body);
      send(
        req,
        res,
        await service.change(
          req.staff,
          req.requestId,
          input.expectedVersion,
          input.copy,
          false,
          req.params.slug,
        ),
      );
    },
  );
  router.post(
    ["/activate", "/:slug/activate"],
    auth.requireMutation,
    async (req, res) => {
      const input = z
        .object({ expectedVersion: versionSchema })
        .strict()
        .parse(req.body);
      send(
        req,
        res,
        await service.change(
          req.staff,
          req.requestId,
          input.expectedVersion,
          null,
          true,
          req.params.slug,
        ),
      );
    },
  );
  router.use((error, req, res, next) => {
    if (!(error instanceof z.ZodError) && !(error instanceof ContentError))
      return next(error);
    res.status(error.status || 400).json(
      createErrorResponse(
        {
          code: error.code || "validation_error",
          message:
            error instanceof z.ZodError
              ? "Check the template fields."
              : error.message,
        },
        { requestId: req.requestId },
      ),
    );
  });
  return router;
}
