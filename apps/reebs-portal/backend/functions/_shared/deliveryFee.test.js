import assert from "node:assert/strict";
import test from "node:test";

import {
  getDeliveryFeeDetails,
  getRecordedDeliveryDistanceKm,
} from "./deliveryFee.js";

test("delivery fee calculation requires and uses an explicit rate", () => {
  assert.deepEqual(
    getDeliveryFeeDetails("delivery", { distanceKm: 12.4 }, 75),
    { distanceKm: 12.4, feeCents: 930, rateCents: 75 }
  );
  assert.throws(
    () => getDeliveryFeeDetails("delivery", { distanceKm: 12.4 }),
    /explicit non-negative delivery rate/i
  );
});

test("pickup is free but still has an explicit calculation rate", () => {
  assert.deepEqual(
    getDeliveryFeeDetails("pickup", { distanceKm: 12.4 }, 0),
    { distanceKm: 0, feeCents: 0, rateCents: 0 }
  );
});

test("delivery fails closed when distance is unavailable", () => {
  assert.throws(
    () => getDeliveryFeeDetails("delivery", { address: "Accra" }, 50),
    (error) => {
      assert.equal(error.statusCode, 422);
      assert.equal(error.code, "DELIVERY_DISTANCE_REQUIRED");
      assert.match(error.message, /positive delivery distance/i);
      return true;
    }
  );
});

test("legacy read projections tolerate a missing recorded distance", () => {
  assert.equal(getRecordedDeliveryDistanceKm("delivery", { address: "Accra" }), 0);
  assert.equal(getRecordedDeliveryDistanceKm("delivery", { distanceKm: "12.44 km" }), 12.4);
  assert.equal(getRecordedDeliveryDistanceKm("pickup", { distanceKm: 12.4 }), 0);
});
