import { randomUUID } from "node:crypto";
import { transaction } from "../db/database.js";
import { ContentError, contentForPage, pageSchema } from "./schema.js";
import { appendAudit } from "../audit.js";

export class ContentRepository {
  constructor(pool, organisationId) { this.pool = pool; this.organisationId = organisationId; }

  async list() {
    const { rows } = await this.pool.query(`SELECT c.id, c.slug, c.version, c.draft_revision_id, c.published_revision_id,
      c.updated_at, r.body FROM twe.content_items c LEFT JOIN twe.content_revisions r
      ON r.id = c.draft_revision_id AND r.organisation_id = c.organisation_id
      WHERE c.organisation_id = $1 AND c.kind = 'page' ORDER BY c.slug`, [this.organisationId]);
    return rows;
  }

  async get(page, published = false) {
    pageSchema.parse(page);
    const revisionColumn = published ? "published_revision_id" : "draft_revision_id";
    const { rows } = await this.pool.query(`SELECT c.id, c.slug, c.version, c.draft_revision_id, c.published_revision_id,
      r.body, r.id AS revision_id, r.created_at, r.editor_id
      FROM twe.content_items c JOIN twe.content_revisions r ON r.id = c.${revisionColumn}
      AND r.organisation_id = c.organisation_id WHERE c.organisation_id = $1 AND c.kind = 'page' AND c.slug = $2`, [this.organisationId, page]);
    return rows[0] || null;
  }

  async history(page) {
    const { rows } = await this.pool.query(`SELECT r.id, r.version, r.editor_id, r.created_at
      FROM twe.content_revisions r JOIN twe.content_items c ON c.id = r.content_id AND c.organisation_id = r.organisation_id
      WHERE c.organisation_id = $1 AND c.kind = 'page' AND c.slug = $2 ORDER BY r.version DESC LIMIT 100`, [this.organisationId, page]);
    return rows;
  }

  async save(page, body, expectedVersion, actor, requestId) {
    pageSchema.parse(page);
    const validated = contentForPage(page, body);
    if (actor.organisationId !== this.organisationId) throw new ContentError(403, "permission_error", "Organisation access denied.");
    return transaction(this.pool, async (client) => {
      if (expectedVersion === 0) await client.query("INSERT INTO twe.content_items (id, organisation_id, kind, slug) VALUES ($1, $2, 'page', $3) ON CONFLICT (organisation_id, kind, slug) DO NOTHING", [randomUUID(), this.organisationId, page]);
      const { rows } = await client.query("SELECT id, version FROM twe.content_items WHERE organisation_id = $1 AND kind = 'page' AND slug = $2 FOR UPDATE", [this.organisationId, page]);
      const item = rows[0];
      if (!item || item.version !== expectedVersion) throw new ContentError(409, "conflict", "This page changed. Reload before saving.");
      if (validated.imageId) {
        const media = await client.query("SELECT id FROM twe.media WHERE organisation_id = $1 AND id = $2 AND archived_at IS NULL FOR SHARE", [this.organisationId, validated.imageId]);
        if (!media.rowCount) throw new ContentError(400, "validation_error", "Choose an available image from this organisation.");
      }
      const revisionId = randomUUID();
      await client.query("INSERT INTO twe.content_revisions (id, organisation_id, content_id, version, body, editor_id) VALUES ($1, $2, $3, $4, $5, $6)", [revisionId, this.organisationId, item.id, item.version + 1, validated, actor.id]);
      if (validated.imageId) await client.query("INSERT INTO twe.content_media (organisation_id, content_id, revision_id, media_id) VALUES ($1, $2, $3, $4)", [this.organisationId, item.id, revisionId, validated.imageId]);
      await client.query("UPDATE twe.content_items SET draft_revision_id = $1, version = version + 1, updated_at = now() WHERE organisation_id = $2 AND id = $3", [revisionId, this.organisationId, item.id]);
      await this.audit(client, actor.id, "content.saved", item.id, requestId);
      return { id: item.id, slug: page, version: item.version + 1, revisionId, body: validated };
    });
  }

  async revert(page, revisionId, expectedVersion, actor, requestId) {
    const { rows } = await this.pool.query(`SELECT r.body FROM twe.content_revisions r JOIN twe.content_items c
      ON c.id = r.content_id AND c.organisation_id = r.organisation_id WHERE c.organisation_id = $1
      AND c.slug = $2 AND c.kind = 'page' AND r.id = $3`, [this.organisationId, page, revisionId]);
    if (!rows[0]) throw new ContentError(404, "not_found", "Revision not found.");
    // A rollback creates a new immutable revision; it never mutates history or
    // claims to publish. Optimistic version checking still happens under lock.
    return this.save(page, rows[0].body, expectedVersion, actor, requestId);
  }

  async audit(client, actorId, action, recordId, requestId) {
    await appendAudit(client, { organisationId: this.organisationId, actorId, action, recordId, requestId });
  }
}
