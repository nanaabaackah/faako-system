import { createHash, randomUUID } from "node:crypto";
import { contentForPage, contentMediaIds, pageNames } from "./schema.js";
import { transaction } from "../db/database.js";
import { appendAudit } from "../audit.js";
import { approvedEditorCopy } from "./approved-copy.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const fingerprint = (value) => sha256(JSON.stringify(stable(value)));
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hex = /^[a-f0-9]{64}$/;

export function createPromotionBundle({ source, pages, media = [] }) {
  if (source?.environment !== "staging" || !uuid.test(source.organisationId || "") ||
    !uuid.test(source.publicationId || "") || !/^[a-f0-9]{40}$/.test(source.sourceSha || "") ||
    !/^[a-zA-Z0-9_-]{1,120}$/.test(source.deploymentId || ""))
    throw new Error("Promotion source identity is invalid.");
  if (!pages || Object.keys(pages).sort().join("|") !== [...pageNames].sort().join("|"))
    throw new Error("Promotion must contain every CMS website section.");
  const validatedPages = Object.fromEntries(pageNames.map((slug) => [slug,
    pages[slug] === null ? null : contentForPage(slug, pages[slug])]));
  const referenced = new Set(pageNames.flatMap((slug) => validatedPages[slug] ? contentMediaIds(validatedPages[slug]) : []));
  const ids = new Set();
  const validatedMedia = media.map((item) => {
    if (!uuid.test(item?.id || "") || ids.has(item.id) || !referenced.has(item.id) ||
      typeof item.altText !== "string" || item.altText.length > 500 ||
      typeof item.rights !== "string" || !item.rights || item.rights.length > 2000 ||
      !Array.isArray(item.objects) || !item.objects.length || item.objects.length > 8)
      throw new Error("Promotion media metadata is invalid.");
    ids.add(item.id);
    const variants = new Set();
    const objects = item.objects.map((object) => {
      const bytes = Buffer.from(object.bytes || "", "base64");
      if (!/^[a-z0-9_-]{1,40}$/.test(object.variant || "") || variants.has(object.variant) ||
        !Number.isInteger(object.width) || object.width < 1 || object.width > 12_000 ||
        !Number.isInteger(object.height) || object.height < 1 || object.height > 12_000 ||
        bytes.length < 1 || bytes.length > 10 * 1024 * 1024 || !hex.test(object.sha256 || "") || sha256(bytes) !== object.sha256)
        throw new Error("Promotion media object is invalid.");
      variants.add(object.variant);
      return { variant: object.variant, width: object.width, height: object.height, sha256: object.sha256, bytes: bytes.toString("base64") };
    });
    return { id: item.id, altText: item.altText, rights: item.rights, objects };
  });
  if (ids.size !== referenced.size || [...referenced].some((id) => !ids.has(id)))
    throw new Error("Promotion is missing referenced media.");
  const payload = { version: 1, source: { ...source, contentFingerprint: fingerprint(validatedPages) }, pages: validatedPages, media: validatedMedia };
  return Object.freeze({ ...payload, fingerprint: fingerprint(payload) });
}

export function verifyPromotionBundle(bundle) {
  if (!bundle || bundle.version !== 1 || !hex.test(bundle.fingerprint || ""))
    throw new Error("Promotion bundle is invalid.");
  const { fingerprint: supplied, ...payload } = bundle;
  const rebuilt = createPromotionBundle(payload);
  if (rebuilt.fingerprint !== supplied) throw new Error("Promotion bundle integrity check failed.");
  return rebuilt;
}

export async function exportPromotionBundle({ publication, media, source, approvedPages }) {
  const live = await publication.lastLive();
  if (!live?.id || !live.manifest || !live.deployment_id) throw new Error("A verified live staging publication is required.");
  // Use the baseline captured by the verified publication, not a newer checkout.
  const baselinePages = live.manifest.baseline || approvedPages;
  const siteAppearance = {
    heading: "Shared website imagery", body: "", ctaLabel: "", ctaPath: "/#plan",
    seoTitle: "Website appearance", seoDescription: "Internal shared imagery settings.",
  };
  const pages = Object.fromEntries(pageNames.map((slug) => {
    const publicBaseline = baselinePages[slug] ?? (slug === "site-appearance" ? siteAppearance : null);
    const baseline = publicBaseline === null ? null : approvedEditorCopy(publicBaseline);
    return [slug, baseline === null ? null : contentForPage(slug, baseline)];
  }));
  for (const item of live.manifest.pages || []) pages[item.slug] = item.body === null ? null : contentForPage(item.slug, item.body);
  const mediaIds = new Set(pageNames.flatMap((slug) => pages[slug] ? contentMediaIds(pages[slug]) : []));
  const transferred = [];
  for (const id of mediaIds) {
    const stored = await media.get(id);
    if (stored.archived_at) throw new Error("Published staging content references archived media.");
    const objects = [];
    for (const derivative of stored.derivatives) {
      const bytes = await media.store.get(derivative.key);
      objects.push({ variant: derivative.variant, width: derivative.width, height: derivative.height,
        sha256: sha256(bytes), bytes: bytes.toString("base64") });
    }
    transferred.push({ id, altText: stored.alt_text, rights: stored.rights, objects });
  }
  return createPromotionBundle({
    source: { ...source, environment: "staging", approvedBaselineFingerprint: fingerprint(baselinePages), publicationId: live.id,
      deploymentId: live.deployment_id, sourceSha: live.source_sha },
    pages,
    media: transferred,
  });
}

export class ContentPromotionImporter {
  constructor(pool, store, { organisationId, actorId, transact = transaction }) {
    if (!pool || !store || !uuid.test(organisationId || "") || !uuid.test(actorId || ""))
      throw new Error("Promotion importer configuration is incomplete.");
    Object.assign(this, { pool, store, organisationId, actorId, transact });
  }

  async apply(input, requestId = randomUUID()) {
    const bundle = verifyPromotionBundle(input);
    if (bundle.source.organisationId !== this.organisationId)
      throw new Error("Promotion source organisation does not match production.");
    const keys = [];
    try {
      await this.transact(this.pool, async (client) => {
        // Serialise the one-time import before touching object storage. Without
        // this lock, a losing concurrent importer could remove the winner's
        // objects while cleaning up its own failed attempt.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended('twe_content_promotion:' || $1, 0))", [this.organisationId]);
        const actor = await client.query("SELECT role, active FROM twe.staff_users WHERE organisation_id=$1 AND id=$2 FOR SHARE", [this.organisationId, this.actorId]);
        if (actor.rows.length !== 1 || actor.rows[0].active !== true || !["owner", "platform_admin"].includes(actor.rows[0].role))
          throw new Error("Production promotion requires an active Owner or Superadmin.");
        const existing = await client.query("SELECT count(*)::int AS count FROM twe.content_items WHERE organisation_id=$1 AND (publication_initialized OR draft_revision_id IS NOT NULL OR published_revision_id IS NOT NULL)", [this.organisationId]);
        if (existing.rows[0].count !== 0) throw new Error("Production content is already initialised; promotion will not overwrite it.");
        if (bundle.media.length) {
          const collision = await client.query("SELECT count(*)::int AS count FROM twe.media WHERE organisation_id=$1 AND id = ANY($2::uuid[])", [this.organisationId, bundle.media.map(({ id }) => id)]);
          if (collision.rows[0].count !== 0) throw new Error("Promotion media already exists; import will not overwrite it.");
        }
        for (const media of bundle.media) for (const object of media.objects) {
          const key = `${this.organisationId}/${media.id}/${object.variant}.webp`;
          await this.store.put(key, Buffer.from(object.bytes, "base64"));
          keys.push(key);
        }
        for (const media of bundle.media) {
          const largest = media.objects.reduce((current, object) =>
            Buffer.from(object.bytes, "base64").length > Buffer.from(current.bytes, "base64").length ? object : current);
          const derivatives = media.objects.map((object) => ({ key: `${this.organisationId}/${media.id}/${object.variant}.webp`, variant: object.variant, width: object.width, height: object.height }));
          await client.query(`INSERT INTO twe.media
            (id, organisation_id, object_key, mime_type, byte_size, width, height, alt_text, rights, derivatives, created_by)
            VALUES ($1,$2,$3,'image/webp',$4,$5,$6,$7,$8,$9,$10)`,
          [media.id, this.organisationId, derivatives.at(-1).key, Buffer.from(largest.bytes, "base64").length,
            largest.width, largest.height, media.altText, media.rights, derivatives, this.actorId]);
        }
        for (const slug of pageNames) {
          const body = bundle.pages[slug];
          const contentId = randomUUID();
          await client.query("INSERT INTO twe.content_items (id, organisation_id, kind, slug, publication_initialized) VALUES ($1,$2,'page',$3,true)", [contentId, this.organisationId, slug]);
          if (body === null) continue;
          const revisionId = randomUUID();
          await client.query("INSERT INTO twe.content_revisions (id, organisation_id, content_id, version, body, editor_id) VALUES ($1,$2,$3,1,$4,$5)", [revisionId, this.organisationId, contentId, body, this.actorId]);
          for (const mediaId of contentMediaIds(body)) await client.query("INSERT INTO twe.content_media (organisation_id, content_id, revision_id, media_id) VALUES ($1,$2,$3,$4)", [this.organisationId, contentId, revisionId, mediaId]);
          await client.query("UPDATE twe.content_items SET version=1, draft_revision_id=$1, published_revision_id=$1, published_body=$2 WHERE organisation_id=$3 AND id=$4", [revisionId, body, this.organisationId, contentId]);
        }
        await appendAudit(client, { organisationId: this.organisationId, actorId: this.actorId,
          action: "content.production_seed_imported", recordId: bundle.source.publicationId, requestId });
      });
      return { status: "imported", sourcePublicationId: bundle.source.publicationId, contentFingerprint: bundle.source.contentFingerprint };
    } catch (error) {
      for (const key of keys.reverse()) try { await this.store.remove(key); } catch { /* operator cleanup is documented */ }
      throw error;
    }
  }
}
