import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { decodeJwt } from "jose";
import { DriveReader, readDriveConfig } from "../src/media/drive.js";
import { MediaService } from "../src/media/service.js";
import { MAX_UPLOAD_BYTES } from "../src/media/images.js";
import express from "express";
import { once } from "node:events";
import { mediaRoutes } from "../src/media/routes.js";
import { hasPermission } from "../src/auth/permissions.js";

const folderId = "synthetic_folder_123";
const fileId = "synthetic_image_123";
const bytes = Buffer.from("synthetic-file-content");
const checksum = createHash("md5").update(bytes).digest("hex");
const file = (overrides = {}) => ({
  id: fileId,
  name: "Synthetic image",
  mimeType: "image/png",
  size: String(bytes.length),
  version: "1",
  md5Checksum: checksum,
  parents: [folderId],
  trashed: false,
  capabilities: { canDownload: true },
  ...overrides,
});
const json = (value) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
const reader = (fetcher) => {
  const instance = new DriveReader({ folderId }, fetcher);
  instance.accessToken = async () => "synthetic-not-a-real-token";
  return instance;
};

test("Drive configuration mirrors TTNGH's JSON format but never falls back to another app's credentials", () => {
  assert.equal(
    readDriveConfig({
      GOOGLE_SERVICE_ACCOUNT_JSON: "other-app",
      GOOGLE_DRIVE_MEDIA_FOLDER_ID: folderId,
    }),
    null,
  );
  const credentials = {
    type: "service_account",
    client_email: "twe@synthetic.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nsynthetic",
    token_uri: "https://oauth2.googleapis.com/token",
  };
  const env = {
    TWE_GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify(credentials),
    TWE_GOOGLE_DRIVE_MEDIA_FOLDER_ID: folderId,
  };
  assert.equal(readDriveConfig(env).folderId, folderId);
  for (const values of [
    { ...env, TWE_GOOGLE_DRIVE_MEDIA_FOLDER_ID: "https://untrusted.invalid" },
    { ...env, TWE_GOOGLE_SERVICE_ACCOUNT_JSON: "not-json-sensitive-value" },
    {
      ...env,
      TWE_GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        ...credentials,
        token_uri: "https://untrusted.invalid",
      }),
    },
    { TWE_GOOGLE_DRIVE_MEDIA_FOLDER_ID: folderId },
  ])
    assert.throws(() => readDriveConfig(values), {
      message: "TWE Google Drive configuration is incomplete or invalid.",
    });
});

test("service-account token uses read-only scope, fixed Google audience, short assertion and cached refresh", async () => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  let calls = 0;
  const drive = new DriveReader(
    { folderId, privateKey, email: "twe@synthetic.iam.gserviceaccount.com" },
    async (url, options) => {
      calls++;
      assert.equal(url, "https://oauth2.googleapis.com/token");
      assert.equal(options.redirect, "error");
      const claim = decodeJwt(options.body.get("assertion"));
      assert.equal(
        claim.scope,
        "https://www.googleapis.com/auth/drive.readonly",
      );
      assert.equal(claim.aud, url);
      assert.equal(claim.sub, undefined, "No domain-wide impersonation");
      assert.equal(claim.exp - claim.iat, 300);
      return json({
        access_token: "synthetic-token",
        token_type: "Bearer",
        expires_in: 3600,
      });
    },
  );
  assert.deepEqual(
    await Promise.all([drive.accessToken(), drive.accessToken()]),
    ["synthetic-token", "synthetic-token"],
  );
  assert.equal(calls, 1);
  drive.token.expires = 0;
  await drive.accessToken();
  assert.equal(calls, 2);
});

test("folder listing is bounded, paginated, direct-parent scoped and filters unsupported or blocked files", async () => {
  const drive = reader(async (url, options) => {
    assert.equal(url.origin, "https://www.googleapis.com");
    assert.match(url.searchParams.get("q"), new RegExp(folderId));
    assert.equal(url.searchParams.get("pageSize"), "100");
    assert.equal(url.searchParams.get("pageToken"), "next+page==");
    assert.equal(options.redirect, "error");
    return json({
      files: [
        file(),
        file({ parents: ["different_folder_123"] }),
        file({ mimeType: "image/svg+xml" }),
        file({ trashed: true }),
        file({ capabilities: { canDownload: false } }),
        file({ size: String(MAX_UPLOAD_BYTES + 1) }),
      ],
      nextPageToken: "more",
      incompleteSearch: false,
    });
  });
  const result = await drive.list("next+page==");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, fileId);
  assert.equal(result.nextPageToken, "more");
  assert.equal(
    result.items[0].parents,
    undefined,
    "No folder metadata leaked to browser",
  );
  await assert.rejects(drive.list("x".repeat(2049)));
});

test("metadata rejects foreign parents and arbitrary URL IDs before downloading", async () => {
  let calls = 0;
  const drive = reader(async () => {
    calls++;
    return json(file({ parents: ["foreign_folder_123"] }));
  });
  await assert.rejects(drive.metadata(fileId), { status: 400 });
  await assert.rejects(drive.metadata("https://untrusted.invalid/private"));
  assert.equal(calls, 1);
});

test("download validates MIME, size, checksum and the unchanged source revision", async () => {
  for (const mode of ["ok", "html", "checksum", "changed"]) {
    const drive = reader(async (url) => {
      if (url.searchParams.get("alt") === "media")
        return new Response(
          mode === "checksum" ? Buffer.from("wrong") : bytes,
          {
            headers: {
              "content-type": mode === "html" ? "text/html" : "image/png",
            },
          },
        );
      return json(file(mode === "changed" ? { version: "2" } : {}));
    });
    if (mode === "ok")
      assert.deepEqual(await drive.download(drive.validateFile(file())), bytes);
    else await assert.rejects(drive.download(drive.validateFile(file())));
  }
});

test("oversized downloads are stopped even without Content-Length; upstream errors are redacted", async () => {
  const drive = reader(
    async () =>
      new Response(Buffer.alloc(MAX_UPLOAD_BYTES + 1), {
        headers: { "content-type": "image/png" },
      }),
  );
  await assert.rejects(drive.download(drive.validateFile(file())), {
    status: 413,
  });
  const failing = reader(async () => {
    throw new Error("sensitive-upstream-token");
  });
  await assert.rejects(failing.metadata(fileId), (error) => {
    assert.equal(error.status, 503);
    assert.doesNotMatch(error.message, /sensitive/);
    return true;
  });
});

test("import rejects tenant mismatch, stale revision, and concurrent work; unchanged source is idempotent", async () => {
  const actor = { id: "synthetic-actor", organisationId: "tenant-a" };
  let downloads = 0;
  const drive = {
    config: { folderId },
    async metadata() {
      return file();
    },
    async download() {
      downloads++;
      return bytes;
    },
  };
  const pool = {
    async query() {
      return {
        rows: [
          {
            id: "existing-asset",
            archived_at: null,
            source_checksum: checksum,
          },
        ],
      };
    },
  };
  const service = new MediaService(pool, "tenant-a", {}, null, drive);
  const input = {
    fileId,
    version: "1",
    alt: "Synthetic image",
    rights: "Generated test fixture",
  };
  await assert.rejects(
    service.importDrive(input, { ...actor, organisationId: "tenant-b" }),
    { status: 403 },
  );
  await assert.rejects(service.importDrive({ ...input, version: "2" }, actor), {
    status: 409,
  });
  assert.deepEqual(await service.importDrive(input, actor), {
    id: "existing-asset",
    unchanged: true,
  });
  assert.equal(downloads, 0);
  service.driveImporting = true;
  await assert.rejects(service.importDrive(input, actor), { status: 429 });
  const unavailable = new MediaService(pool, "tenant-a", {});
  await assert.rejects(unavailable.importDrive(input, actor), { status: 503 });
});

test("archived source revisions cannot silently reappear through sync", async () => {
  const service = new MediaService(
    {
      async query() {
        return { rows: [{ id: "archived", archived_at: new Date() }] };
      },
    },
    "tenant-a",
    {},
  );
  await assert.rejects(
    service.driveRevision({ folderId, fileId, version: "1" }),
    { status: 409 },
  );
});

test("Drive routes enforce media permissions, CSRF, input validation and platform/business separation", async (context) => {
  let role = "owner",
    imports = 0;
  const service = {
    async listDrive() {
      return { configured: true, items: [], nextPageToken: "" };
    },
    async importDrive() {
      imports++;
      return { id: "synthetic-asset" };
    },
  };
  const auth = {
    requirePermission: (permission) => (req, res, next) => {
      req.staff = {
        id: "synthetic-user",
        role,
        organisationId: "synthetic-org",
      };
      if (!hasPermission(req.staff, permission, "synthetic-org"))
        return res.sendStatus(403);
      next();
    },
    requireMutation: (req, res, next) =>
      req.get("X-CSRF-Token") === "synthetic-csrf"
        ? next()
        : res.sendStatus(403),
  };
  const app = express();
  app.use(express.json());
  app.use(mediaRoutes({ service, auth }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const current of ["owner", "editor", "platform_admin"]) {
    role = current;
    assert.equal(
      (await fetch(origin + "/drive")).status,
      current === "platform_admin" ? 403 : 200,
    );
  }
  const body = JSON.stringify({
    fileId,
    version: "1",
    alt: "Fixture",
    rights: "Generated test fixture",
  });
  const headers = {
    "Content-Type": "application/json",
    "X-CSRF-Token": "synthetic-csrf",
  };
  assert.equal(
    (await fetch(origin + "/drive/import", { method: "POST", headers, body }))
      .status,
    403,
  );
  role = "owner";
  assert.equal(
    (
      await fetch(origin + "/drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(origin + "/drive/import", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: "https://untrusted.invalid" }),
      })
    ).status,
    400,
  );
  assert.equal(
    (await fetch(origin + "/drive/import", { method: "POST", headers, body }))
      .status,
    201,
  );
  assert.equal(imports, 1);
});
