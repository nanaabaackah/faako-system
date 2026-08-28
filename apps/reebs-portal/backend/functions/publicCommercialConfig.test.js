import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMERCIAL_CONFIG_KEYS,
} from "./_shared/commercialConfig.js";
import {
  buildPublicCommercialErrorResponse,
  buildPublicCommercialTerms,
} from "./publicCommercialConfig.js";

const record = (id, key, value) => ({ id, key, value });

test("public commercial terms expose only scoped display values and configuration ids", () => {
  const terms = buildPublicCommercialTerms({
    effectiveAt: new Date("2026-08-20T10:00:00.000Z"),
    records: [
      record(1, COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_MIN_ITEMS, 3),
      record(2, COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_DISCOUNT_BPS, 1000),
      record(3, COMMERCIAL_CONFIG_KEYS.BOOKING_ATTENDANT_UNIT_FEE_CENTS, 10000),
      record(4, COMMERCIAL_CONFIG_KEYS.SERVICE_DEPOSIT_BPS, 7000),
      record(5, COMMERCIAL_CONFIG_KEYS.SERVICE_DEPOSIT_DUE_DAYS, 2),
    ],
  });

  assert.equal(terms.scope, "reebs-core");
  assert.equal(terms.businessUnit, "REEBS_CORE");
  assert.deepEqual(terms.booking, {
    bundleMinimumItems: 3,
    bundleDiscountBps: 1000,
    attendantUnitFeeCents: 10000,
  });
  assert.deepEqual(terms.paymentTerms, {
    serviceDepositBps: 7000,
    serviceDepositDueDays: 2,
  });
  assert.equal(terms.configurationIds.serviceDeposit, 4);
  assert.equal(terms.organizationId, undefined);
});

test("public commercial terms fail closed when a required booking rule is missing", () => {
  assert.throws(
    () => buildPublicCommercialTerms({ records: [] }),
    (error) => error.statusCode === 503 && error.code === "MISSING_COMMERCIAL_CONFIGURATION"
  );
});

test("public commercial configuration hides detailed 503 messages and keys", () => {
  const response = buildPublicCommercialErrorResponse({
    statusCode: 503,
    code: "MISSING_COMMERCIAL_CONFIGURATION",
    message: "Required commercial configuration service_deposit_bps is missing.",
  });

  assert.deepEqual(response, {
    statusCode: 503,
    payload: {
      error: "Current booking terms are unavailable.",
      code: "COMMERCIAL_CONFIGURATION_UNAVAILABLE",
    },
  });
  assert.doesNotMatch(JSON.stringify(response), /service_deposit_bps|MISSING_COMMERCIAL_CONFIGURATION/);
});

test("public commercial configuration preserves safe client errors", () => {
  assert.deepEqual(
    buildPublicCommercialErrorResponse({
      statusCode: 400,
      code: "INVALID_REQUEST",
      message: "Invalid request.",
    }),
    {
      statusCode: 400,
      payload: { error: "Invalid request.", code: "INVALID_REQUEST" },
    }
  );
});
