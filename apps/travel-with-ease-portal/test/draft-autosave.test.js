import test from "node:test";
import assert from "node:assert/strict";
import { createDraftAutosave } from "../src/draft-autosave.js";

function fixture(overrides = {}) {
  const calls = [], states = [], acknowledgements = [];
  let callback, remote = { body: { heading: "Original" }, version: 1 };
  const writer = createDraftAutosave({
    save: async (body, version) => { calls.push({ body, version }); return remote = { body, version: version + 1 }; },
    read: async () => remote,
    onState: state => states.push(state),
    onSaved: (result, replace) => acknowledgements.push({ result, replace }),
    setTimer: fn => { callback = fn; return 1; }, clearTimer: () => { callback = null; },
    ...overrides,
  });
  writer.reset(remote.body, 1);
  return { writer, calls, states, acknowledgements, tick: async () => { callback?.(); await writer.flush(); } };
}
test("debounces edits, saves once and manual save does not create duplicate revisions", async () => {
  const f = fixture();
  f.writer.edit({ heading: "A" }); f.writer.edit({ heading: "Latest" });
  assert.equal(f.calls.length, 0);
  await f.tick(); await f.writer.flush();
  assert.deepEqual(f.calls, [{ body: { heading: "Latest" }, version: 1 }]);
  assert.equal(f.states.at(-1).status, "saved");
  assert.equal(f.states.at(-1).dirty, false);
});
test("typing during an in-flight save never overwrites newer input and serializes versions", async () => {
  let resolve;
  const f = fixture({ save: (body, version) => new Promise(done => { resolve = () => done({ body, version: version + 1 }); }) });
  f.writer.edit({ heading: "First" }); const first = f.writer.flush();
  f.writer.edit({ heading: "Second" }); resolve(); await first;
  assert.equal(f.acknowledgements[0].replace, false);
  assert.equal(f.states.at(-1).dirty, true);
  const second = f.writer.flush(); resolve(); await second;
  assert.equal(f.acknowledgements[1].result.version, 3);
  assert.equal(f.states.at(-1).dirty, false);
});
test("lost acknowledgement is reconciled by read before an explicit retry, without a duplicate revision", async () => {
  let remote = { body: { heading: "Original" }, version: 1 }, writes = 0;
  const f = fixture({ save: async (body, version) => { writes++; remote = { body, version: version + 1 }; throw new Error("Connection lost"); }, read: async () => remote });
  f.writer.edit({ heading: "Saved on server" });
  assert.equal(await f.writer.flush(), false);
  assert.equal(await f.writer.flush(false), false);
  assert.equal(writes, 1);
  assert.equal(await f.writer.flush(), true);
  assert.equal(writes, 1);
  assert.equal(f.states.at(-1).status, "saved");
});
test("concurrent editor conflicts preserve input and never overwrite or blindly retry", async () => {
  let writes = 0;
  const f = fixture({ save: async () => { writes++; throw Object.assign(new Error("Conflict"), { status: 409 }); }, read: async () => ({ body: { heading: "Other editor" }, version: 2 }) });
  f.writer.edit({ heading: "My work" }); await f.writer.flush(); await f.writer.flush();
  assert.equal(writes, 1); assert.equal(f.states.at(-1).dirty, true); assert.equal(f.states.at(-1).status, "error");
});
test("page changes ignore stale responses and disposal cancels queued autosaves", async () => {
  let resolve;
  const f = fixture({ save: body => new Promise(done => { resolve = () => done({ body, version: 2 }); }) });
  f.writer.edit({ heading: "Page A" }); const first = f.writer.flush();
  f.writer.reset({ heading: "Page B" }, 8); resolve(); await first;
  assert.equal(f.acknowledgements.length, 0); assert.equal(f.states.at(-1).dirty, false);
  f.writer.edit({ heading: "No save after unmount" }); f.writer.dispose();
  assert.equal(await f.writer.flush(), false);
});
