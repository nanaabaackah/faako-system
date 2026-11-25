import { createHash, randomUUID } from "node:crypto";
import { contentForPage, contentMediaIds, pageNames } from "./schema.js";
import { transaction } from "../db/database.js";
import { appendAudit } from "../audit.js";
import { approvedEditorCopy } from "./approved-copy.js";
import { INTAKE_FORM_ID, defaultIntakeDefinition, intakeDefinitionSchema } from "../enquiries/intake-definition.js";
import { DETAILED_FORM_ID, defaultDetailedDefinition, detailedDefinitionSchema } from "../enquiries/questionnaires/configuration.js";
import { templateCopySchema } from "../notifications/templates.js";
import { emailTemplateOptions, packageTemplatePattern } from "../notifications/template-catalogue.js";
import { PublicationRepository } from "./publication.js";
import approvedRelease from "../../../travel-with-ease-web/content/approved-public-release.json" with { type: "json" };

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const fingerprint = (value) => sha256(JSON.stringify(stable(value)));
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hex = /^[a-f0-9]{64}$/;
const legacyTemplateSlugs = ["enquiry-acknowledgement", "staff-invitation"];
const templateSlugs = emailTemplateOptions.map(option => option.slug);

const formSpecs = {
  [INTAKE_FORM_ID]: { schema: intakeDefinitionSchema, defaults: defaultIntakeDefinition },
  [DETAILED_FORM_ID]: { schema: detailedDefinitionSchema, defaults: defaultDetailedDefinition },
};
const formIds = Object.keys(formSpecs);
export function createPromotionBundle({ source, pages, media = [], emailTemplates, enquiryForms }) {
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
  // Older reviewed bundles remain verifiable. New exports include active
  // template copy only, never draft, delivery payload or recipient configuration.
  let validatedTemplates;
  if (emailTemplates !== undefined) {
    if (!emailTemplates || typeof emailTemplates !== "object" || Array.isArray(emailTemplates)) throw new Error("Invalid active email templates.");
    const slugs = Object.keys(emailTemplates);
    const legacy = slugs.length === legacyTemplateSlugs.length && legacyTemplateSlugs.every(slug => slugs.includes(slug));
    const allowedPackages = new Set((validatedPages.packages?.packages || []).map(item => "enquiry-package-" + item.id));
    if (!legacy && (!templateSlugs.every(slug => slugs.includes(slug)) || slugs.some(slug => !templateSlugs.includes(slug) && !(packageTemplatePattern.test(slug) && allowedPackages.has(slug)))))
      throw new Error("Promotion must include every shared template and only published package overrides.");
    validatedTemplates = Object.fromEntries(slugs.map(slug => [slug, templateCopySchema.parse(emailTemplates[slug])]));
  }
  let validatedForms;
  if (enquiryForms !== undefined) {
    if (!enquiryForms || Object.keys(enquiryForms).sort().join("|") !== [...formIds].sort().join("|")) throw new Error("Promotion requires both active enquiry forms.");
    validatedForms = Object.fromEntries(formIds.map(id => {
      const value = enquiryForms[id];
      if (!value || Object.keys(value).sort().join("|") !== "definition|formId|version" || value.formId !== id || !Number.isSafeInteger(value.version) || value.version < 1 || value.version > 2147483645) throw new Error("Invalid active form version.");
      return [id, { formId: id, version: value.version, definition: formSpecs[id].schema.parse(value.definition) }];
    }));
  }
  const payload = { version: 1, source: { ...source, contentFingerprint: fingerprint(validatedPages) }, pages: validatedPages, media: validatedMedia,
    ...(validatedTemplates ? { emailTemplates: validatedTemplates } : {}), ...(validatedForms ? { enquiryForms: validatedForms } : {}) };
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

export async function exportPromotionBundle({ publication, media, source, approvedPages, templates, forms }) {
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
  const emailTemplates = templates
    ? typeof templates.exportActiveCopies === "function"
      ? await templates.exportActiveCopies((pages.packages?.packages || []).map(item => item.id))
      : Object.fromEntries(await Promise.all(legacyTemplateSlugs.map(async slug => [slug, await templates.activeCopy(slug)])))
    : undefined;
  const enquiryForms = forms ? Object.fromEntries(await Promise.all(formIds.map(async id => [id, await forms[id].active()]))) : undefined;
  return createPromotionBundle({
    source: { ...source, environment: "staging", approvedBaselineFingerprint: fingerprint(baselinePages), publicationId: live.id,
      deploymentId: live.deployment_id, sourceSha: live.source_sha },
    pages,
    media: transferred,
    emailTemplates,
    enquiryForms,
  });
}

export class ContentPromotionImporter {
  constructor(pool, store, { organisationId, actorId, publicationSourceSha, transact = transaction }) {
    if (!pool || !store || !uuid.test(organisationId || "") || !uuid.test(actorId || ""))
      throw new Error("Promotion importer configuration is incomplete.");
    if (publicationSourceSha !== undefined && !/^[a-f0-9]{40}$/.test(publicationSourceSha)) throw new Error("Promotion requires a reviewed production source.");
    Object.assign(this, { pool, store, organisationId, actorId, publicationSourceSha, transact });
  }

  // A replay is accepted only when the original import is recorded and every
  // currently published/draft value and referenced object still matches.
  // Never reset production edits merely because the bundle is the same.
  async matchesImportedBundle(client, bundle) {
    const receipt = await client.query("SELECT 1 FROM twe.audit_records WHERE organisation_id=$1 AND action='content.production_seed_imported' AND record_id=$2 LIMIT 1", [this.organisationId, bundle.source.publicationId]);
    if (!receipt.rows.length) return false;
    const { rows } = await client.query(`SELECT c.slug, c.publication_initialized, c.published_body, r.body AS draft_body
      FROM twe.content_items c LEFT JOIN twe.content_revisions r ON r.id=c.draft_revision_id AND r.organisation_id=c.organisation_id
      WHERE c.organisation_id=$1`, [this.organisationId]);
    if (rows.length !== pageNames.length) return false;
    if (rows.some(row => !Object.hasOwn(bundle.pages, row.slug) || !row.publication_initialized ||
      fingerprint(row.published_body ?? null) !== fingerprint(bundle.pages[row.slug]) ||
      fingerprint(row.draft_body ?? null) !== fingerprint(bundle.pages[row.slug]))) return false;
    if (bundle.emailTemplates) {
      const result = await client.query("SELECT slug, draft, active FROM twe.email_templates WHERE organisation_id=$1 AND slug = ANY($2::text[])", [this.organisationId, Object.keys(bundle.emailTemplates)]);
      if (result.rows.length !== Object.keys(bundle.emailTemplates).length || result.rows.some(row =>
        !Object.hasOwn(bundle.emailTemplates, row.slug) || fingerprint(row.active) !== fingerprint(bundle.emailTemplates[row.slug]) ||
        fingerprint(row.draft) !== fingerprint(bundle.emailTemplates[row.slug]))) return false;
    }
    if (bundle.enquiryForms) {
      const result = await client.query("SELECT d.form_id,d.draft,d.active_version,v.definition FROM twe.enquiry_form_drafts d JOIN twe.enquiry_form_versions v ON v.organisation_id=d.organisation_id AND v.form_id=d.form_id AND v.version=d.active_version WHERE d.organisation_id=$1 AND d.form_id=ANY($2::text[])", [this.organisationId, formIds]);
      if (result.rows.length !== formIds.length || result.rows.some(row => {
        const form = bundle.enquiryForms[row.form_id];
        return !form || row.active_version !== form.version || fingerprint(row.draft) !== fingerprint(form.definition) || fingerprint(row.definition) !== fingerprint(form.definition);
      })) return false;
    }
    for (const item of bundle.media) {
      const result = await client.query("SELECT alt_text, rights, derivatives, archived_at FROM twe.media WHERE organisation_id=$1 AND id=$2", [this.organisationId, item.id]);
      const row = result.rows[0];
      if (!row || row.archived_at || row.alt_text !== item.altText || row.rights !== item.rights ||
        row.derivatives?.length !== item.objects.length) return false;
      for (const object of item.objects) {
        const key = `${this.organisationId}/${item.id}/${object.variant}.webp`;
        const derivative = row.derivatives.find(value => value.variant === object.variant);
        if (!derivative || derivative.key !== key || derivative.width !== object.width || derivative.height !== object.height ||
          sha256(await this.store.get(key)) !== object.sha256) return false;
      }
    }
    return true;
  }

  async apply(input, requestId = randomUUID()) {
    const bundle = verifyPromotionBundle(input);
    if (bundle.source.organisationId !== this.organisationId)
      throw new Error("Promotion source organisation does not match production.");
    if (this.publicationSourceSha && bundle.source.approvedBaselineFingerprint !== fingerprint(approvedRelease.pages))
      throw new Error("Production release baseline does not match the verified staging export.");
    const keys = [];
    let publicationId;
    try {
      const status = await this.transact(this.pool, async (client) => {
        // Serialise the one-time import before touching object storage. Without
        // this lock, a losing concurrent importer could remove the winner's
        // objects while cleaning up its own failed attempt.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended('twe_content_promotion:' || $1, 0))", [this.organisationId]);
        if (this.publicationSourceSha) await new PublicationRepository(this.pool, { organisationId: this.organisationId, environment: "production", sourceSha: this.publicationSourceSha }).lockOrganisation(client);
        const actor = await client.query("SELECT role, active FROM twe.staff_users WHERE organisation_id=$1 AND id=$2 FOR SHARE", [this.organisationId, this.actorId]);
        if (actor.rows.length !== 1 || actor.rows[0].active !== true || !["owner", "platform_admin"].includes(actor.rows[0].role))
          throw new Error("Production promotion requires an active Owner or Superadmin.");
        const existing = await client.query("SELECT count(*)::int AS count FROM twe.content_items WHERE organisation_id=$1 AND (publication_initialized OR draft_revision_id IS NOT NULL OR published_revision_id IS NOT NULL)", [this.organisationId]);
        if (existing.rows[0].count !== 0) {
          if (await this.matchesImportedBundle(client, bundle)) return "already_imported";
          throw new Error("Production content is already initialised or has changed; promotion will not overwrite it.");
        }
        if (this.publicationSourceSha) {
          const jobs = await client.query("SELECT id FROM twe.publication_jobs WHERE organisation_id=$1 AND environment='production' LIMIT 1", [this.organisationId]);
          if (jobs.rowCount) throw new Error("Production publication history already exists; initial promotion will not overwrite it.");
        }
        if (bundle.media.length) {
          const collision = await client.query("SELECT count(*)::int AS count FROM twe.media WHERE organisation_id=$1 AND id = ANY($2::uuid[])", [this.organisationId, bundle.media.map(({ id }) => id)]);
          if (collision.rows[0].count !== 0) throw new Error("Promotion media already exists; import will not overwrite it.");
        }
        if (bundle.enquiryForms) {
          for (const lock of ["twe-intake", "twe-detailed"]) await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock + ":" + this.organisationId]);
          const existingForms = await client.query("SELECT count(*)::int AS count FROM twe.enquiry_form_drafts WHERE organisation_id=$1 AND form_id=ANY($2::text[])", [this.organisationId, formIds]);
          if (existingForms.rows[0].count !== 0) throw new Error("Production enquiry forms already exist; promotion will not overwrite them.");
          for (const id of formIds) {
            const form = bundle.enquiryForms[id];
            await client.query("INSERT INTO twe.enquiry_form_drafts (organisation_id,form_id,revision,active_version,draft,updated_by) VALUES ($1,$2,1,$3,$4,$5)", [this.organisationId,id,form.version,form.definition,this.actorId]);
            if (form.version > 1) await client.query("INSERT INTO twe.enquiry_form_versions (organisation_id,form_id,version,definition,activated_by) VALUES ($1,$2,1,$3,$4)", [this.organisationId,id,formSpecs[id].defaults(),this.actorId]);
            await client.query("INSERT INTO twe.enquiry_form_versions (organisation_id,form_id,version,definition,activated_by) VALUES ($1,$2,$3,$4,$5)", [this.organisationId,id,form.version,form.definition,this.actorId]);
          }
        }
        if (bundle.emailTemplates) {
          const existingTemplates = await client.query("SELECT count(*)::int AS count FROM twe.email_templates WHERE organisation_id=$1", [this.organisationId]);
          if (existingTemplates.rows[0].count !== 0) throw new Error("Production email templates already exist; promotion will not overwrite them.");
          for (const slug of Object.keys(bundle.emailTemplates)) {
            const copy = bundle.emailTemplates[slug];
            await client.query(`INSERT INTO twe.email_templates (organisation_id, slug, version, draft, active, active_version, updated_by)
              VALUES ($1,$2,2,$3,$3,1,$4)`, [this.organisationId, slug, copy, this.actorId]);
            await client.query("INSERT INTO twe.email_template_revisions (organisation_id,slug,version,kind,copy,created_by) VALUES ($1,$2,1,'baseline',$3,$4),($1,$2,2,'activated',$3,$4)", [this.organisationId,slug,copy,this.actorId]);
          }
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
        const publicationPages = [];
        for (const slug of pageNames) {
          const body = bundle.pages[slug];
          const contentId = randomUUID();
          await client.query("INSERT INTO twe.content_items (id, organisation_id, kind, slug, publication_initialized) VALUES ($1,$2,'page',$3,true)", [contentId, this.organisationId, slug]);
          const revisionId = body === null ? null : randomUUID();
          publicationPages.push({ id: contentId, slug, revisionId, body });
          if (body === null) continue;
          await client.query("INSERT INTO twe.content_revisions (id, organisation_id, content_id, version, body, editor_id) VALUES ($1,$2,$3,1,$4,$5)", [revisionId, this.organisationId, contentId, body, this.actorId]);
          for (const mediaId of contentMediaIds(body)) await client.query("INSERT INTO twe.content_media (organisation_id, content_id, revision_id, media_id) VALUES ($1,$2,$3,$4)", [this.organisationId, contentId, revisionId, mediaId]);
          await client.query("UPDATE twe.content_items SET version=1, draft_revision_id=$1, published_revision_id=$1, published_body=$2 WHERE organisation_id=$3 AND id=$4", [revisionId, body, this.organisationId, contentId]);
        }
        if (this.publicationSourceSha) {
          publicationId = randomUUID();
          const manifest = { version: 1, schemaVersion: 2, triggerType: "initial_promotion", baseline: approvedRelease.pages,
            pages: publicationPages, target: { page: "website", version: bundle.source.publicationId, unpublish: false } };
          await client.query("INSERT INTO twe.publication_jobs (id, organisation_id, environment, manifest, source_sha, requested_by) VALUES ($1,$2,'production',$3,$4,$5)",
            [publicationId, this.organisationId, manifest, this.publicationSourceSha, this.actorId]);
          await appendAudit(client, { organisationId: this.organisationId, actorId: this.actorId,
            action: "content.publish_requested", recordId: publicationId, requestId });
        }
        await appendAudit(client, { organisationId: this.organisationId, actorId: this.actorId,
          action: "content.production_seed_imported", recordId: bundle.source.publicationId, requestId });
        return "imported";
      });
      return { status, ...(publicationId ? { publicationId } : {}), sourcePublicationId: bundle.source.publicationId, contentFingerprint: bundle.source.contentFingerprint };
    } catch (error) {
      for (const key of keys.reverse()) try { await this.store.remove(key); } catch { /* operator cleanup is documented */ }
      throw error;
    }
  }
}
