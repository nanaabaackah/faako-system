import { Worker } from "node:worker_threads";

export const FRESH_MS = 5 * 60_000;
const MAX_BYTES = 2 * 1024 * 1024;
export function calendarUrl(id) {
  if (typeof id !== "string" || id.length > 254 || !/^[a-zA-Z0-9._+-]+@(?:gmail\.com|group\.calendar\.google\.com)$/.test(id)) throw new Error("Invalid calendar configuration");
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`;
}
export function calendarRange(query) {
  if (Object.keys(query).sort().join(",") !== "from,to") throw new Error("Invalid range");
  for (const value of [query.from, query.to]) {
    if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("Invalid date");
  }
  const length = Date.parse(query.to) - Date.parse(query.from);
  if (length <= 0 || length > 62 * 86400_000) throw new Error("Invalid range");
  return { from: query.from, to: query.to };
}
export function expandInWorker(ics, from, to) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.js", import.meta.url), { workerData: { ics, from, to }, resourceLimits: { maxOldGenerationSizeMb: 64 }, env: { TZ: "Africa/Accra" } });
    let settled = false;
    const finish = (error, events) => { if (settled) return; settled = true; clearTimeout(timer); void worker.terminate(); error ? reject(new Error("Calendar processing unavailable")) : resolve(events); };
    const timer = setTimeout(() => finish(true), 3000);
    worker.once("message", message => finish(message.error, message.events));
    worker.once("error", () => finish(true));
    worker.once("exit", () => { if (!settled) finish(true); });
  });
}
async function limitedText(response) {
  if (Number(response.headers.get("content-length")) > MAX_BYTES || !response.body) throw new Error("Feed size");
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) throw new Error("Feed size"); chunks.push(value); }
  } finally { await reader.cancel(); }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}

export function createCalendarService(id, { request = fetch, now = Date.now, expand = expandInWorker } = {}) {
  const url = id ? calendarUrl(id) : null;
  let feed, feedFlight, nextAttempt = 0, activeWorkers = 0;
  const ranges = new Map(), flights = new Map();
  async function refresh() {
    if (!url) throw new Error("Calendar unavailable");
    if (feed && now() - feed.at < FRESH_MS) return feed;
    if (feedFlight) return feedFlight;
    if (now() < nextAttempt) throw new Error("Calendar unavailable");
    feedFlight = (async () => {
      try {
        const headers = { Accept: "text/calendar" };
        if (feed?.etag) headers["If-None-Match"] = feed.etag;
        if (feed?.modified) headers["If-Modified-Since"] = feed.modified;
        const response = await request(url, { headers, redirect: "error", signal: AbortSignal.timeout(8000) });
        if (response.status === 304 && feed) { feed.at = now(); return feed; }
        if (response.status !== 200 || !/^(text\/calendar|text\/plain|application\/octet-stream)(?:;|$)/i.test(response.headers.get("content-type") || "")) throw new Error("Calendar unavailable");
        const ics = await limitedText(response);
        if (!ics.trimStart().startsWith("BEGIN:VCALENDAR") || !ics.trimEnd().endsWith("END:VCALENDAR")) throw new Error("Invalid calendar");
        feed = { ics, at: now(), etag: response.headers.get("etag"), modified: response.headers.get("last-modified") };
        ranges.clear(); return feed;
      } catch { nextAttempt = now() + 30_000; throw new Error("Calendar unavailable"); }
      finally { feedFlight = undefined; }
    })();
    return feedFlight;
  }
  return async query => {
    const { from, to } = calendarRange(query);
    const current = await refresh();
    const key = `${from}/${to}`;
    if (ranges.has(key)) return { events: ranges.get(key), refreshedAt: new Date(current.at).toISOString(), freshnessSeconds: Math.max(0, Math.floor((FRESH_MS - (now() - current.at)) / 1000)) };
    if (!flights.has(key)) {
      if (activeWorkers >= 2) throw new Error("Calendar busy");
      activeWorkers++;
      flights.set(key, Promise.resolve().then(() => expand(current.ics, from, to)).then(events => {
        if (ranges.size >= 24) ranges.delete(ranges.keys().next().value);
        if (feed === current) ranges.set(key, events);
        return events;
      }).finally(() => { activeWorkers--; flights.delete(key); }));
    }
    const events = await flights.get(key);
    return { events, refreshedAt: new Date(current.at).toISOString(), freshnessSeconds: Math.max(0, Math.floor((FRESH_MS - (now() - current.at)) / 1000)) };
  };
}
