import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dateKey, monthRange, eventsOnDay, eventTime, validateCalendarResponse } from "../src/lib/calendar.js";
const event = { id: "fixture", uid: "fixture", title: "Community event", start: "2026-10-20", end: "2026-10-22", allDay: true, location: "", timezone: "Africa/Accra", status: "confirmed" };
test("calendar enrichment uses exact UID and safe local routes without HTML rendering", () => {
  const source = readFileSync(new URL("../src/scripts/month-calendar.ts", import.meta.url), "utf8");
  assert.match(source, /eventLinks\.get\(event\.uid\)/);
  assert.match(source, /link\.textContent = "View full event"/);
  assert.doesNotMatch(source, /innerHTML|eventLinks\.get\(event\.title\)/);
});
test("initial loading retains placeholders instead of rendering dates early", () => {
  const script = readFileSync(new URL("../src/scripts/month-calendar.ts", import.meta.url), "utf8");
  assert.match(script, /if \(!loaded\) renderLoading\(\)/);
  assert.doesNotMatch(script, /render\(\); void load\(\)/);
});
test("Ghana dates, month boundaries and exclusive all-day ends", () => {
  assert.equal(dateKey(new Date("2026-10-20T23:30:00-04:00")), "2026-10-21");
  assert.deepEqual(monthRange(2026, 11), { from: "2026-12-01", to: "2027-01-01" });
  assert.equal(eventsOnDay([event], "2026-10-20").length, 1);
  assert.equal(eventsOnDay([event], "2026-10-21").length, 1);
  assert.equal(eventsOnDay([event], "2026-10-22").length, 0);
  assert.match(eventTime(event), /All day/);
  assert.doesNotMatch(eventTime(event), /22 Oct/);
});
test("calendar response rejects malformed values before rendering", () => {
  assert.equal(validateCalendarResponse({ events: [event], freshnessSeconds: 300 }).events.length, 1);
  for (const patch of [{ status: "cancelled" }, { title: "x".repeat(181) }, { start: "bad" }, { end: "2026-10-19" }, { timezone: "Europe/London" }]) assert.throws(() => validateCalendarResponse({ events: [{ ...event, ...patch }], freshnessSeconds: 300 }));
  assert.throws(() => validateCalendarResponse({ events: [], freshnessSeconds: 301 }));
});
