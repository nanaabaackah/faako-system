import { randomUUID, createHash } from "node:crypto";
import { transaction } from "../db/database.js";
import { appendAudit } from "../audit.js";
import {
  ContentError,
  contentForPage,
  pageSchema,
  pageNames,
} from "./schema.js";
import { validateEnvironment } from "../config.js";

export const manifestDigest = (manifest) => {
  // PostgreSQL jsonb may reorder object keys. Canonicalize recursively.
  const stable = (value) =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, stable(value[key])]),
          )
        : value;
  return createHash("sha256")
    .update(JSON.stringify(stable(manifest)))
    .digest("hex");
};

export class PublicationRepository {
  constructor(pool, { organisationId, environment, sourceSha }) {
    validateEnvironment(environment);
    this.pool = pool;
    this.organisationId = organisationId;
    this.environment = environment;
    this.sourceSha = sourceSha;
  }
  async list() {
    const { rows } = await this.pool.query(
      `SELECT id, status, attempts, source_sha, deployment_id, created_at, completed_at, last_error
      FROM twe.publication_jobs WHERE organisation_id = $1 AND environment = $2 ORDER BY created_at DESC LIMIT 50`,
      [this.organisationId, this.environment],
    );
    return rows;
  }
  async lockOrganisation(client) {
    // Runtime may read organisations, never update its identity/business fields.
    // Transaction advisory locks serialize every publication lifecycle operation
    // for this tenant/environment without requiring table UPDATE privileges.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`twe-publication:${this.environment}:${this.organisationId}`],
    );
  }
  async enqueue(page, expectedVersion, unpublish, actor, requestId) {
    pageSchema.parse(page);
    if (actor.organisationId !== this.organisationId)
      throw new ContentError(
        403,
        "permission_error",
        "Organisation access denied.",
      );
    if (!/^[a-f0-9]{40}$/.test(this.sourceSha || ""))
      throw new ContentError(
        503,
        "service_unavailable",
        "A reviewed source revision must be configured before publishing.",
      );
    return transaction(this.pool, async (client) => {
      // Serializes enqueue and confirmation for this organisation, not all tenants.
      await this.lockOrganisation(client);
      const active = await client.query(
        "SELECT id FROM twe.publication_jobs WHERE organisation_id = $1 AND environment = $2 AND status IN ('pending', 'building')",
        [this.organisationId, this.environment],
      );
      if (active.rowCount)
        throw new ContentError(
          409,
          "conflict",
          "A publication is already pending. Wait for its result before publishing again.",
        );
      const { rows } = await client.query(
        `SELECT c.id, c.slug, c.version, c.draft_revision_id, c.published_revision_id
        FROM twe.content_items c WHERE c.organisation_id = $1 AND c.kind = 'page' AND c.slug = ANY($2::text[]) ORDER BY c.slug FOR SHARE`,
        [this.organisationId, pageNames],
      );
      const target = rows.find((row) => row.slug === page);
      if (!target || target.version !== expectedVersion)
        throw new ContentError(
          409,
          "conflict",
          "This page changed. Reload before publishing.",
        );
      const pages = [];
      for (const item of rows) {
        const revisionId =
          item.slug === page
            ? unpublish
              ? null
              : item.draft_revision_id
            : item.published_revision_id;
        let body = null;
        if (revisionId) {
          const revision = await client.query(
            "SELECT body FROM twe.content_revisions WHERE organisation_id = $1 AND content_id = $2 AND id = $3",
            [this.organisationId, item.id, revisionId],
          );
          body = contentForPage(item.slug, revision.rows[0]?.body);
        }
        pages.push({ id: item.id, slug: item.slug, revisionId, body });
      }
      const manifest = { version: 1, pages };
      const id = randomUUID();
      await client.query(
        "INSERT INTO twe.publication_jobs (id, organisation_id, environment, manifest, source_sha) VALUES ($1, $2, $3, $4, $5)",
        [id, this.organisationId, this.environment, manifest, this.sourceSha],
      );
      await appendAudit(client, {
        organisationId: this.organisationId,
        actorId: actor.id,
        action: unpublish
          ? "content.unpublish_requested"
          : "content.publish_requested",
        recordId: id,
        requestId,
      });
      return { id, status: "pending" };
    });
  }
  async claim() {
    const { rows } = await this.pool.query(
      `WITH candidate AS (SELECT id FROM twe.publication_jobs
      WHERE organisation_id = $1 AND environment = $2 AND status = 'pending' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE twe.publication_jobs p SET status = 'building', attempts = attempts + 1, build_token = $3, last_error = NULL
      FROM candidate WHERE p.id = candidate.id RETURNING p.*`,
      [this.organisationId, this.environment, randomUUID()],
    );
    return rows[0];
  }
  async fail(id, token) {
    await this.pool.query(
      "UPDATE twe.publication_jobs SET status = 'failed', last_error = 'build_or_verification_failed' WHERE organisation_id = $1 AND environment = $2 AND id = $3 AND build_token = $4 AND status = 'building'",
      [this.organisationId, this.environment, id, token],
    );
  }
  async retry(id, actor, requestId) {
    if (actor.organisationId !== this.organisationId)
      throw new ContentError(
        403,
        "permission_error",
        "Organisation access denied.",
      );
    return transaction(this.pool, async (client) => {
      await this.lockOrganisation(client);
      const active = await client.query(
        "SELECT id FROM twe.publication_jobs WHERE organisation_id = $1 AND environment = $2 AND status IN ('pending', 'building')",
        [this.organisationId, this.environment],
      );
      if (active.rowCount)
        throw new ContentError(
          409,
          "conflict",
          "Another publication is active.",
        );
      // Only the latest request may be retried; an older snapshot would regress later releases.
      const latest = await client.query(
        "SELECT id FROM twe.publication_jobs WHERE organisation_id = $1 AND environment = $2 ORDER BY created_at DESC LIMIT 1",
        [this.organisationId, this.environment],
      );
      if (latest.rows[0]?.id !== id)
        throw new ContentError(
          409,
          "conflict",
          "Only the latest publication can be retried.",
        );
      const result = await client.query(
        "UPDATE twe.publication_jobs SET status = 'pending', build_token = NULL WHERE organisation_id = $1 AND environment = $2 AND id = $3 AND status = 'failed' AND attempts < 3 RETURNING id, status",
        [this.organisationId, this.environment, id],
      );
      if (!result.rowCount)
        throw new ContentError(
          409,
          "conflict",
          "This publication cannot be retried. Ask Baaba to review it.",
        );
      await appendAudit(client, {
        organisationId: this.organisationId,
        actorId: actor.id,
        action: "content.publish_retried",
        recordId: id,
        requestId,
      });
      return result.rows[0];
    });
  }
  async confirm(id, token, deploymentId, digest) {
    if (
      typeof deploymentId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,120}$/.test(deploymentId)
    )
      throw new Error("Invalid deployment reference.");
    return transaction(this.pool, async (client) => {
      await this.lockOrganisation(client);
      const { rows } = await client.query(
        "SELECT * FROM twe.publication_jobs WHERE organisation_id = $1 AND environment = $2 AND id = $3 AND build_token = $4 AND status = 'building' FOR UPDATE",
        [this.organisationId, this.environment, id, token],
      );
      const job = rows[0];
      if (!job || manifestDigest(job.manifest) !== digest)
        throw new Error(
          "Publication acknowledgement does not match the active build.",
        );
      for (const page of job.manifest.pages)
        await client.query(
          "UPDATE twe.content_items SET published_revision_id = $1 WHERE organisation_id = $2 AND id = $3",
          [page.revisionId, this.organisationId, page.id],
        );
      await client.query(
        "UPDATE twe.publication_jobs SET status = 'live', deployment_id = $1, completed_at = now() WHERE id = $2 AND organisation_id = $3",
        [deploymentId, id, this.organisationId],
      );
      await appendAudit(client, {
        organisationId: this.organisationId,
        action: "content.deployment_confirmed",
        recordId: id,
        requestId: id,
      });
    });
  }
}
