import { randomUUID } from "node:crypto";
import { z } from "zod";
import { transaction } from "../db/database.js";
import { appendAudit } from "../audit.js";
import { ContentError } from "../content/schema.js";
import { prepareImage } from "./images.js";

export const mediaMetadataSchema = z
  .object({
    alt: z.string().trim().min(1).max(500),
    rights: z.string().trim().min(1).max(2000),
  })
  .strict();

export class MediaService {
  constructor(pool, organisationId, store, logger, drive = null) {
    this.pool = pool;
    this.organisationId = organisationId;
    this.store = store;
    this.logger = logger;
    this.drive = drive;
    this.processing = 0;
    this.driveImporting = false;
  }
  async list() {
    const { rows } = await this.pool.query(
      "SELECT id, alt_text, rights, width, height, byte_size, created_at FROM twe.media WHERE organisation_id = $1 AND archived_at IS NULL ORDER BY created_at DESC LIMIT 100",
      [this.organisationId],
    );
    return {
      configured: Boolean(this.store),
      driveConfigured: Boolean(this.store && this.drive),
      items: rows,
    };
  }
  async get(id) {
    const { rows } = await this.pool.query(
      "SELECT * FROM twe.media WHERE organisation_id = $1 AND id = $2",
      [this.organisationId, id],
    );
    if (!rows[0]) throw new ContentError(404, "not_found", "Image not found.");
    return rows[0];
  }
  async upload(
    bytes,
    type,
    metadata,
    actor,
    requestId,
    replaceId,
    source = null,
  ) {
    if (!this.store)
      throw new ContentError(
        503,
        "service_unavailable",
        "Private image storage is not configured.",
      );
    if (actor.organisationId !== this.organisationId)
      throw new ContentError(
        403,
        "permission_error",
        "Organisation access denied.",
      );
    if (this.processing >= 2)
      throw new ContentError(
        429,
        "rate_limited",
        "Image processing is busy. Please retry shortly.",
      );
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
        variants.push({
          key,
          width: output.width,
          height: output.height,
          variant: output.variant,
        });
      }
      const original = outputs.at(-1);
      await transaction(this.pool, async (client) => {
        await client.query(
          `INSERT INTO twe.media (id, organisation_id, object_key, mime_type, byte_size, width, height, alt_text, rights, derivatives, created_by)
          VALUES ($1, $2, $3, 'image/webp', $4, $5, $6, $7, $8, $9, $10)`,
          [
            id,
            this.organisationId,
            variants.at(-1).key,
            original.bytes.length,
            original.width,
            original.height,
            fields.alt,
            fields.rights,
            JSON.stringify(variants),
            actor.id,
          ],
        );
        if (source)
          await client.query(
            "UPDATE twe.media SET source_folder_id=$1, source_file_id=$2, source_version=$3, source_checksum=$4 WHERE organisation_id=$5 AND id=$6",
            [
              source.folderId,
              source.fileId,
              source.version,
              source.checksum,
              this.organisationId,
              id,
            ],
          );
        await appendAudit(client, {
          organisationId: this.organisationId,
          actorId: actor.id,
          action: source
            ? "media.drive_imported"
            : replaceId
              ? "media.replacement_created"
              : "media.uploaded",
          recordId: id,
          requestId,
        });
      });
      return {
        id,
        alt_text: fields.alt,
        width: original.width,
        height: original.height,
        replacedId: replaceId || null,
      };
    } catch (error) {
      for (const key of keys) {
        try {
          await this.store.remove(key);
        } catch {
          this.logger?.error(
            { eventName: "media.orphan_cleanup_failed", requestId },
            "Image cleanup needs operator review",
          );
        }
      }
      throw error;
    } finally {
      this.processing -= 1;
    }
  }
  async listDrive(pageToken = "") {
    if (!this.drive || !this.store)
      return { configured: false, items: [], nextPageToken: "" };
    const result = await this.drive.list(pageToken);
    const { rows } = await this.pool.query(
      "SELECT id, source_file_id, source_version, archived_at FROM twe.media WHERE organisation_id=$1 AND source_folder_id=$2 AND (source_file_id, source_version) IN (SELECT * FROM unnest($3::text[], $4::text[]))",
      [
        this.organisationId,
        this.drive.config.folderId,
        result.items.map((item) => item.id),
        result.items.map((item) => item.version),
      ],
    );
    return {
      ...result,
      configured: true,
      items: result.items.map((item) => {
        const existing = rows.find(
          (row) =>
            row.source_file_id === item.id &&
            row.source_version === item.version,
        );
        return {
          ...item,
          importedId: existing?.archived_at ? null : existing?.id || null,
          archived: Boolean(existing?.archived_at),
        };
      }),
    };
  }
  async driveRevision(source) {
    const { rows } = await this.pool.query(
      "SELECT id, archived_at, source_checksum FROM twe.media WHERE organisation_id=$1 AND source_folder_id=$2 AND source_file_id=$3 AND source_version=$4",
      [this.organisationId, source.folderId, source.fileId, source.version],
    );
    if (rows[0]?.archived_at)
      throw new ContentError(
        409,
        "conflict",
        "This Drive revision was archived. Use a newer source revision or upload a reviewed image.",
      );
    if (rows[0] && rows[0].source_checksum !== source.checksum)
      throw new ContentError(
        409,
        "conflict",
        "The Drive revision no longer matches the imported image. Refresh and review its source.",
      );
    return rows[0];
  }
  async importDrive(input, actor, requestId) {
    if (actor.organisationId !== this.organisationId)
      throw new ContentError(
        403,
        "permission_error",
        "Organisation access denied.",
      );
    if (!this.drive || !this.store)
      throw new ContentError(
        503,
        "service_unavailable",
        "Google Drive image import is not configured.",
      );
    if (this.driveImporting)
      throw new ContentError(
        429,
        "rate_limited",
        "A Drive image is already being imported. Wait for it to finish.",
      );
    const fields = mediaMetadataSchema.parse({
      alt: input.alt,
      rights: input.rights,
    });
    this.driveImporting = true;
    try {
      const file = await this.drive.metadata(input.fileId);
      if (file.version !== input.version)
        throw new ContentError(
          409,
          "conflict",
          "This Drive image changed. Refresh the folder before importing.",
        );
      const source = {
        folderId: this.drive.config.folderId,
        fileId: file.id,
        version: file.version,
        checksum: file.md5Checksum,
      };
      const existing = await this.driveRevision(source);
      if (existing) return { id: existing.id, unchanged: true };
      const bytes = await this.drive.download(file);
      try {
        const asset = await this.upload(
          bytes,
          file.mimeType,
          fields,
          actor,
          requestId,
          null,
          source,
        );
        return { ...asset, unchanged: false };
      } catch (error) {
        // Another API replica can win this immutable source revision's unique key.
        // upload already cleans up only this attempt's newly generated R2 objects.
        if (
          error.code !== "23505" ||
          error.constraint !== "media_drive_revision_unique"
        )
          throw error;
        const winner = await this.driveRevision(source);
        if (!winner) throw error;
        return { id: winner.id, unchanged: true };
      }
    } finally {
      this.driveImporting = false;
    }
  }
  async archive(id, actor, requestId) {
    if (actor.organisationId !== this.organisationId)
      throw new ContentError(
        403,
        "permission_error",
        "Organisation access denied.",
      );
    await transaction(this.pool, async (client) => {
      const row = await client.query(
        "SELECT id FROM twe.media WHERE organisation_id = $1 AND id = $2 FOR UPDATE",
        [this.organisationId, id],
      );
      if (!row.rowCount)
        throw new ContentError(404, "not_found", "Image not found.");
      const refs = await client.query(
        "SELECT media_id FROM twe.content_media WHERE organisation_id = $1 AND media_id = $2 LIMIT 1",
        [this.organisationId, id],
      );
      if (refs.rowCount)
        throw new ContentError(
          409,
          "conflict",
          "This image is retained by content history and cannot be archived.",
        );
      await client.query(
        "UPDATE twe.media SET archived_at = now() WHERE organisation_id = $1 AND id = $2",
        [this.organisationId, id],
      );
      await appendAudit(client, {
        organisationId: this.organisationId,
        actorId: actor.id,
        action: "media.archived",
        recordId: id,
        requestId,
      });
    });
  }
  async preview(id) {
    const media = await this.get(id);
    if (!this.store)
      throw new ContentError(
        503,
        "service_unavailable",
        "Private image storage is not configured.",
      );
    return this.store.get(media.derivatives[0].key);
  }
}
