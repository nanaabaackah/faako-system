import { randomUUID } from "node:crypto";
import { z } from "zod";
import { transaction } from "../db/database.js";
import { appendAudit } from "../audit.js";
import { ContentError } from "../content/schema.js";
import { prepareImage } from "./images.js";

export const mediaMetadataSchema = z.object({ alt: z.string().trim().min(1).max(500), rights: z.string().trim().min(1).max(2000) }).strict();

export class MediaService {
  constructor(pool, organisationId, store, logger) { this.pool = pool; this.organisationId = organisationId; this.store = store; this.logger = logger; this.processing = 0; }
  async list() {
    const { rows } = await this.pool.query("SELECT id, alt_text, rights, width, height, byte_size, created_at FROM twe.media WHERE organisation_id = $1 AND archived_at IS NULL ORDER BY created_at DESC LIMIT 100", [this.organisationId]);
    return { configured: Boolean(this.store), items: rows };
  }
  async get(id) {
    const { rows } = await this.pool.query("SELECT * FROM twe.media WHERE organisation_id = $1 AND id = $2", [this.organisationId, id]);
    if (!rows[0]) throw new ContentError(404, "not_found", "Image not found.");
    return rows[0];
  }
  async upload(bytes, type, metadata, actor, requestId, replaceId) {
    if (!this.store) throw new ContentError(503, "service_unavailable", "Private image storage is not configured.");
    if (actor.organisationId !== this.organisationId) throw new ContentError(403, "permission_error", "Organisation access denied.");
    if (this.processing >= 2) throw new ContentError(429, "rate_limited", "Image processing is busy. Please retry shortly.");
    const fields = mediaMetadataSchema.parse(metadata);
    this.processing += 1;
    const keys = [];
    try {
      // Reserve capacity before the first await, including replacement lookup.
      if (replaceId) await this.get(replaceId);
      const outputs = await prepareImage(bytes, type);
      const id = randomUUID();
      const variants = [];
      for (const output of outputs) {
        const key = `${this.organisationId}/${id}/${output.variant}.webp`;
        keys.push(key);
        await this.store.put(key, output.bytes);
        variants.push({ key, width: output.width, height: output.height, variant: output.variant });
      }
      const original = outputs.at(-1);
      await transaction(this.pool, async (client) => {
        await client.query(`INSERT INTO twe.media (id, organisation_id, object_key, mime_type, byte_size, width, height, alt_text, rights, derivatives, created_by)
          VALUES ($1, $2, $3, 'image/webp', $4, $5, $6, $7, $8, $9, $10)`, [id, this.organisationId, variants.at(-1).key, original.bytes.length, original.width, original.height, fields.alt, fields.rights, JSON.stringify(variants), actor.id]);
        await appendAudit(client, { organisationId: this.organisationId, actorId: actor.id, action: replaceId ? "media.replacement_created" : "media.uploaded", recordId: id, requestId });
      });
      return { id, alt_text: fields.alt, width: original.width, height: original.height, replacedId: replaceId || null };
    } catch (error) {
      for (const key of keys) {
        try { await this.store.remove(key); } catch { this.logger?.error({ eventName: "media.orphan_cleanup_failed", requestId }, "Image cleanup needs operator review"); }
      }
      throw error;
    } finally { this.processing -= 1; }
  }
  async archive(id, actor, requestId) {
    if (actor.organisationId !== this.organisationId) throw new ContentError(403, "permission_error", "Organisation access denied.");
    await transaction(this.pool, async (client) => {
      const row = await client.query("SELECT id FROM twe.media WHERE organisation_id = $1 AND id = $2 FOR UPDATE", [this.organisationId, id]);
      if (!row.rowCount) throw new ContentError(404, "not_found", "Image not found.");
      const refs = await client.query("SELECT media_id FROM twe.content_media WHERE organisation_id = $1 AND media_id = $2 LIMIT 1", [this.organisationId, id]);
      if (refs.rowCount) throw new ContentError(409, "conflict", "This image is retained by content history and cannot be archived.");
      await client.query("UPDATE twe.media SET archived_at = now() WHERE organisation_id = $1 AND id = $2", [this.organisationId, id]);
      await appendAudit(client, { organisationId: this.organisationId, actorId: actor.id, action: "media.archived", recordId: id, requestId });
    });
  }
  async preview(id) {
    const media = await this.get(id);
    if (!this.store) throw new ContentError(503, "service_unavailable", "Private image storage is not configured.");
    return this.store.get(media.derivatives[0].key);
  }
}
