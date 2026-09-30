import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";

// Exercise the real hook's request lifecycle with isolated React state setters
// and transport, without loading browser/env configuration or calling any API.
let fixture;
const fixtureKey = "__reebsOrderRequestTest";
globalThis[fixtureKey] = {
  useState(initial) {
    const index = fixture.state.length;
    fixture.state.push(initial);
    return [initial, (value) => { fixture.state[index] = value; }];
  },
  useRef: (initial) => ({ current: initial }),
  useCallback: (callback) => callback,
  useEffect: (effect) => { fixture.effect = effect; },
  response() {
    return new Promise((resolve, reject) => { fixture.requests.push({ resolve, reject }); });
  },
};
const hookUrl = new URL("./useOrder.js", import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL !== hookUrl) return nextResolve(specifier, context);
    const source = specifier === "react"
      ? `export const { useState, useRef, useCallback, useEffect } = globalThis.${fixtureKey};`
      : specifier === "../../../api/client.js"
        ? `export const reebsApiResponse = globalThis.${fixtureKey}.response;`
        : null;
    return source ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true }
      : nextResolve(specifier, context);
  },
});
const { default: useOrder } = await import(hookUrl);
after(() => { hooks.deregister(); delete globalThis[fixtureKey]; });
const setup = () => {
  fixture = { state: [], requests: [] };
  // React is replaced above with the isolated state-setter harness, not a renderer.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useOrder(41);
};
const success = (payload) => ({ ok: true, json: async () => payload });

test("normalized cancellation cannot replace a successful current Order request", async () => {
  const hook = setup();
  const controller = new AbortController();
  const cancelled = hook.refetch(controller.signal);
  controller.abort();
  const current = hook.refetch();
  fixture.requests[1].resolve(success({ id: 41 }));
  await current;
  fixture.requests[0].reject(Object.assign(new Error("The request was cancelled."), { code: "request_aborted" }));
  await cancelled;
  assert.deepEqual(fixture.state, [{ id: 41 }, false, ""]);
});

test("an older successful response cannot overwrite a newer Order refresh", async () => {
  const hook = setup();
  const older = hook.refetch();
  const newer = hook.refetch();
  fixture.requests[1].resolve(success({ id: 41, fulfillmentStatus: "preparing" }));
  await newer;
  fixture.requests[0].resolve(success({ id: 41, fulfillmentStatus: "not_started" }));
  await older;
  assert.deepEqual(fixture.state, [{ id: 41, fulfillmentStatus: "preparing" }, false, ""]);
});

test("a genuine current Order failure still surfaces and stops loading", async () => {
  const hook = setup();
  const current = hook.refetch();
  fixture.requests[0].reject(new Error("Unable to load order."));
  await current;
  assert.deepEqual(fixture.state, [null, false, "Unable to load order."]);
});
