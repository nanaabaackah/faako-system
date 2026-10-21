import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { normalizeCalendar } from "../src/calendar/normalize.js";
import { calendarRange, calendarUrl, createCalendarService, expandInWorker, FRESH_MS } from "../src/calendar/service.js";
import { createApp } from "../src/app.js";

const range = { from: "2026-10-01", to: "2026-11-01" };
const event = (lines) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");
const feed = (...events) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const basic = feed(event(["UID:one", "DTSTART:20261020T100000Z", "DTEND:20261020T110000Z", "SUMMARY:Community conversation"]));
const response = (ics = basic, headers = {}) => new Response(ics, { headers: { "Content-Type": "text/calendar", ...headers } });
const normalize = (ics) => normalizeCalendar(ics, range.from, range.to);

test("public field allowlist strips markup, descriptions, organiser and meeting links", () => {
  const [result] = normalize(feed(event(["UID:safe", "DTSTART:20261020T100000Z", "DTEND:20261020T110000Z", "SUMMARY:<b>Public title</b>", "DESCRIPTION:Private notes", "ORGANIZER:mailto:private@example.org", "LOCATION:https://meet.google.com/private"])));
  assert.equal(result.title, "Public title");
  assert.equal(result.location, "");
  assert.deepEqual(Object.keys(result).sort(), ["id", "uid", "title", "start", "end", "allDay", "timezone", "location", "status"].sort());
  assert.doesNotMatch(JSON.stringify(result), /Private notes|private@example|meet.google/);
  assert.equal(result.id, normalize(feed(event(["UID:safe", "DTSTART:20261020T100000Z", "DTEND:20261020T110000Z", "SUMMARY:Renamed"])))[0].id);
});
test("recurrence, EXDATE, modified and cancelled occurrences", () => {
  const results = normalize(feed(
    event(["UID:series", "DTSTART:20261001T100000Z", "DTEND:20261001T110000Z", "RRULE:FREQ=DAILY;COUNT=5", "EXDATE:20261002T100000Z", "SUMMARY:Regular"]),
    event(["UID:series", "RECURRENCE-ID:20261003T100000Z", "DTSTART:20261003T120000Z", "DTEND:20261003T130000Z", "SUMMARY:Moved"]),
    event(["UID:series", "RECURRENCE-ID:20261004T100000Z", "DTSTART:20261004T100000Z", "DTEND:20261004T110000Z", "STATUS:CANCELLED", "SUMMARY:Cancelled"])
  ));
  assert.deepEqual(results.map(e => e.start), ["2026-10-01T10:00:00.000Z", "2026-10-03T12:00:00.000Z", "2026-10-05T10:00:00.000Z"]);
  assert.equal(results[1].title, "Moved");
});
test("all-day and multi-day events overlap the requested month", () => {
  const [allDay, timed] = normalize(feed(
    event(["UID:allday", "DTSTART;VALUE=DATE:20260930", "DTEND;VALUE=DATE:20261003", "SUMMARY:All day"]),
    event(["UID:overnight", "DTSTART:20261020T230000Z", "DTEND:20261022T010000Z", "SUMMARY:Overnight", "STATUS:TENTATIVE"])
  ));
  assert.equal(allDay.allDay, true); assert.equal(allDay.start, "2026-09-30"); assert.equal(allDay.end, "2026-10-03");
  assert.equal(timed.status, "tentative");
});
test("TZID and DST are respected before Ghana display normalization", () => {
  const events = normalize(feed(event(["UID:zone", "DTSTART;TZID=Europe/London:20261024T100000", "DTEND;TZID=Europe/London:20261024T110000", "RRULE:FREQ=DAILY;COUNT=3", "SUMMARY:Timezone"])));
  assert.deepEqual(events.map(e => e.start), ["2026-10-24T09:00:00.000Z", "2026-10-25T10:00:00.000Z", "2026-10-26T10:00:00.000Z"]);
  assert.ok(events.every(e => e.timezone === "Africa/Accra"));
});
test("cancelled/private events do not appear and malformed inputs fail", () => {
  assert.deepEqual(normalize(feed(event(["UID:hidden", "DTSTART:20261020T100000Z", "SUMMARY:Hidden", "CLASS:PRIVATE"]))), []);
  assert.deepEqual(normalize(feed(event(["UID:cancelled", "DTSTART:20261020T100000Z", "SUMMARY:Hidden", "STATUS:CANCELLED"]))), []);
  assert.throws(() => normalize("<html>upstream error</html>"));
  assert.throws(() => normalize(feed(event(["UID:bad", "SUMMARY:Missing date"]))));
});
test("date ranges and provider identifiers are strictly bounded", () => {
  assert.deepEqual(calendarRange(range), range);
  for (const query of [{ ...range, url: "http://localhost" }, { from: "2026-02-30", to: range.to }, { from: range.to, to: range.from }, { from: "2026-01-01", to: "2026-04-01" }, { from: [range.from], to: range.to }]) assert.throws(() => calendarRange(query));
  for (const id of ["https://example.org", "x@gmail.com/../../private", "x@evil.example", "x@gmail.com?url=local"]) assert.throws(() => calendarUrl(id));
  assert.equal(new URL(calendarUrl("fixture@gmail.com")).hostname, "calendar.google.com");
});
test("real worker expands a valid feed", async () => {
  assert.deepEqual(await expandInWorker(basic, range.from, range.to), normalize(basic));
});
test("cache deduplicates requests and revalidates with ETag after five minutes", async () => {
  let clock = Date.parse(range.from), calls = 0;
  const get = createCalendarService("fixture@gmail.com", { now: () => clock, expand: async (ics, from, to) => normalizeCalendar(ics, from, to), request: async (url, options) => {
    assert.equal(options.redirect, "error"); assert.ok(options.signal);
    if (++calls === 1) return response(basic, { ETag: '"version1"', "Last-Modified": "Thu, 01 Oct 2026 00:00:00 GMT" });
    assert.equal(options.headers["If-None-Match"], '"version1"');
    assert.ok(options.headers["If-Modified-Since"]);
    return new Response(null, { status: 304 });
  } });
  const [a, b] = await Promise.all([get(range), get(range)]);
  assert.deepEqual(a, b); assert.equal(calls, 1);
  await get(range); assert.equal(calls, 1);
  clock += FRESH_MS + 1; await get(range); assert.equal(calls, 2);
});
test("expired cache failure is explicit with bounded backoff, not silently stale", async () => {
  let clock = Date.parse(range.from), calls = 0;
  const get = createCalendarService("fixture@gmail.com", { now: () => clock, expand: async () => [], request: async () => ++calls === 1 ? response() : new Response("private failure", { status: 503 }) });
  await get(range); clock += FRESH_MS + 1;
  await assert.rejects(get(range), /Calendar unavailable/);
  await assert.rejects(get(range)); assert.equal(calls, 2);
  clock += 30001; await assert.rejects(get(range)); assert.equal(calls, 3);
});
test("upstream errors, invalid content and oversize bodies fail safely", async () => {
  for (const request of [
    async () => new Response("private", { status: 500 }),
    async () => response("<html>bad</html>"),
    async () => response(basic, { "Content-Type": "text/html" }),
    async () => response(basic, { "Content-Length": String(3 * 1024 * 1024) }),
    async () => response("x".repeat(2 * 1024 * 1024 + 1)),
    async () => { throw new DOMException("private timeout detail", "TimeoutError"); },
  ]) await assert.rejects(createCalendarService("fixture@gmail.com", { request })(range), { message: "Calendar unavailable" });
});
test("Google fetch timeout aborts an unresponsive request", async () => {
  // Keep the process alive while AbortSignal.timeout's unref'ed timer runs.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const get = createCalendarService("fixture@gmail.com", { request: async (_url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })) });
    await assert.rejects(get(range), { message: "Calendar unavailable" });
  } finally { clearInterval(keepAlive); }
});
test("public route has exact CORS, shared envelopes, method/query protection and rate limit", async t => {
  let calls = 0;
  const config = { origins: ["https://ttngh.example"], calendarId: "fixture@gmail.com", trustedProxies: [], enabled: false };
  const server = createApp(config, { request: async () => { calls++; return response(); } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = "http://127.0.0.1:" + server.address().port + "/api/calendar/events";
  const query = "?" + new URLSearchParams(range);
  const good = await fetch(url + query, { headers: { Origin: "https://ttngh.example" } });
  assert.equal(good.status, 200); assert.equal((await good.json()).data.events.length, 1);
  assert.equal(good.headers.get("access-control-allow-origin"), "https://ttngh.example");
  assert.match(good.headers.get("access-control-allow-methods"), /GET/);
  assert.equal((await fetch(url + query, { headers: { Origin: "https://evil.example" } })).status, 403);
  assert.equal((await fetch(url + query, { method: "POST" })).status, 405);
  assert.equal((await fetch(url + query, { method: "HEAD" })).status, 405);
  assert.equal((await fetch(url + query + "&url=http://localhost")).status, 400);
  assert.equal((await fetch(url, { method: "OPTIONS", headers: { Origin: "https://ttngh.example" } })).status, 204);
  for (let i = 0; i < 60; i++) await fetch(url + query);
  const limited = await fetch(url + query);
  assert.equal(limited.status, 429); assert.ok(limited.headers.get("retry-after")); assert.equal(calls, 1);
});
