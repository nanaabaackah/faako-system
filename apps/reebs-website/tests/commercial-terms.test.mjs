import assert from "node:assert/strict";
import test from "node:test";

import { normalizePublicCommercialTerms } from "../src/utils/commercialTerms.js";

test("public commercial terms retain Core booking and deposit values from the API", () => {
  const terms = normalizePublicCommercialTerms({
    scope: "reebs-core",
    businessUnit: "REEBS_CORE",
    currency: "GHS",
    effectiveAt: "2026-08-20T10:00:00.000Z",
    booking: {
      bundleMinimumItems: 3,
      bundleDiscountBps: 1000,
      attendantUnitFeeCents: 10000,
    },
    paymentTerms: {
      serviceDepositBps: 7000,
      serviceDepositDueDays: 2,
    },
  });

  assert.equal(terms.booking.bundleMinimumItems, 3);
  assert.equal(terms.booking.bundleDiscountBps, 1000);
  assert.equal(terms.booking.attendantUnitFeeCents, 10000);
  assert.equal(terms.paymentTerms.serviceDepositBps, 7000);
});

test("public commercial terms reject missing, invalid, and non-Core payloads", () => {
  assert.throws(() => normalizePublicCommercialTerms({}), /scope/);
  assert.throws(
    () => normalizePublicCommercialTerms({
      scope: "water",
      businessUnit: "WATER",
    }),
    /scope/
  );
  assert.throws(
    () => normalizePublicCommercialTerms({
      scope: "reebs-core",
      businessUnit: "REEBS_CORE",
      booking: { bundleMinimumItems: 0, bundleDiscountBps: 1000, attendantUnitFeeCents: 10000 },
      paymentTerms: { serviceDepositBps: 7000, serviceDepositDueDays: 2 },
    }),
    /invalid/
  );
});
