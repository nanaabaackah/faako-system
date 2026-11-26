import { randomUUID } from "node:crypto";

// Each API replica may scan; one holds the database-scoped advisory lock at a
// time. Immutable source uniqueness also protects against concurrent manual imports.
const LOCK = 740032;
const TICK = 60_000;
const REST = 60 * 60_000;
const MAX_FOLDERS = 2000;
const MAX_PAGES = 5000;
const MAX_IMPORTS = 3;

export function createDriveScanner(service, { now = Date.now, logger } = {}) {
  const root = service.drive.config.folderId;
  let queue = [], seen = new Set(), candidates = [], pages = 0, nextScan = 0;
  const status = { enabled: true, running: false, lastScanAt: null, lastError: false, imported: 0, needsDescription: 0 };
  function reset() {
    queue = [{ id: root, token: "", tokens: new Set() }];
    seen = new Set([root]); candidates = []; pages = 0;
    status.imported = 0; status.needsDescription = 0; status.lastError = false;
  }
  async function step(signal) {
    if (signal?.aborted || now() < nextScan) return;
    if (!queue.length && !candidates.length) reset();
    status.running = true;
    try {
      if (!candidates.length && queue.length) {
        const folder = queue[0];
        const result = await service.listDrive(folder.token, folder.id);
        if (result.incomplete || ++pages > MAX_PAGES) throw new Error("Incomplete or oversized Drive scan");
        for (const child of result.folders || []) {
          if (seen.has(child.id)) continue;
          if (seen.size >= MAX_FOLDERS) throw new Error("Drive scan folder limit");
          seen.add(child.id);
          queue.push({ id: child.id, token: "", tokens: new Set() });
        }
        if (result.nextPageToken) {
          if (folder.tokens.has(result.nextPageToken)) throw new Error("Repeated Drive page token");
          folder.tokens.add(result.nextPageToken);
          folder.token = result.nextPageToken;
        } else queue.shift();
        for (const item of result.items) {
          if (item.importedId || item.archived) continue;
          if (!item.syncEligible) { status.needsDescription++; continue; }
          candidates.push(item);
        }
      }
      for (let count = 0; count < MAX_IMPORTS && candidates.length && !signal?.aborted; count++) {
        const item = candidates[0];
        try {
          const result = await service.syncDrive({ fileId: item.id, version: item.version }, randomUUID());
          if (result.needsDescription) status.needsDescription++;
          else if (!result.unchanged) status.imported++;
        } catch (error) {
          if (error.status === 429) break; // Manual imports get priority; retry next tick.
          status.lastError = true;
          logger?.warn({ eventName: "media.drive_sync_item_failed" }, "Drive image needs review; will reconsider during the next scan.");
        }
        candidates.shift();
      }
      if (!queue.length && !candidates.length) {
        status.lastScanAt = new Date(now()).toISOString();
        nextScan = now() + REST;
        logger?.info({ eventName: "media.drive_sync_scan_completed", imported: status.imported, needsDescription: status.needsDescription, partial: status.lastError }, "Drive scan completed.");
      }
    } catch {
      status.lastError = true;
      queue = []; candidates = [];
      nextScan = now() + REST;
      logger?.warn({ eventName: "media.drive_sync_scan_failed" }, "Drive scan incomplete; no deletions or publication occurred.");
    } finally { status.running = false; }
  }
  return { step, status: () => ({ ...status }) };
}

export function startDriveSync({ service, pool, logger }) {
  const controller = new AbortController();
  const scanner = createDriveScanner(service, { logger });
  service.syncStatus = scanner.status;
  let timer, pending = Promise.resolve();
  const schedule = delay => {
    if (controller.signal.aborted) return;
    timer = setTimeout(() => {
      pending = tick().finally(() => schedule(TICK));
    }, delay);
    timer.unref();
  };
  async function tick() {
    let client, locked = false, releaseError;
    try {
      client = await pool.connect();
      locked = (await client.query("SELECT pg_try_advisory_lock($1) AS locked", [LOCK])).rows[0]?.locked === true;
      if (locked && !controller.signal.aborted) await scanner.step(controller.signal);
    } catch {
      logger?.warn({ eventName: "media.drive_sync_lock_failed" }, "Drive sync could not acquire its database connection.");
    } finally {
      if (locked) {
        try { await client.query("SELECT pg_advisory_unlock($1)", [LOCK]); }
        catch (error) { releaseError = error; }
      }
      client?.release(releaseError);
    }
  }
  schedule(TICK);
  return {
    stop() { controller.abort(); clearTimeout(timer); },
    done() { return pending; },
  };
}
