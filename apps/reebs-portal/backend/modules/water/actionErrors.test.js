import assert from "node:assert/strict";
import test from "node:test";
import { getWaterActionError } from "./actionErrors.js";
import { json } from "../../functions/_shared/http.js";

const responseFor = (error) => {
  const failure = getWaterActionError(error);
  const response = json({ requestId: "water-test-request" }, failure.statusCode, failure.payload, failure.options);
  return { ...response, payload: JSON.parse(response.body) };
};

for (const code of ["MISSING_WATER_PRICE", "MISSING_COMMERCIAL_CONFIGURATION", "AMBIGUOUS_COMMERCIAL_CONFIGURATION", "MISSING_WATER_COST_BASIS"]) {
  test(`${code} survives the real API error adapter with safe corrective guidance`, () => {
    const response = responseFor({ statusCode: 503, code, message: "private diagnostic fixture" });
    assert.equal(response.statusCode, 503);
    assert.equal(response.payload.code, code);
    assert.equal(response.payload.apiError.code, "service_unavailable");
    assert.match(response.payload.error, /owner or admin/);
    assert.equal(response.payload.apiError.message, response.payload.error);
    assert.equal(response.payload.meta.requestId, "water-test-request");
    assert.doesNotMatch(response.body, /private diagnostic/);
  });
}

test("unrecognized server failures remain generic, even when masquerading as a known code", () => {
  for (const error of [
    { statusCode: 503, code: "UNEXPECTED", message: "private diagnostic fixture" },
    { statusCode: 500, code: "MISSING_WATER_PRICE", message: "private diagnostic fixture" },
    new Error("private diagnostic fixture"),
  ]) {
    const response = responseFor(error);
    assert.doesNotMatch(response.body, /private diagnostic|Settings|restock/);
    assert.match(response.payload.error, /temporarily unavailable|could not complete the request/i);
  }
});

test("ordinary validation errors retain their existing behavior", () => {
  const response = responseFor({ statusCode: 400, message: "Sale quantity must be greater than zero." });
  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.error, "Sale quantity must be greater than zero.");
});
