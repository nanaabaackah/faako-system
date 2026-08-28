import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAttendantChargeCents,
  getAttendantRateCents,
} from "./bookingCharges.js";

test("attendant charges use the explicit authoritative rate", () => {
  assert.deepEqual(
    calculateAttendantChargeCents(
      [
        { quantity: 2, attendantsNeeded: 1 },
        { quantity: 1, attendantsNeeded: 2 },
      ],
      12500
    ),
    { attendants: 4, rateCents: 12500, totalCents: 50000 }
  );
});

test("attendant charges have no code or environment fallback", () => {
  assert.throws(
    () => getAttendantRateCents(),
    /explicit non-negative attendant rate/i
  );
  assert.throws(
    () => calculateAttendantChargeCents([{ quantity: 1, attendantsNeeded: 1 }]),
    /explicit non-negative attendant rate/i
  );
});
