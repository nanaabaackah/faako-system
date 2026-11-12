import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PreviewService, rewritePreviewDocument } from "../src/content/preview.js";
import { publicBuildEnvironment } from "../src/content/build.js";
import { isAllowedPortalApiRoute } from "../src/portal/proxy.js";

const actor = { id: "editor", organisationId: "tenant-one" };
test("private previews bind saved version, tenant, actor and expiry; no drafts from other sections", async () => {
  let now = 0, resolve;
  const reads = [];
  const service = new PreviewService({ organisationId: actor.organisationId, environment: "test", now: () => now,
    repository: { list: async () => [{ slug: "home" }, { slug: "about", publication_initialized: true }], get: async (slug, published) => { reads.push({ slug, published }); return slug === "home" ? { version: 2, body: { heading: "Private draft", body: "", seoTitle: "Preview", seoDescription: "Draft" } } : null; } },
    build: () => new Promise(done => { resolve = done; }),
    prepare: async () => ({ snapshot: "fixture", publicDirectory: "fixture" }),
    siteOrigin: "https://staging.travelwitheasegh.com", apiOrigin: "",
  });
  try {
    await assert.rejects(service.create("home", 1, actor), { status: 409 });
    await assert.rejects(service.create("home", 2, { ...actor, organisationId: "another" }), { status: 403 });
    reads.length = 0;
    const job = await service.create("home", 2, actor);
    assert.equal(job.status, "building");
    assert.ok(reads.filter(row => row.slug !== "home").every(row => row.published === true));
    assert.throws(() => service.get(job.id, { ...actor, id: "different-user" }), { status: 404 });
    await assert.rejects(service.create("home", 2, actor), { status: 409 });
    for (let i = 0; !resolve && i < 100; i++) await new Promise(done => setTimeout(done, 10));
    assert.equal(typeof resolve, "function"); resolve();
    await new Promise(done => setTimeout(done, 0));
    assert.equal(service.get(job.id, actor).status, "ready");
    now = 600_001;
    assert.throws(() => service.get(job.id, actor), { status: 404 });
  } finally { now = Infinity; await service.cleanup(); }
});
test("preview asset reads reject traversal, hidden files, other tenants and expired sessions", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "twe-preview-test-"));
  const service = new PreviewService({ organisationId: actor.organisationId });
  const id = "10000000-0000-4000-8000-000000000001";
  service.jobs.set(id, { actorId: actor.id, out: directory, status: "ready", expires: Date.now() + 10000 });
  try {
    await mkdir(path.join(directory, "_astro"));
    await writeFile(path.join(directory, "index.html"), '<img src="/media/photo.webp"><script>alert(1)</script>');
    const file = await service.file(id, "index.html", actor);
    assert.match(file.bytes, /\/api\/agent\/content\/previews\//); assert.doesNotMatch(file.bytes, /script/);
    for (const target of ["../secret", "%2e%2e/secret", ".env", "_astro/../../secret", "//etc/passwd", "\\etc"]) await assert.rejects(service.file(id, target, actor), { status: 404 });
    await assert.rejects(service.file(id, "index.html", { ...actor, organisationId: "other" }), { status: 404 });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test("preview rewriting keeps CSS/photos inside authenticated route and strips executable scripts", () => {
  const text = '<link href="/_astro/style.css"><img srcset="/a.webp 640w, /b.webp 1280w"><script type="module" src="/x.js"></script>';
  const result = rewritePreviewDocument(text, "/private/", true);
  assert.match(result, /href="\/private\/_astro\/style.css"/);
  assert.match(result, /\/private\/a.webp 640w, \/private\/b.webp 1280w/);
  assert.doesNotMatch(result, /script|x.js/);
  assert.equal(rewritePreviewDocument('a{background:url("/a.webp")}', "/private/", false), 'a{background:url("/private/a.webp")}');
});
test("preview routes are explicitly allowlisted and public build environment never forwards secrets", () => {
  const id = "10000000-0000-4000-8000-000000000001";
  assert.equal(isAllowedPortalApiRoute("POST", "/api/agent/content/home/visual-preview"), true);
  assert.equal(isAllowedPortalApiRoute("GET", `/api/agent/content/previews/${id}/files/_astro/styles.css`), true);
  assert.equal(isAllowedPortalApiRoute("GET", `/api/agent/content/previews/${id}/files/../.env`), false);
  const env = publicBuildEnvironment({ environment: "staging", snapshot: "fixture", publicDirectory: "fixture", out: "fixture", siteOrigin: "https://staging.travelwitheasegh.com", apiOrigin: "" });
  assert.equal(env.PUBLIC_SITE_INDEXABLE, "false");
  assert.ok(Object.keys(env).every(key => !/SECRET|TOKEN|DATABASE|ACCESS/.test(key)));
});
