import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureEvent } from "./tests/fixtures/event.js";
import { validateEvents, groupEvents, selectEventHighlights, eventRegistrationLabel, googleCalendarUrl, eventCalendarFile, eventStructuredData } from "./src/lib/events.js";
import { fetchPublishedEvents } from "./src/lib/event-source.js";
import { eventSchema } from "./src/lib/page-schema.js";
const event = validateEvents([fixtureEvent])[0];
const site = "https://thethrivingnetworkgh.org";

test("highlights select current/nearest, three additional dates and latest past without duplicates", () => {
  const now = new Date("2099-10-20T11:00:00Z");
  const dated = (day, slug) => ({...event, slug, start:`2099-10-${day}T10:00:00Z`, end:`2099-10-${day}T12:00:00Z`});
  const current = dated("20", "current");
  const future = [dated("21", "one"), dated("22", "two"), dated("23", "three"), dated("24", "four")];
  const past = [dated("19", "previous"), dated("18", "older"), dated("17", "oldest")];
  const result = selectEventHighlights([...past, ...future.reverse(), current], now);
  assert.equal(result.next.slug, "current");
  assert.deepEqual(result.upcoming.map(e=>e.slug), ["one", "two", "three"]);
  assert.equal(result.previous.slug, "previous");
  assert.deepEqual(selectEventHighlights([], now), {next:null, upcoming:[], previous:null});
  assert.deepEqual(selectEventHighlights([current], now), {next:current, upcoming:[], previous:null});
  assert.deepEqual(selectEventHighlights(past, now), {next:null, upcoming:[], previous:past[0]});
  assert.equal(selectEventHighlights(future, now).previous, null);
  assert.equal(groupEvents([current], new Date(current.end)).upcoming.length, 1);
  const tied = [{...current, slug:"b"}, {...current, slug:"a"}];
  assert.deepEqual(groupEvents(tied, now).upcoming.map(e=>e.slug), ["a", "b"]);
});

test("past registration state overrides stale open metadata", () => {
  assert.equal(eventRegistrationLabel({...event, registrationState:"open"}, new Date("2100-01-01")), "Event completed");
  assert.equal(eventRegistrationLabel({...event, registrationState:"open"}, new Date("2099-01-01")), "Registration open");
});

test("Calendar UID is optional, exact and unique among published records", () => {
  assert.equal(event.calendarUid, "");
  assert.equal(validateEvents([{...fixtureEvent, calendarUid:"abc@google.com"}])[0].calendarUid, "abc@google.com");
  assert.throws(()=>validateEvents([{...fixtureEvent, calendarUid:"bad uid"}]));
  assert.throws(()=>validateEvents([{...fixtureEvent, calendarUid:"same"}, {...fixtureEvent, _id:"other", slug:"other", calendarUid:"same"}]));
  assert.equal(validateEvents([{...fixtureEvent, calendarUid:"same"}, {...fixtureEvent, _id:"drafts.other", calendarUid:"same"}]).length, 1);
});

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
