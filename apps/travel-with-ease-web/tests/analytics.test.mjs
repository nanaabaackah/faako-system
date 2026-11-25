import test from "node:test";
import assert from "node:assert/strict";
import {
  analyticsMeasurementId,
  TWE_MEASUREMENT_ID,
  analyticsInteraction,
  analyticsPageAllowed,
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

test("private questionnaires never initialize analytics and interaction events contain no visitor data", () => {
  for (const pathname of ["/plan-your-trip", "/plan-your-trip/", "/plan-your-trip/private"]) {
    assert.equal(analyticsPageAllowed(pathname), false);
    assert.equal(analyticsMeasurementId({ environment: "production", privacyAvailable: true, pathname }), "");
    assert.equal(analyticsInteraction("generate_lead", "https://travelwitheasegh.com" + pathname + "#continue=private", "https://travelwitheasegh.com"), null);
  }
  const event = analyticsInteraction("generate_lead", "https://travelwitheasegh.com/packages/zanzibar?email=private@example.invalid#secret", "https://travelwitheasegh.com");
  assert.deepEqual(event, { name: "generate_lead", page_location: "https://travelwitheasegh.com/packages/zanzibar", page_path: "/packages/zanzibar", page_referrer: "" });
  assert.equal(analyticsInteraction("private@example.invalid", "https://travelwitheasegh.com/", "https://travelwitheasegh.com"), null);
  assert.equal(analyticsInteraction("generate_lead", "https://untrusted.invalid/", "https://travelwitheasegh.com"), null);
});
