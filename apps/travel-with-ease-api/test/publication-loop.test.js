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

test("unverified publication keeps continuous worker alive with a minimum retry delay", async () => {
  const controller = new AbortController();
  const statuses = ["deploying", "recovery_required", "recovery_required", "live"];
  const sleepIntervals = [], warnings = [], resumed = [];
  const result = await runPublicationLoop({
    signal: controller.signal,
    intervalMs: 1_000,
    runOnce: async () => {
      const status = statuses.shift();
      if (status === "live") controller.abort();
      return { id: "job", status };
    },
    sleep: async ms => { sleepIntervals.push(ms); },
    logger: {
      warn: (fields) => warnings.push(fields),
      info: (fields) => { if (fields.eventName === "publication.reconciliation_resumed") resumed.push(fields); },
    },
  });
  assert.deepEqual(sleepIntervals, [1_000, 60_000, 60_000]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].eventName, "publication.reconciliation_waiting");
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].status, "live");
  assert.deepEqual(result, { status: "stopped" });
});

test("graceful shutdown during blocked reconciliation closes the loop without a failing status", async () => {
  const controller = new AbortController();
  let cycles = 0;
  const result = await runPublicationLoop({
    signal: controller.signal,
    intervalMs: 15_000,
    runOnce: async () => { cycles += 1; return { id: "job", status: "recovery_required" }; },
    sleep: async ms => { assert.equal(ms, 60_000); controller.abort(); },
  });
  assert.equal(cycles, 1);
  assert.deepEqual(result, { status: "stopped" });
});
