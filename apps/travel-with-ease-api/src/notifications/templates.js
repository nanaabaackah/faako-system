import { Router } from "express";
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
  constructor(pool, organisationId) {
    this.pool = pool;
    this.organisationId = organisationId;
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
      await appendAudit(client, {
        organisationId: this.organisationId,
        actorId: actor.id,
        action:
          slug === "staff-invitation"
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
