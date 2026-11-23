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

test("uncertain provider outcomes continue safe reconciliation polling but stop for operator review", async () => {
  let cycles = 0, sleeps = 0;
  const result = await runPublicationLoop({
    intervalMs: 1_000,
    runOnce: async () => ({ id: "job", status: ++cycles === 1 ? "deploying" : "recovery_required" }),
    sleep: async () => { sleeps++; },
  });
  assert.equal(cycles, 2);
  assert.equal(sleeps, 1);
  assert.equal(result.status, "recovery_required");
});
