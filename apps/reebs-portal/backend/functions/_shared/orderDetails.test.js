import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeOrderLogisticsDetails } from "./orderDetails.js";

test("order logistics keeps practical Ghana delivery details", () => {
  assert.deepEqual(sanitizeOrderLogisticsDetails({
    address: "  East Legon, Accra  ",
    ghanaPostGps: "ga-123-4567",
    landmark: "Near the school",
    contact: "+233 24 123 4567",
    window: "9am-11am",
  }), {
    address: "East Legon, Accra",
    contact: "+233 24 123 4567",
    window: "9am-11am",
    ghanaPostGps: "GA-123-4567",
    landmark: "Near the school",
  });
});

test("invalid GhanaPost GPS values are not persisted", () => {
  assert.deepEqual(sanitizeOrderLogisticsDetails({
    address: "Accra",
    ghanaPostGps: "not-a-digital-address",
  }), { address: "Accra" });
});
