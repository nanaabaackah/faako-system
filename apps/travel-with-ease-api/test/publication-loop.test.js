import test from "node:test";
import assert from "node:assert/strict";
import { runPublicationLoop } from "../src/content/publication-loop.js";

test("continuous publication polling processes a queued job without a manual command", async () => {
  const controller = new AbortController();
  const statuses = ["idle", "live"];
  let sleeps = 0;
  const result = await runPublicationLoop({
    signal: controller.signal,
    intervalMs: 1_000,
    runOnce: async () => {
      const status = statuses.shift();
      if (status === "live") controller.abort();
      return { status, ...(status === "live" ? { id: "job" } : {}) };
    },
    sleep: async () => { sleeps += 1; },
  });
  assert.equal(sleeps, 1);
  assert.deepEqual(result, { status: "stopped" });
});

test("uncertain provider outcomes stop recovery polling before another claim", async () => {
  let claims = 0;
  const result = await runPublicationLoop({
    intervalMs: 1_000,
    runOnce: async () => { claims += 1; return { id: "job", status: "deploying" }; },
    sleep: async () => { throw new Error("must not sleep"); },
  });
  assert.equal(claims, 1);
  assert.equal(result.status, "deploying");
});
