import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ContentError, pageNames } from "./schema.js";
import { preparePublication } from "./artifact.js";
import { publicBuildEnvironment, runReviewedCommand } from "./build.js";

const ttl = 10 * 60_000;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };
export function rewritePreviewDocument(text, prefix, html) {
  const rewrite = value => value.replace(/(^|[,\s])\/(?!\/)/g, `$1${prefix}`);
  let result = text.replace(/url\(\s*(["']?)(\/(?!\/)[^)'"\s]+)\1\s*\)/g, (_all, quote, url) => `url(${quote}${prefix}${url.slice(1)}${quote})`);
  if (html) {
    result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
    result = result.replace(/\b(src|href|srcset|poster|action)=(['"])(.*?)\2/gi, (_all, attr, quote, value) => `${attr}=${quote}${rewrite(value)}${quote}`);
  }
  return result;
}

export class PreviewService {
  constructor({ repository, media, organisationId, environment, siteOrigin, apiOrigin,
    build = runReviewedCommand, prepare = preparePublication, now = Date.now }) {
    Object.assign(this, { repository, media, organisationId, environment, siteOrigin, apiOrigin, build, prepare, now });
    this.jobs = new Map(); this.building = false;
  }
  async cleanup() {
    for (const [id, job] of this.jobs) if (job.expires <= this.now() && job.status !== "building") {
      this.jobs.delete(id);
      if (job.directory) await rm(job.directory, { recursive: true, force: true });
    }
  }
  authorize(job, actor) {
    if (!job || job.expires <= this.now() || actor.organisationId !== this.organisationId || job.actorId !== actor.id) {
      throw new ContentError(404, "not_found", "Preview not found or expired. Create a new saved-draft preview.");
    }
    return job;
  }
  async create(page, expectedVersion, actor) {
    if (actor.organisationId !== this.organisationId) throw new ContentError(403, "permission_error", "Organisation access denied.");
    await this.cleanup();
    if (this.building || this.jobs.size >= 12) throw new ContentError(409, "conflict", "A preview is already building or the preview limit was reached. Wait before trying again.");
    const selected = await this.repository.get(page);
    if (!selected || selected.version !== expectedVersion) throw new ContentError(409, "conflict", "Save the current draft before creating a preview.");
    // Only this selected draft joins other *published* revisions. No other
    // editor's unsaved/unpublished collection is leaked into the preview.
    const pages = [];
    const existing = new Set((await this.repository.list()).filter(item => item.publication_initialized || item.published_revision_id).map(item => item.slug));
    for (const slug of pageNames) {
      if (slug !== page && !existing.has(slug)) continue;
      const item = slug === page ? selected : await this.repository.get(slug, true);
      pages.push({ slug, body: item?.body || null });
    }
    const job = { id: randomUUID(), actorId: actor.id, page, version: expectedVersion,
      status: "building", expires: this.now() + ttl };
    this.jobs.set(job.id, job); this.building = true;
    void this.render(job, pages);
    return this.describe(job);
  }
  describe(job) { return { id: job.id, page: job.page, version: job.version, status: job.status,
    expiresAt: new Date(job.expires).toISOString(),
    ...(job.status === "ready" ? { url: `/api/agent/content/previews/${job.id}/files/${['home','site-appearance'].includes(job.page) ? "" : job.page + "/"}index.html` } : {}),
    ...(job.status === "failed" ? { message: "The website preview could not be built. Your saved draft is unchanged." } : {}) }; }
  get(id, actor) { return this.describe(this.authorize(this.jobs.get(id), actor)); }
  async render(job, pages) {
    try {
      job.directory = await mkdtemp(path.join(tmpdir(), "twe-private-preview-"));
      const artifact = await this.prepare({ id: job.id, source_sha: "private-preview", manifest: { version: 1, pages } }, this.media, job.directory, { approvedBaseline: true });
      job.out = path.join(job.directory, "dist");
      await this.build("pnpm", ["--filter", "@faako/travel-with-ease-web", "run", "build"], publicBuildEnvironment({
        environment: this.environment, snapshot: artifact.snapshot, publicDirectory: artifact.publicDirectory,
        out: job.out, siteOrigin: this.siteOrigin, apiOrigin: this.apiOrigin,
      }));
      job.status = "ready";
    } catch { job.status = "failed"; }
    finally { this.building = false; }
  }
  async file(id, relative, actor) {
    const job = this.authorize(this.jobs.get(id), actor);
    if (job.status !== "ready") throw new ContentError(409, "conflict", "The preview is not ready.");
    if (typeof relative !== "string" || relative.length > 500 || /[%\\\0?#]/.test(relative) || relative.split("/").some(part => part === ".." || part.startsWith("."))) {
      throw new ContentError(404, "not_found", "Preview asset not found.");
    }
    let target = path.resolve(job.out, relative || "index.html");
    const base = await realpath(job.out);
    try {
      if (!path.extname(target)) target = path.join(target, "index.html");
      target = await realpath(target);
      if (!target.startsWith(base + path.sep) || !types[path.extname(target)]) throw new Error();
      const bytes = await readFile(target), extension = path.extname(target);
      if ([".html", ".css"].includes(extension)) return { type: types[extension], bytes: rewritePreviewDocument(bytes.toString("utf8"), `/api/agent/content/previews/${id}/files/`, extension === ".html") };
      return { type: types[extension], bytes };
    } catch { throw new ContentError(404, "not_found", "Preview asset not found."); }
  }
}
