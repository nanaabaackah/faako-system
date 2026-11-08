import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { readFileSync } from "node:fs";
import {
  createWorkspaceServer,
  assertPreviewEnvironment,
} from "../dev/workspace-server.js";

const env = {
  APP_ENV: "test",
  NODE_ENV: "test",
  TWE_WORKSPACE_PREVIEW: "true",
};
test("workspace preview refuses hosted runtimes, credentials and accidental activation", () => {
  assert.doesNotThrow(() => assertPreviewEnvironment(env));
  for (const change of [
    { APP_ENV: "staging" },
    { APP_ENV: "production" },
    { NODE_ENV: "production" },
    { TWE_WORKSPACE_PREVIEW: "" },
    { DATABASE_URL: "synthetic" },
    { TWE_MIGRATION_DATABASE_URL: "synthetic" },
    { TWE_RESEND_API_KEY: "synthetic" },
    { RAILWAY_ENVIRONMENT_ID: "synthetic" },
    { CF_PAGES: "1" },
  ]) {
    assert.throws(() => assertPreviewEnvironment({ ...env, ...change }));
  }
});

test("real HTTP preview isolates roles, mutations, tutorial progress and reset", async () => {
  const server = createWorkspaceServer(env);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, json, headers = {}) => {
    const response = await fetch(origin + path, {
      method: json ? "POST" : "GET",
      headers: {
        ...(json
          ? {
              "Content-Type": "application/json",
              "X-CSRF-Token": "synthetic-not-a-credential",
            }
          : {}),
        ...headers,
      },
      ...(json ? { body: JSON.stringify(json) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const control = (json) =>
    request("/__workspace", json, { "X-TWE-Workspace": "local-preview" });
  try {
    assert.equal(
      (await request("/api/auth/session")).body.data.user.role,
      "owner",
    );
    assert.equal(
      (
        await request("/api/auth/session", null, {
          Origin: "https://evil.invalid",
        })
      ).status,
      403,
    );
    const foreignHost = await new Promise((resolve, reject) => {
      const req = httpRequest(
        origin + "/api/auth/session",
        { headers: { Host: "evil.invalid" } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on("error", reject);
      req.end();
    });
    assert.equal(foreignHost, 403);
    assert.equal(
      (
        await request("/api/auth/session", null, {
          "X-Forwarded-Host": "portal.example.invalid",
        })
      ).status,
      403,
    );
    assert.equal(
      (await request("/__workspace", { action: "reset" })).status,
      403,
    );
    const page = (await request("/api/agent/content/home")).body.data;
    assert.equal(
      (
        await request(
          "/api/agent/content/home/draft",
          { expectedVersion: 1, body: page.body },
          { "X-CSRF-Token": "wrong" },
        )
      ).status,
      403,
    );
    for (const heading of ["Local revision one", "Local revision two"]) {
      const current = (await request("/api/agent/content/home")).body.data;
      assert.equal(
        (
          await request("/api/agent/content/home/draft", {
            expectedVersion: current.version,
            body: { ...current.body, heading },
          })
        ).status,
        200,
      );
    }
    const revision = (
      await request("/api/agent/content/home/revisions")
    ).body.data.items.at(-1);
    const reverted = await request(
      `/api/agent/content/home/revert/${revision.id}`,
      { expectedVersion: 3 },
    );
    assert.equal(reverted.body.data.body.heading, "Local revision one");
    assert.equal(reverted.body.data.version, 4);
    assert.equal(
      (await request("/api/agent/content/home/publish", {})).status,
      503,
    );
    assert.equal((await request("/api/public/inquiries", {})).status, 503);
    const tutorials = (await request("/api/auth/tutorials")).body.data;
    const next = await request("/api/auth/tutorials", {
      type: "start",
      revision: tutorials.progress.revision,
    });
    assert.equal(next.body.data.progress.status, "active");
    assert.equal(
      (await request("/api/auth/tutorials")).body.data.progress.status,
      "active",
    );
    assert.equal(
      (await request("/api/auth/tutorials", { type: "skip", revision: 1 }))
        .status,
      409,
    );
    await control({ action: "role", role: "editor" });
    assert.equal(
      (await request("/api/auth/session")).body.data.user.role,
      "editor",
    );
    for (const path of [
      "/api/agent/administration/activity",
      "/api/agent/administration/diagnostics",
      "/api/agent/administration/staff",
      "/api/agent/templates",
    ])
      assert.equal((await request(path)).status, 403);
    assert.equal(
      (await request("/api/auth/tutorials")).body.data.catalogue.some(
        (tour) => tour.id === "staff",
      ),
      false,
    );
    await control({ action: "role", role: "platform_admin" });
    assert.equal(
      (await request("/api/agent/administration/diagnostics")).status,
      200,
    );
    await control({ action: "reset" });
    assert.equal(
      (await request("/api/auth/tutorials")).body.data.progress.status,
      "paused",
    );
    assert.notEqual(
      (await request("/api/agent/content/home")).body.data.body.heading,
      "Local revision one",
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("portal entry uses dev-only controls; fixtures are outside application source", () => {
  const main = readFileSync(
    new URL("../src/main.jsx", import.meta.url),
    "utf8",
  );
  assert.match(
    main,
    /import\.meta\.env\.DEV\s*&&\s*import\.meta\.env\.VITE_TWE_LOCAL_WORKSPACE/,
  );
  assert.doesNotMatch(
    readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"),
    /createWorkspaceFixture|workspace-server/,
  );
  const launcher = readFileSync(
    new URL("../../../scripts/dev-twe-workspace.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(launcher, /\.\.\.process\.env|--env-file/);
  assert.match(launcher, /"127\.0\.0\.1"/);
});

test("builds refuse local preview flags even when NODE_ENV was accidentally set to development", async () => {
  const configure = (await import("../vite.config.js")).default;
  const original = process.env.VITE_TWE_LOCAL_WORKSPACE;
  const originalNodeEnvironment = process.env.NODE_ENV;
  try {
    process.env.VITE_TWE_LOCAL_WORKSPACE = "true";
    process.env.NODE_ENV = "development";
    assert.throws(() => configure({ command: "build", mode: "production" }), /Workspace preview is only available/);
  } finally {
    if (original === undefined) delete process.env.VITE_TWE_LOCAL_WORKSPACE;
    else process.env.VITE_TWE_LOCAL_WORKSPACE = original;
    if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnvironment;
  }
});
