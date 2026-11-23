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
import approvedRelease from "../../../travel-with-ease-web/content/approved-public-release.json" with { type: "json" };

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
      `SELECT id, status, attempts, source_sha, deployment_id, created_at, completed_at, last_error,
      environment, requested_by, recovery_deployment_id, manifest->'target' AS target,
      COALESCE(manifest->>'triggerType', 'cms_publication') AS trigger_type,
      COALESCE(manifest->>'schemaVersion', '1')::int AS schema_version,
      (status = 'pending' AND created_at <= now() - interval '30 minutes') AS can_cancel,
      (status IN ('deploying', 'verifying') AND updated_at <= now() - interval '10 minutes') AS needs_reconciliation
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
  async enqueue(page, expectedVersion, unpublish, actor, requestId, recordSlug = null) {
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
        "SELECT id FROM twe.publication_jobs WHERE organisation_id = $1 AND environment = $2 AND status IN ('pending', 'building', 'deploying', 'verifying')",
        [this.organisationId, this.environment],
      );
      if (active.rowCount)
        throw new ContentError(
          409,
          "conflict",
          "A publication is already pending. Wait for its result before publishing again.",
        );
      const { rows } = await client.query(
        `SELECT c.id, c.slug, c.version, c.draft_revision_id, c.published_revision_id, c.published_body, c.publication_initialized
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
        // A never-published draft is not an instruction to remove the approved
        // bundled section. Only an explicit prior unpublish carries null.
        if (item.slug !== page && !item.publication_initialized && !item.published_revision_id) continue;
        if (item.slug === page && recordSlug && !item.publication_initialized && !item.published_revision_id) {
          throw new ContentError(409, "conflict", "Publish and verify the approved whole collection once before publishing individual records. Nothing was queued.");
        }
        const revisionId =
          item.slug === page
            ? unpublish && !recordSlug
              ? null
              : item.draft_revision_id
            : item.published_revision_id;
        let body = null;
        if (revisionId) {
          const revision = await client.query(
            "SELECT body FROM twe.content_revisions WHERE organisation_id = $1 AND content_id = $2 AND id = $3",
            [this.organisationId, item.id, revisionId],
          );
          body = contentForPage(item.slug, item.slug !== page && item.published_body ? item.published_body : revision.rows[0]?.body);
        }
        if (item.slug === page && recordSlug) {
          const key = { packages: "packages", journal: "articles", "travel-tips": "tips" }[page];
          if (!key) throw new ContentError(400, "validation_error", "Choose a collection record.");
          let live = item.published_body;
          if (!live && item.published_revision_id) {
            const result = await client.query("SELECT body FROM twe.content_revisions WHERE organisation_id = $1 AND content_id = $2 AND id = $3", [this.organisationId, item.id, item.published_revision_id]);
            live = result.rows[0]?.body;
          }
          const draft = body;
          // Publishing a record never includes its siblings' unpublished edits.
          const record = draft?.[key].find(value => value.slug === recordSlug);
          if (!unpublish && !record) throw new ContentError(404, "not_found", "Collection record not found.");
          const baseline = live || { ...draft, [key]: [] };
          if (!baseline) throw new ContentError(404, "not_found", "Published collection not found.");
          const records = baseline[key].filter(value => value.slug !== recordSlug);
          body = contentForPage(page, { ...baseline, [key]: unpublish ? records : [...records, record] });
        }
        pages.push({ id: item.id, slug: item.slug, revisionId, body });
      }
      const manifest = { version: 1, schemaVersion: 2, triggerType: "cms_publication", baseline: approvedRelease.pages, pages, target: { page, version: expectedVersion, recordSlug, unpublish } };
      const id = randomUUID();
      await client.query(
        "INSERT INTO twe.publication_jobs (id, organisation_id, environment, manifest, source_sha, requested_by) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, this.organisationId, this.environment, manifest, this.sourceSha, actor.id],
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
  async coordinateSource() {
    if (!/^[a-f0-9]{40}$/.test(this.sourceSha || "")) throw new Error("A reviewed source revision is required.");
    return transaction(this.pool, async (client) => {
      await this.lockOrganisation(client);
      const active = await client.query(
        `SELECT * FROM twe.publication_jobs WHERE organisation_id=$1 AND environment=$2
         AND status IN ('pending','building','deploying','verifying') ORDER BY created_at LIMIT 1 FOR UPDATE`,
        [this.organisationId, this.environment],
      );
      const current = active.rows[0];
      if (current) {
        if (current.source_sha === this.sourceSha || current.status !== "pending") return { status: "unchanged", id: current.id };
        const replacementId = randomUUID();
        const manifest = { ...current.manifest, schemaVersion: 2, baseline: current.manifest.baseline || approvedRelease.pages, triggerType: "coordinated_release", supersedes: current.id };
        await client.query(
          "UPDATE twe.publication_jobs SET status='failed', last_error='superseded_by_code_release', updated_at=now() WHERE id=$1 AND status='pending'",
          [current.id],
        );
        await client.query(
          `INSERT INTO twe.publication_jobs (id, organisation_id, environment, manifest, source_sha, requested_by)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [replacementId, this.organisationId, this.environment, manifest, this.sourceSha, current.requested_by],
        );
        await appendAudit(client, { organisationId: this.organisationId, action: "content.release_coordinated", recordId: replacementId, requestId: replacementId });
        return { status: "queued", id: replacementId };
      }
      const live = await client.query(
        `SELECT id, manifest, source_sha FROM twe.publication_jobs WHERE organisation_id=$1 AND environment=$2
         AND status='live' ORDER BY completed_at DESC LIMIT 1`,
        [this.organisationId, this.environment],
      );
      const previous = live.rows[0];
      if (!previous || previous.source_sha === this.sourceSha) return { status: "unchanged", id: previous?.id };
      const duplicate = await client.query(
        `SELECT id FROM twe.publication_jobs WHERE organisation_id=$1 AND environment=$2 AND source_sha=$3
         AND manifest->>'triggerType'='code_release' ORDER BY created_at DESC LIMIT 1`,
        [this.organisationId, this.environment, this.sourceSha],
      );
      if (duplicate.rowCount) return { status: "unchanged", id: duplicate.rows[0].id };
      const id = randomUUID();
      const manifest = { ...previous.manifest, schemaVersion: 2, baseline: previous.manifest.baseline || approvedRelease.pages, triggerType: "code_release", target: { page: "website", version: previous.id, unpublish: false } };
      await client.query(
        "INSERT INTO twe.publication_jobs (id, organisation_id, environment, manifest, source_sha) VALUES ($1,$2,$3,$4,$5)",
        [id, this.organisationId, this.environment, manifest, this.sourceSha],
      );
      await appendAudit(client, { organisationId: this.organisationId, action: "content.code_release_requested", recordId: id, requestId: id });
      return { status: "queued", id };
    });
  }
  async claim() {
    const { rows } = await this.pool.query(
      `WITH candidate AS (SELECT id FROM twe.publication_jobs
      WHERE organisation_id = $1 AND environment = $2 AND status = 'pending' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE twe.publication_jobs p SET status = 'building', attempts = attempts + 1, build_token = $3, last_error = NULL, updated_at = now()
      FROM candidate WHERE p.id = candidate.id RETURNING p.*`,
      [this.organisationId, this.environment, randomUUID()],
    );
    return rows[0];
  }
  async cancelPending(id, actor, requestId) {
    if (actor.organisationId !== this.organisationId)
      throw new ContentError(403, "permission_error", "Organisation access denied.");
    return transaction(this.pool, async (client) => {
      await this.lockOrganisation(client);
      // A claimed job may already be deploying. Never cancel it or alter its
      // immutable manifest. Require a quiet period to avoid routine job races.
      const result = await client.query(
        `UPDATE twe.publication_jobs SET status = 'failed',
          last_error = 'cancelled_by_operator', updated_at = now()
        WHERE id = $1 AND organisation_id = $2 AND environment = $3
          AND status = 'pending' AND created_at <= now() - interval '30 minutes'
        RETURNING id, status`,
        [id, this.organisationId, this.environment],
      );
      if (result.rowCount !== 1)
        throw new ContentError(409, "conflict", "Only a pending publication older than 30 minutes can be cancelled. Refresh its status before trying again.");
      await appendAudit(client, {
        organisationId: this.organisationId,
        actorId: actor.id,
        action: "content.publication_cancelled",
        recordId: id,
        requestId,
      });
      return { id, status: "cancelled" };
    });
  }
  async fail(id, token) {
    await this.pool.query(
      "UPDATE twe.publication_jobs SET status = 'failed', updated_at = now(), last_error = 'build_or_verification_failed' WHERE organisation_id = $1 AND environment = $2 AND id = $3 AND build_token = $4 AND status IN ('building', 'deploying', 'verifying')",
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
        "SELECT id FROM twe.publication_jobs WHERE organisation_id = $1 AND environment = $2 AND status IN ('pending', 'building', 'deploying', 'verifying')",
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
        "UPDATE twe.publication_jobs SET status = 'pending', build_token = NULL, updated_at = now() WHERE organisation_id = $1 AND environment = $2 AND id = $3 AND status = 'failed' AND attempts < 3 AND last_error IS DISTINCT FROM 'cancelled_by_operator' RETURNING id, status",
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
  // Only an abandoned, already-deployed job is eligible for read-only provider
  // reconciliation. Pending/building jobs are never implicitly approved.
  async staleDeployment() {
    const { rows } = await this.pool.query(
      `SELECT id, status, build_token, source_sha, manifest, created_at
       FROM twe.publication_jobs
       WHERE organisation_id = $1 AND environment = $2
         AND status IN ('deploying', 'verifying')
         AND updated_at <= now() - interval '10 minutes'
       ORDER BY created_at ASC LIMIT 1`,
      [this.organisationId, this.environment],
    );
    return rows[0] || null;
  }
  async confirmReconciled(id, token, deploymentId, digest) {
    return this.confirm(id, token, deploymentId, digest, { reconciliation: true });
  }
  async confirm(id, token, deploymentId, digest, { reconciliation = false } = {}) {
    if (
      typeof deploymentId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,120}$/.test(deploymentId)
    )
      throw new Error("Invalid deployment reference.");
    return transaction(this.pool, async (client) => {
      await this.lockOrganisation(client);
      const { rows } = await client.query(
        reconciliation
          ? "SELECT * FROM twe.publication_jobs WHERE organisation_id = $1 AND environment = $2 AND id = $3 AND build_token = $4 AND status IN ('deploying', 'verifying') AND updated_at <= now() - interval '10 minutes' FOR UPDATE"
          : "SELECT * FROM twe.publication_jobs WHERE organisation_id = $1 AND environment = $2 AND id = $3 AND build_token = $4 AND status IN ('building', 'verifying') FOR UPDATE",
        [this.organisationId, this.environment, id, token],
      );
      const job = rows[0];
      if (!job || manifestDigest(job.manifest) !== digest)
        throw new Error(
          "Publication acknowledgement does not match the active build.",
        );
      for (const page of job.manifest.pages)
        await client.query(
          "UPDATE twe.content_items SET published_revision_id = $1, published_body = $4, publication_initialized = true WHERE organisation_id = $2 AND id = $3",
          [page.revisionId, this.organisationId, page.id, page.body],
        );
      await client.query(
        "UPDATE twe.publication_jobs SET status = 'live', deployment_id = $1, completed_at = now() WHERE id = $2 AND organisation_id = $3",
        [deploymentId, id, this.organisationId],
      );
      await appendAudit(client, {
        organisationId: this.organisationId,
        action: reconciliation ? "content.deployment_reconciled" : "content.deployment_confirmed",
        recordId: id,
        requestId: id,
      });
    });
  }
  async transition(id, token, from, to) {
    if (![["building", "deploying"], ["deploying", "verifying"]].some(pair => pair[0] === from && pair[1] === to)) throw new Error("Invalid publication transition.");
    const result = await this.pool.query("UPDATE twe.publication_jobs SET status = $5, updated_at = now() WHERE organisation_id = $1 AND environment = $2 AND id = $3 AND build_token = $4 AND status = $6 RETURNING id", [this.organisationId, this.environment, id, token, to, from]);
    if (!result.rowCount) throw new Error("Publication lease changed.");
  }
  async confirmed(id, digest) {
    const { rows } = await this.pool.query("SELECT status, manifest, deployment_id FROM twe.publication_jobs WHERE id=$1 AND organisation_id=$2 AND environment=$3", [id, this.organisationId, this.environment]);
    return rows[0]?.status === "live" && manifestDigest(rows[0].manifest) === digest ? rows[0].deployment_id : null;
  }
  async lastLive() {
    const { rows } = await this.pool.query("SELECT id, source_sha, COALESCE(recovery_deployment_id, deployment_id) AS deployment_id, manifest FROM twe.publication_jobs WHERE organisation_id=$1 AND environment=$2 AND status='live' ORDER BY completed_at DESC LIMIT 1", [this.organisationId, this.environment]);
    return rows[0] || null;
  }
  async recovered(id, deploymentId) {
    if (!/^[a-f0-9-]{36}$/i.test(deploymentId)) throw new Error("Invalid recovery deployment.");
    await transaction(this.pool, async client => {
      const result = await client.query("UPDATE twe.publication_jobs SET recovery_deployment_id=$4 WHERE organisation_id=$1 AND environment=$2 AND id=$3 AND status='live' RETURNING id", [this.organisationId, this.environment, id, deploymentId]);
      if (!result.rowCount) throw new Error("Recovery baseline is no longer live.");
      await appendAudit(client, { organisationId: this.organisationId, action: "content.deployment_recovered", recordId: id, requestId: id });
    });
  }
}
