// One writer per editor. The server's expectedVersion remains authoritative.
// A failed mutation is never automatically retried: its acknowledgement may
// have been lost after the transaction committed.
export function createDraftAutosave({ save, read, onState, onSaved, delay = 1200,
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  let current, saved, version = 0, generation = 0, epoch = 0;
  let timer, pending, failure, attempted, disposed = false;
  const fingerprint = value => JSON.stringify(value);
  const notify = (status, error = "") => {
    if (!disposed) onState({ status, error, dirty: fingerprint(current) !== saved });
  };
  const clear = () => { if (timer !== undefined) clearTimer(timer); timer = undefined; };
  const schedule = () => {
    clear();
    if (!disposed && !pending && !failure && fingerprint(current) !== saved) {
      timer = setTimer(() => { timer = undefined; void flush(false); }, delay);
    }
  };
  function reset(body, nextVersion) {
    clear(); epoch++; generation++;
    current = structuredClone(body); saved = fingerprint(body); version = nextVersion;
    failure = null; attempted = null; pending = null;
    notify("saved");
  }
  function edit(body) {
    current = structuredClone(body); generation++;
    // Validation errors can be corrected by typing; conflicts/network failures
    // require the explicit Save Draft reconciliation path.
    if (failure?.status === 400) failure = null;
    notify(failure ? "error" : pending ? "saving" : "unsaved", failure?.message);
    schedule();
  }
  async function flush(explicit = true) {
    clear();
    if (disposed || current === undefined) return false;
    if (pending) {
      await pending;
      return explicit && !failure ? flush(true) : !failure;
    }
    if (failure && !explicit) return false;
    const scope = epoch;
    const run = async () => {
      try {
        if (failure) {
          const remote = await read();
          if (disposed || scope !== epoch) return false;
          if (attempted && fingerprint(remote.body) === fingerprint(attempted.body)) {
            saved = fingerprint(remote.body); version = remote.version;
            onSaved(remote, fingerprint(current) === saved);
          } else if (remote.version !== version) {
            throw Object.assign(new Error("Another editor changed this page. Copy your unsaved work before reloading; it has not been overwritten."), { status: 409 });
          }
          failure = null; attempted = null;
        }
        if (fingerprint(current) === saved) { notify("saved"); return true; }
        const sentGeneration = generation;
        attempted = { body: structuredClone(current), version };
        notify("saving");
        const result = await save(attempted.body, version);
        if (disposed || scope !== epoch) return false;
        saved = fingerprint(result.body); version = result.version;
        const unchanged = sentGeneration === generation;
        if (unchanged) current = structuredClone(result.body);
        attempted = null;
        onSaved(result, unchanged);
        notify(unchanged ? "saved" : "unsaved");
        return true;
      } catch (error) {
        if (disposed || scope !== epoch) return false;
        failure = error;
        notify("error", error.status === 409
          ? "This page changed elsewhere. Copy your unsaved work before reloading."
          : "Draft save was not confirmed. Your edits remain here. Use Save draft to check and retry safely.");
        return false;
      }
    };
    pending = run();
    const operation = pending;
    const result = await operation;
    if (scope === epoch && pending === operation) { pending = null; schedule(); }
    return result;
  }
  return { reset, edit, flush, dispose() { disposed = true; epoch++; clear(); } };
}
