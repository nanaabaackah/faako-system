import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBookingReference,
  canTransitionBooking,
  isBookingLocked,
  normalizeGhanaPhone,
  validateBookingDateRange,
} from "./bookingPolicy.js";

test("booking lifecycle allows only the minimal operational transitions", () => {
  assert.equal(canTransitionBooking("pending", "confirmed"), true);
  assert.equal(canTransitionBooking("pending", "completed"), false);
  assert.equal(canTransitionBooking("confirmed", "completed"), true);
  assert.equal(canTransitionBooking("confirmed", "cancelled"), true);
  assert.equal(canTransitionBooking("completed", "confirmed"), false);
  assert.equal(canTransitionBooking("cancelled", "pending"), false);
  assert.equal(isBookingLocked("completed"), true);
  assert.equal(isBookingLocked("cancelled"), true);
});

test("booking references are stable and readable", () => {
  assert.equal(
    buildBookingReference({ id: 42, createdAt: "2026-08-29T08:00:00.000Z" }),
    "RB-2026-000042"
  );
});

test("booking date ranges reject impossible end dates", () => {
  assert.deepEqual(validateBookingDateRange("2026-09-01", "2026-09-03"), {
    valid: true,
    startDate: "2026-09-01",
    endDate: "2026-09-03",
  });
  assert.equal(
    validateBookingDateRange("2026-09-03", "2026-09-01").code,
    "INVALID_BOOKING_DATE_RANGE"
  );
});

test("Ghana phone normalization accepts local and international Ghana formats", () => {
  assert.equal(normalizeGhanaPhone("0244123456"), "+233244123456");
  assert.equal(normalizeGhanaPhone("+233 244 123 456"), "+233244123456");
  assert.equal(normalizeGhanaPhone("233244123456"), "+233244123456");
  assert.equal(normalizeGhanaPhone("123"), "");
  assert.equal(normalizeGhanaPhone("+44 7700 900123"), "+447700900123");
});
