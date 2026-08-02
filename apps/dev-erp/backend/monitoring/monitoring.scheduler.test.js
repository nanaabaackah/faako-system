import test from "node:test";
import assert from "node:assert/strict";
import { createMonitoringScheduler } from "./monitoring.scheduler.js";

test("scheduler runs enabled due services and respects intervals", async () => {
  const calls = [];
  let now = 100000;
  const scheduler = createMonitoringScheduler({
    services: [{ key: "due", enabled: true, intervalSeconds: 60 }, { key: "disabled", enabled: false, intervalSeconds: 60 }],
    monitoringService: { runService: async (key) => calls.push(key) },
    options: { maxConcurrency: 2, schedulerTickMs: 15000 },
    now: () => now,
  });
  assert.equal(await scheduler.runDueChecks(), 1);
  assert.deepEqual(calls, ["due"]);
  assert.equal(await scheduler.runDueChecks(), 0);
  now += 60000;
  assert.equal(await scheduler.runDueChecks(), 1);
});

test("scheduler prevents overlap and contains checker failures", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const failures = [];
  const scheduler = createMonitoringScheduler({
    services: [{ key: "api", enabled: true, intervalSeconds: 60 }],
    monitoringService: { runService: async () => pending.then(() => { throw new Error("failure"); }) },
    options: { maxConcurrency: 1, schedulerTickMs: 15000 },
    logger: { failure: (...args) => failures.push(args) },
    now: () => 100000,
  });
  const first = scheduler.runDueChecks();
  await Promise.resolve();
  assert.equal(await scheduler.runDueChecks(), 0);
  release();
  assert.equal(await first, 1);
  assert.equal(failures.length, 1);
});
