import test from "node:test";
import assert from "node:assert/strict";
import {
  analyticsMeasurementId,
  TWE_MEASUREMENT_ID,
} from "../src/lib/analytics.js";

test("production uses the approved TWE stream only with a published privacy notice", () => {
  assert.equal(TWE_MEASUREMENT_ID, "G-GVJ2HGT6YN");
  assert.equal(
    analyticsMeasurementId({
      environment: "production",
      privacyAvailable: true,
    }),
    TWE_MEASUREMENT_ID,
  );
  assert.equal(
    analyticsMeasurementId({
      environment: "production",
      privacyAvailable: false,
      configuredId: TWE_MEASUREMENT_ID,
    }),
    "",
  );
});
test("production analytics is never enabled by copied local/staging configuration", () => {
  for (const environment of [undefined, "development", "staging", "test"]) {
    assert.equal(
      analyticsMeasurementId({ environment, privacyAvailable: true }),
      "",
    );
    assert.equal(
      analyticsMeasurementId({
        environment,
        configuredId: TWE_MEASUREMENT_ID,
        privacyAvailable: true,
      }),
      "",
    );
  }
  assert.equal(
    analyticsMeasurementId({
      environment: "staging",
      configuredId: "G-TEST123456",
      privacyAvailable: true,
    }),
    "G-TEST123456",
  );
  assert.throws(() =>
    analyticsMeasurementId({
      environment: "production",
      configuredId: "https://untrusted.invalid",
      privacyAvailable: true,
    }),
  );
});
