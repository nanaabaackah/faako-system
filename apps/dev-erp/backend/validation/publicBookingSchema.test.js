import assert from "node:assert/strict";
import test from "node:test";
import { publicBookingSchema } from "./schemas.js";

const sample = () => ({
  attendeeName: "Demo Client",
  attendeeEmail: "demo@example.com",
  startAt: "2026-11-17T11:00:00.000Z",
  endAt: "2026-11-17T12:00:00.000Z",
  meetingPlatform: "ZOOM",
  company: "",
  durationMinutes: 60,
});

test("public appointment keeps provider, duration and honeypot fields after validation", () => {
  const parsed = publicBookingSchema.parse(sample());
  assert.equal(parsed.meetingPlatform, "ZOOM");
  assert.equal(parsed.durationMinutes, 60);
  assert.equal(parsed.company, "");
  assert.equal(parsed.title, undefined);
});

test("public appointment rejects unknown meeting platform", () => {
  const result = publicBookingSchema.safeParse({ ...sample(), meetingPlatform: "SKYPE" });
  assert.equal(result.success, false);
});

test("public appointment rejects invalid dates and excessive durations", () => {
  assert.equal(publicBookingSchema.safeParse({ ...sample(), startAt: "yesterday" }).success, false);
  assert.equal(publicBookingSchema.safeParse({ ...sample(), durationMinutes: 999 }).success, false);
});
