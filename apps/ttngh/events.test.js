import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureEvent } from "./tests/fixtures/event.js";
import { validateEvents, groupEvents, googleCalendarUrl, eventCalendarFile, eventStructuredData } from "./src/lib/events.js";
import { fetchPublishedEvents } from "./src/lib/event-source.js";
import { eventSchema } from "./src/lib/page-schema.js";
const event = validateEvents([fixtureEvent])[0];
const site = "https://thethrivingnetworkgh.org";

test("only explicitly published events cross the boundary", () => {
  assert.equal(validateEvents([fixtureEvent, {...fixtureEvent, _id: "drafts.x"}, {...fixtureEvent, _id: "versions.release.x"}, {...fixtureEvent, publishState: "draft"}]).length, 1);
});
test("invalid or colliding slugs stop publication", () => {
  assert.throws(() => validateEvents([fixtureEvent, fixtureEvent]));
  for(const slug of ["../secret", "bad/path", "Uppercase", ""]) assert.throws(() => validateEvents([{...fixtureEvent, slug}]));
});
test("dates must be explicit instants, ordered, and have a valid timezone", () => {
  for(const patch of [{end: fixtureEvent.start}, {start: "not a date"}, {start: "2099-02-30T10:00:00Z"}, {start: "2099-10-20T10:00:00"}, {timezone: "Fake/Zone"}]) assert.throws(() => validateEvents([{...fixtureEvent, ...patch}]));
});
test("images, meaningful alt, dimensions and owner are required", () => {
  for(const patch of [{image: null}, {image: {...fixtureEvent.image, alt: " "}}, {image: {...fixtureEvent.image, width: 0}}, {image: {...fixtureEvent.image, url: "https://unapproved.example/photo.jpg"}}, {owner: ""}]) assert.throws(() => validateEvents([{...fixtureEvent, ...patch}]));
});
test("registration and public online links must be HTTPS", () => {
  for(const patch of [{registrationState: "open"}, {registrationUrl: "javascript:alert(1)"}, {format: "online"}, {onlineUrl: "http://example.org", format: "online"}]) assert.throws(() => validateEvents([{...fixtureEvent, ...patch}]));
  assert.equal(validateEvents([{...fixtureEvent, format: "online", onlineUrl: "https://example.org/event"}])[0].format, "online");
});
test("upcoming events sort first, past events newest first, and empty is supported", () => {
  const now = new Date("2099-10-21T00:00:00Z");
  const later = {...event, start: "2099-11-20T10:00:00Z", end: "2099-11-20T12:00:00Z"};
  const earlier = {...event, start: "2099-09-20T10:00:00Z", end: "2099-09-20T12:00:00Z"};
  assert.deepEqual(groupEvents([earlier, later, event], now), {upcoming:[later], past:[event, earlier]});
  assert.deepEqual(groupEvents([], now), {upcoming:[], past:[]});
});
test("Google Calendar links encode title, dates, timezone and source page", () => {
  const url = new URL(googleCalendarUrl({...event, title: "A & B"}, site));
  assert.equal(url.searchParams.get("text"), "A & B");
  assert.equal(url.searchParams.get("dates"), "20991020T100000Z/20991020T120000Z");
  assert.equal(url.searchParams.get("ctz"), "Africa/Accra");
  assert.match(url.searchParams.get("details"), /\/events\/test-community-event/);
});
test("ICS escapes injection, folds UTF-8 safely and uses stable UIDs", () => {
  const ics = eventCalendarFile({...event, title: "É".repeat(70) + ", a; b\nATTENDEE:fake"}, site, new Date("2026-01-01T00:00:00Z"));
  assert.match(ics, /DTSTART:20991020T100000Z/);
  assert.match(ics, /UID:test-community-event@thethrivingnetworkgh.org/);
  assert.match(ics.replace(/\r\n /g, ""), /\\, a\\; b\\nATTENDEE:fake/);
  assert.ok(ics.split("\r\n").every(line => Buffer.byteLength(line) <= 75));
  assert.ok(!ics.includes("\r\nATTENDEE:"));
});
test("Event schema agrees with the visible location and dates", () => {
  const schema = eventSchema(eventStructuredData(event, site));
  assert.equal(schema.endDate, event.end);
  assert.equal(schema.location.name, event.venue);
  assert.equal(schema.image, event.image.url);
});
test("unconfigured development is empty; partial or required CMS configuration fails", async () => {
  assert.deepEqual(await fetchPublishedEvents({}), []);
  await assert.rejects(fetchPublishedEvents({SANITY_PROJECT_ID:"test"}));
  await assert.rejects(fetchPublishedEvents({TTNGH_CMS_REQUIRED:"true"}));
});
test("Sanity uses published perspective and excludes private fields", async () => {
  const result = await fetchPublishedEvents({SANITY_PROJECT_ID:"test", SANITY_DATASET:"production"}, async url => {
    assert.equal(url.hostname, "test.api.sanity.io");
    assert.equal(url.searchParams.get("perspective"), "published");
    assert.match(url.searchParams.get("query"), /drafts/);
    return {ok:true, json:async()=>({result:[fixtureEvent]})};
  });
  assert.equal(result[0].slug, event.slug);
});
test("provider failure stops the build instead of silently deleting event pages", async () => {
  await assert.rejects(fetchPublishedEvents({SANITY_PROJECT_ID:"test", SANITY_DATASET:"production"}, async()=>({ok:false})), /deployment stopped/);
});
