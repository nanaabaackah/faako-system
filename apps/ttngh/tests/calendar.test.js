import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dateKey, monthRange, eventsOnDay, eventTime, upcomingCalendarEvents, validateCalendarResponse } from "../src/lib/calendar.js";
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

test("live upcoming dates appear in chronological order without duplicating exact Sanity occurrences", () => {
  const fixture = (id, uid, start, end) => ({ ...event, id, uid, start, end });
  const dates = [
    fixture("linked", "series-uid", "2026-11-26", "2026-11-27"),
    fixture("repeat", "series-uid", "2026-12-03", "2026-12-04"),
    fixture("other", "other-uid", "2026-11-27", "2026-11-28"),
    fixture("ended", "past-uid", "2026-11-10", "2026-11-11"),
    fixture("repeat-copy", "series-uid", "2026-12-03", "2026-12-04"),
  ];
  const linked = [{ uid: "series-uid", start: "2026-11-26T10:00:00Z" }];
  assert.deepEqual(upcomingCalendarEvents(dates, linked, new Date("2026-11-23T09:00:00Z"), 6).map(item => item.id), ["other", "repeat"]);
  assert.deepEqual(upcomingCalendarEvents(dates, [], new Date("2026-11-23T09:00:00Z"), 1).map(item => item.id), ["linked"]);
});

test("calendar event days use a visual marker without displaying numeric badges", () => {
  const script = readFileSync(new URL("../src/scripts/month-calendar.ts", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles/components/month-calendar.css", import.meta.url), "utf8");
  const eventsPage = readFileSync(new URL("../src/pages/events.astro", import.meta.url), "utf8");
  const upcoming = readFileSync(new URL("../src/scripts/live-upcoming-events.ts", import.meta.url), "utf8");
  assert.match(script, /button\.dataset\.hasEvents = "true"/);
  assert.doesNotMatch(script, /"month-count"/);
  assert.match(styles, /\.month-day\[data-has-events="true"\]/);
  assert.match(eventsPage, /<LiveUpcomingEvents editorialEvents=\{events\}/);
  assert.match(upcoming, /upcomingCalendarEvents\(response\.events, editorialLinks/);
  assert.match(script, /ttngh:calendar-select/);
});

test("homepage upcoming links select the requested date on the Events calendar", () => {
  const home = readFileSync(new URL("../src/pages/index.astro", import.meta.url), "utf8");
  const live = readFileSync(new URL("../src/scripts/live-upcoming-events.ts", import.meta.url), "utf8");
  const calendar = readFileSync(new URL("../src/scripts/month-calendar.ts", import.meta.url), "utf8");
  assert.match(home, /<LiveUpcomingEvents editorialEvents=\{publishedEvents\}/);
  assert.match(live, /\/events\?date=/);
  assert.match(calendar, /new URLSearchParams\(location\.search\)\.get\("date"\)/);
});
