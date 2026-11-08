import test from "node:test";
import assert from "node:assert/strict";
import { runNotificationLoop } from "../src/notifications/loop.js";
import { deliverOne } from "../src/notifications/outbox.js";

test("continuous delivery drains sequentially, throttles sends and sleeps five seconds when idle", async () => {
  const controller = new AbortController(),
    waits = [],
    jobs = [true, true, false];
  let inFlight = 0,
    maximum = 0;
  await runNotificationLoop({
    signal: controller.signal,
    tick: async () => {
      maximum = Math.max(maximum, ++inFlight);
      await Promise.resolve();
      inFlight--;
      return jobs.shift();
    },
    wait: async (ms) => {
      waits.push(ms);
      if (!jobs.length) controller.abort();
    },
  });
  assert.deepEqual(waits, [600, 600, 5000]);
  assert.equal(maximum, 1);
});

test("shutdown lets the current delivery finish but never claims another job", async () => {
  const controller = new AbortController();
  let ticks = 0;
  await runNotificationLoop({
    signal: controller.signal,
    tick: async () => {
      ticks++;
      controller.abort();
      await Promise.resolve();
      return true;
    },
    wait: () => assert.fail("No sleep after shutdown"),
  });
  assert.equal(ticks, 1);
  await runNotificationLoop({
    signal: controller.signal,
    tick: () => assert.fail("No new claim after shutdown"),
  });
});

test("idle sleep is interruptible and unexpected infrastructure failures stop the worker", async () => {
  const controller = new AbortController();
  await runNotificationLoop({
    signal: controller.signal,
    tick: async () => false,
    wait: async () => {
      controller.abort();
      throw new Error("Abort");
    },
  });
  await assert.rejects(
    runNotificationLoop({
      signal: new AbortController().signal,
      tick: async () => {
        throw new Error("isolated database unavailable");
      },
    }),
    /isolated database unavailable/,
  );
});

test("notification diagnostics store allowlisted reasons, never provider response bodies", async () => {
  for (const message of [
    "provider_rejected",
    "delivery_configuration_changed",
    "invalid_provider_response",
    "secret provider payload",
  ]) {
    let reason;
    const logs = [];
    await deliverOne(
      {
        claim: async () => ({ id: "synthetic" }),
        fail: async (_job, value) => {
          reason = value;
        },
      },
      {
        send: async () => {
          throw new Error(message);
        },
      },
      { warn: (value) => logs.push(value) },
    );
    assert.equal(
      reason,
      message === "secret provider payload" ? "delivery_failed" : message,
    );
    assert.doesNotMatch(JSON.stringify(logs), /secret provider payload/);
  }
});
