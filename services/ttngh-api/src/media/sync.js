import { createHash, randomUUID } from "node:crypto";
import { prepareImage } from "./images.js";
import { ContentError } from "./errors.js";

export async function* enumerateDriveImages(drive, { maxFolders = 500, maxPages = 2000 } = {}) {
  const queue = [{ id: drive.config.folderId, path: [] }];
  const visited = new Set();
  let pages = 0;
  while (queue.length) {
    if (visited.size >= maxFolders) throw new Error("Media folder traversal limit exceeded");
    const folder = queue.shift();
    if (visited.has(folder.id)) continue;
    visited.add(folder.id);
    let cursor = "", tokens = new Set();
    do {
      if (++pages > maxPages) throw new Error("Media pagination limit exceeded");
      const result = await drive.list(cursor, folder.id);
      if (result.incomplete) throw new Error("Google Drive returned an incomplete listing");
      for (const child of result.folders) {
        if (!visited.has(child.id)) queue.push({ id: child.id, path: [...folder.path, child.name] });
      }
      for (const file of result.items) yield { ...file, folderId: folder.id, path: folder.path };
      cursor = result.nextPageToken;
      if (cursor && tokens.has(cursor)) throw new Error("Google Drive pagination loop detected");
      if (cursor) tokens.add(cursor);
    } while (cursor);
  }
}

const hex = value => createHash("sha256").update(value).digest("hex");
const validId = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export class MediaSync {
  constructor(pool, drive, r2, fetcher = fetch) {
    this.pool = pool;
    this.drive = drive;
    this.r2 = r2;
    this.fetcher = fetcher;
  }

  async sync({ apply = false, maxFiles = 1000 } = {}) {
    if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 5000)
      throw new Error("Select a max-files value from 1 to 5000");
    const summary = { mode: apply ? "apply" : "dry-run", discovered: 0, alreadyImported: 0, pending: 0, imported: 0, failed: 0 };
    const client = await this.pool.connect();
    let locked = false;
    try {
      if (apply) {
        const result = await client.query("SELECT pg_try_advisory_lock(821026003) AS locked");
        if (!result.rows[0]?.locked) throw new Error("Another TTNGH media sync is running");
        locked = true;
      }
      for await (const item of enumerateDriveImages(this.drive)) {
        if (++summary.discovered > maxFiles) throw new Error("Maximum Drive image count exceeded; narrow the approved root or raise --max-files");
        const previous = await client.query(
          "SELECT id,status FROM ttngh_media.assets WHERE source_file_id=$1 AND source_version=$2 AND source_checksum=$3",
          [item.id, item.version, item.md5Checksum || ""]
        );
        if (previous.rowCount) { summary.alreadyImported++; continue; }
        summary.pending++;
        if (!apply) continue;
        try {
          // Validate again immediately before download: a Drive file may have moved
          // outside the permitted subtree since it appeared in the listing.
          const metadata = await this.drive.metadata(item.id);
          if (metadata.version !== item.version || metadata.md5Checksum !== item.md5Checksum)
            throw new ContentError(409, "conflict", "Source changed during listing");
          const bytes = await this.drive.download(metadata);
          const derivatives = await prepareImage(bytes, metadata.mimeType);
          const checksum = hex(bytes);
          const root = this.r2.prefix + "drive/" + metadata.id + "/" + metadata.version + "-" + checksum + "/";
          const variants = [];
          for (const derivative of derivatives) {
            const key = root + derivative.variant + ".webp";
            // Immutable key: rerunning after an interrupted import is safe.
            if (!await this.r2.exists(key)) await this.r2.put(key, derivative.bytes);
            variants.push({ key, width: derivative.width, height: derivative.height, variant: derivative.variant });
          }
          await client.query(
            `INSERT INTO ttngh_media.assets
              (id,source_folder_id,source_file_id,source_version,source_checksum,source_name,source_mime,source_bytes,source_path,source_sha256,r2_variants)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) ON CONFLICT (source_file_id,source_version,source_checksum) DO NOTHING`,
            [randomUUID(), metadata.parents[0], metadata.id, metadata.version, metadata.md5Checksum,
              metadata.name, metadata.mimeType, metadata.size, item.path, checksum, JSON.stringify(variants)]
          );
          summary.imported++;
        } catch {
          // Do not log names, provider responses, tokens or potentially sensitive Drive paths.
          summary.failed++;
        }
      }
    } finally {
      if (locked) await client.query("SELECT pg_advisory_unlock(821026003)").catch(() => {});
      client.release();
    }
    return summary;
  }

  async approve(id, { alt, rights }) {
    if (!validId(id) || typeof alt !== "string" || !alt.trim() || alt.length > 300 ||
        typeof rights !== "string" || !rights.trim() || rights.length > 2000)
      throw new Error("Asset ID, approved alternative text and rights evidence are required");
    const result = await this.pool.query(
      `UPDATE ttngh_media.assets SET alt=$2,rights_evidence=$3,status='approved',updated_at=now()
       WHERE id=$1 AND status IN ('imported','approved') AND sanity_asset_id IS NULL RETURNING id`,
      [id, alt.trim(), rights.trim()]
    );
    if (!result.rowCount) throw new Error("Asset missing, archived or already exported to Sanity");
    return { approved: true, id };
  }

  async exportToSanity(id, config) {
    if (!validId(id) || !config?.project || !/^[a-z0-9]+$/.test(config.project) ||
        !/^[a-z0-9_-]+$/.test(config.dataset || "") ||
        !config.token || config.token.length > 8192) throw new Error("Sanity asset export configuration invalid");
    const query = await this.pool.query(
      "SELECT id,source_name,source_file_id,alt,rights_evidence,r2_variants,sanity_asset_id,status FROM ttngh_media.assets WHERE id=$1", [id]
    );
    const row = query.rows[0];
    if (!row || row.status !== "approved" || !row.alt || !row.rights_evidence)
      throw new Error("Approved media with rights evidence is required");
    if (row.sanity_asset_id) return { assetId: row.sanity_asset_id, unchanged: true };
    const largest = [...row.r2_variants].sort((a,b) => b.width-a.width)[0];
    if (!largest?.key) throw new Error("Stored R2 image unavailable");
    const bytes = await this.r2.get(largest.key);
    const url = new URL(`https://${config.project}.api.sanity.io/v2025-02-19/assets/images/${config.dataset}`);
    url.searchParams.set("filename", id + ".webp");
    url.searchParams.set("title", row.source_name.slice(0,160));
    url.searchParams.set("description", "TTNGH approved image. Alt: " + row.alt.slice(0,300));
    url.searchParams.set("sourceName", "TTNGH approved Google Drive library");
    url.searchParams.set("sourceId", row.source_file_id);
    // This does not attach the image to a published CMS document.
    const response = await this.fetcher(url, { method: "POST", redirect: "error",
      headers: { Authorization: "Bearer " + config.token, "Content-Type": "image/webp" },
      body: bytes, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("Sanity asset upload failed");
    const body = await response.json();
    const assetId = body?.document?._id;
    if (typeof assetId !== "string" || !/^image-[a-f\d]+-\d+x\d+-webp$/.test(assetId))
      throw new Error("Sanity did not confirm an image asset");
    await this.pool.query("UPDATE ttngh_media.assets SET sanity_asset_id=$2,updated_at=now() WHERE id=$1 AND sanity_asset_id IS NULL", [id,assetId]);
    return { id, assetId, unchanged:false };
  }

  async status() {
    const result = await this.pool.query(
      "SELECT status, COUNT(*)::integer AS count, COUNT(sanity_asset_id)::integer AS in_sanity FROM ttngh_media.assets GROUP BY status ORDER BY status"
    );
    return { stages: result.rows };
  }
}
