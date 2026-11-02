import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import sharp from "sharp";
import { prepareImage, MAX_UPLOAD_BYTES } from "../src/media/images.js";
import { MediaService } from "../src/media/service.js";
import { readR2Config } from "../src/media/r2.js";
import { createApp, createLimiter } from "../src/app.js";
import { createStaffAuth } from "../src/auth/routes.js";

const fixture = () => sharp({ create: { width: 32, height: 24, channels: 3, background: "#010c33" } }).png().toBuffer();

test("media decodes and re-encodes bounded images without enlargement or original metadata", async () => {
  const bytes = await fixture();
  const outputs = await prepareImage(bytes, "image/png");
  assert.deepEqual(outputs.map((item) => item.variant), [640, 1280, 1920]);
  for (const output of outputs) {
    const metadata = await sharp(output.bytes).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 32);
    assert.equal(metadata.height, 24);
    assert.equal(metadata.exif, undefined);
  }
  for (const [input, type] of [[bytes, "image/jpeg"], [bytes, "image/svg+xml"], [Buffer.from("not an image"), "image/png"]]) {
    await assert.rejects(prepareImage(input, type), { status: 400 });
  }
  await assert.rejects(prepareImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1), "image/png"), { status: 413 });
});

test("R2 is optional, rejects partial configuration and enforces environment bucket isolation", () => {
  assert.equal(readR2Config({}), null);
  assert.throws(() => readR2Config({ TWE_R2_PRIVATE_BUCKET: "twe-development-media" }));
  const env = { APP_ENV: "test", TWE_R2_ACCOUNT_ID: "a".repeat(32), TWE_R2_ACCESS_KEY_ID: "synthetic", TWE_R2_SECRET_ACCESS_KEY: "synthetic", TWE_R2_PRIVATE_BUCKET: "twe-test-media" };
  assert.equal(readR2Config(env).bucket, "twe-test-media");
  assert.throws(() => readR2Config({ ...env, TWE_R2_PRIVATE_BUCKET: "twe-production-media" }));
});

test("failed media uploads clean up candidate objects and release processing capacity", async () => {
  const attempted = [], removed = [];
  const store = { async put(key) { attempted.push(key); if (attempted.length === 2) throw new Error("synthetic storage failure"); }, async remove(key) { removed.push(key); } };
  const service = new MediaService(null, "synthetic-org", store);
  await assert.rejects(service.upload(await fixture(), "image/png", { alt: "Synthetic fixture", rights: "Generated test fixture" }, { id: "synthetic-user", organisationId: "synthetic-org" }, "test-request"), /synthetic storage failure/);
  assert.deepEqual(removed, attempted);
  assert.equal(service.processing, 0);
  await assert.rejects(service.upload(null, null, {}, { organisationId: "other-org" }), { status: 403 });
});

test("replacement lookups reserve capacity and release it when lookup fails", async () => {
  const lookups = [];
  const service = new MediaService({ query: () => new Promise((resolve) => lookups.push(resolve)) }, "synthetic-org", {});
  const upload = () => service.upload(null, "image/png", { alt: "Synthetic fixture", rights: "Generated test fixture" }, { organisationId: "synthetic-org" }, "test-request", "synthetic-replacement");
  const first = assert.rejects(upload(), { status: 404 });
  const second = assert.rejects(upload(), { status: 404 });
  assert.equal(service.processing, 2);
  await assert.rejects(upload(), { status: 429 });
  assert.equal(lookups.length, 2);
  for (const resolve of lookups) resolve({ rows: [] });
  await Promise.all([first, second]);
  assert.equal(service.processing, 0);
});

test("media requires staff sessions and upload CORS retains exact origin checks", async (context) => {
  assert.throws(() => createApp({ mediaService: {} }), /Media requires staff sessions/);
  const auth = createStaffAuth({ limiter: createLimiter({ limit: 10, windowMs: 60_000 }) });
  const server = createApp({ mediaService: {}, staffAuth: auth, allowedOrigins: ["http://localhost:5188"] }).listen(0, "127.0.0.1");
  await once(server, "listening"); context.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/agent/media`;
  assert.equal((await fetch(base)).status, 401);
  assert.equal((await fetch(base + "/drive")).status, 401);
  assert.equal((await fetch(base + "/drive/import", { method: "POST", body: "{}" })).status, 401);
  assert.equal((await fetch(base + "/upload", { method: "POST", body: "invalid" })).status, 401);
  const preflight = await fetch(base + "/upload", { method: "OPTIONS", headers: { origin: "http://localhost:5188" } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:5188");
  assert.match(preflight.headers.get("access-control-allow-headers"), /X-Media-Alt, X-Media-Rights/);
  const foreign = await fetch(base + "/upload", { method: "OPTIONS", headers: { origin: "https://untrusted.invalid" } });
  assert.equal(foreign.headers.get("access-control-allow-origin"), null);
});
