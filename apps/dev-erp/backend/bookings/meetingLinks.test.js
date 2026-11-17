import test from "node:test";
import assert from "node:assert/strict";
import { isMeetingProvider, validateMeetingLink, meetingLinkState } from "./meetingLinks.js";

test("supports all four chosen meeting providers", () => {
  for (const provider of ["GOOGLE_MEET", "ZOOM", "WHATSAPP", "FACETIME"]) {
    assert.equal(isMeetingProvider(provider), true);
  }
  assert.equal(isMeetingProvider("OTHER"), false);
});

test("only provider-specific HTTPS URLs may be sent", () => {
  const valid = [
    ["GOOGLE_MEET", "https://meet.google.com/abc-defg-hij"],
    ["ZOOM", "https://us02web.zoom.us/j/123456789"],
    ["WHATSAPP", "https://call.whatsapp.com/video/example"],
    ["FACETIME", "https://facetime.apple.com/join#example"],
  ];
  for (const [provider, url] of valid) assert.equal(validateMeetingLink(provider, url).ok, true);
  assert.equal(validateMeetingLink("ZOOM", "https://evil.example/j/123").ok, false);
  assert.equal(validateMeetingLink("ZOOM", "javascript:alert(1)").ok, false);
  assert.equal(validateMeetingLink("WHATSAPP", "https://wa.me/233555555555").ok, false);
});

test("link state is derived from saved fields", () => {
  assert.equal(meetingLinkState({}), "PENDING_LINK");
  assert.equal(meetingLinkState({ meetingLink: "https://meet.google.com/a", meetingLinkDeliveryStatus: "NOT_SENT" }), "READY");
  assert.equal(meetingLinkState({ meetingLink: "https://meet.google.com/a", meetingLinkDeliveryStatus: "SENT" }), "SENT");
  assert.equal(meetingLinkState({ meetingLink: "https://meet.google.com/a", meetingLinkDeliveryStatus: "FAILED" }), "FAILED");
  assert.equal(meetingLinkState({ meetingLink: "https://meet.google.com/a", meetingLinkDeliveryStatus: "TEST_REROUTED" }), "TEST_REROUTED");
});
