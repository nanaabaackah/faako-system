import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMERCIAL_BUSINESS_UNITS,
  COMMERCIAL_CONFIG_KEYS,
  COMMERCIAL_VALUE_TYPES,
  WATER_PRICE_TYPES,
  buildCommercialRuleLockKey,
  buildEffectiveDatedOverlapPlan,
  buildWaterPriceLockKey,
  lockCommercialConfigurationKeys,
  normalizeCommercialConfigValue,
  normalizeEffectiveWindow,
  normalizeWaterPriceWindow,
  classifyWaterPriceSchedule,
  normalizeWaterProductPriceInput,
  resolveCommercialValue,
  resolveWaterSalePrice,
  selectSingleEffectiveRecord,
} from "./commercialConfig.js";

test("commercial lock keys are shared, stable, deduplicated, and ordered", async () => {
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  const discountKey = buildCommercialRuleLockKey(
    7,
    COMMERCIAL_BUSINESS_UNITS.WATER,
    COMMERCIAL_CONFIG_KEYS.WATER_DISCOUNT_LIMIT_BPS
  );
  const retailKey = buildWaterPriceLockKey(7, "gwater-15pk", WATER_PRICE_TYPES.RETAIL);

  await lockCommercialConfigurationKeys(client, [retailKey, discountKey, retailKey]);

  assert.deepEqual(calls.map((call) => call.params[0]), [discountKey, retailKey].sort());
  assert.ok(calls.every((call) => /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/.test(call.sql)));
});

const currentRuleRow = (overrides = {}) => ({
  id: 1,
  organizationId: 7,
  businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
  key: COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_DISCOUNT_BPS,
  value: "1000",
  valueType: COMMERCIAL_VALUE_TYPES.BASIS_POINTS,
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  effectiveTo: null,
  active: true,
  description: null,
  createdByUserId: null,
  updatedByUserId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const currentWaterPriceRow = (overrides = {}) => ({
  id: 11,
  organizationId: 7,
  productId: 4,
  productKey: "gwater-15pk",
  productName: "15pk Gwater",
  priceType: WATER_PRICE_TYPES.RETAIL,
  minimumQuantity: 1,
  priceCents: 2700,
  currency: "GHS",
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  effectiveTo: null,
  active: true,
  description: null,
  createdByUserId: null,
  updatedByUserId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

test("Water historical windows validate dates without relaxing Core date restrictions", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const payload = { effectiveFrom: "2026-03-01", effectiveTo: "2026-06-01" };
  assert.equal(normalizeWaterPriceWindow(payload, { now }).effectiveFrom.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.throws(() => normalizeEffectiveWindow(payload, { now }), { code: "PAST_EFFECTIVE_DATE" });
  for (const effectiveFrom of ["invalid", "2026-02-30", "2026-13-01", "2026-03-01T99:00:00Z"]) {
    assert.throws(() => normalizeWaterPriceWindow({ effectiveFrom }), { code: "INVALID_EFFECTIVE_DATE" });
  }
  for (const effectiveTo of ["2026-03-01", "2026-02-01"]) {
    assert.throws(() => normalizeWaterPriceWindow({ ...payload, effectiveTo }), { code: "INVALID_EFFECTIVE_WINDOW" });
  }
  assert.equal(classifyWaterPriceSchedule("2026-03-01", now), "historical");
  assert.equal(classifyWaterPriceSchedule("2026-10-04", now), "current");
  assert.equal(classifyWaterPriceSchedule("2026-12-01", now), "future");
});

test("Water historical resolution uses quantity tiers and the transaction period, never today's price", async () => {
  let rows = [
    currentWaterPriceRow({ id: 1, priceCents: 3000, effectiveTo: "2026-09-01T00:00:00.000Z" }),
    currentWaterPriceRow({ id: 2, priceCents: 2800, priceType: "BULK_RETAIL", minimumQuantity: 20, effectiveTo: "2026-09-01T00:00:00.000Z" }),
    currentWaterPriceRow({ id: 3, priceCents: 3500, effectiveFrom: "2026-09-01T00:00:00.000Z" }),
    currentWaterPriceRow({ id: 4, priceCents: 3300, priceType: "BULK_RETAIL", minimumQuantity: 20, effectiveFrom: "2026-09-01T00:00:00.000Z" }),
  ];
  const client = { async query(sql, values) {
    assert.match(sql, /"organizationId" = \$1/);
    assert.match(sql, /"productKey" = \$2/);
    assert.match(sql, /"minimumQuantity" <= \$3/);
    assert.match(sql, /"effectiveFrom" <= \$4/);
    assert.match(sql, /"effectiveTo" > \$4/);
    return { rows: rows.filter((row) => row.organizationId === values[0] && row.productKey === values[1]
      && row.minimumQuantity <= values[2] && row.effectiveFrom <= values[3]
      && (!row.effectiveTo || row.effectiveTo > values[3])) };
  } };
  const resolve = (quantity, at) => resolveWaterSalePrice(client, { organizationId: 7, productKey: "gwater-15pk", quantity, saleChannel: "retail", at });
  for (const quantity of [1, 10, 19, 20, 21, 100, 10]) {
    assert.equal((await resolve(quantity, "2026-07-20")).priceCents, quantity < 20 ? 3000 : 2800);
    assert.equal((await resolve(quantity, "2026-10-10")).priceCents, quantity < 20 ? 3500 : 3300);
  }
  rows = rows.filter((row) => row.priceType === "RETAIL");
  assert.equal((await resolve(100, "2026-07-20")).priceCents, 3000);
  rows.push({ ...rows[0], id: 99 });
  await assert.rejects(() => resolve(10, "2026-07-20"), { code: "AMBIGUOUS_WATER_PRICE" });
  rows = rows.filter((row) => row.id === 3);
  await assert.rejects(() => resolve(10, "2026-07-20"), { code: "MISSING_WATER_PRICE" });
});

test("commercial rules use typed calculation units instead of decimal money", () => {
  const deposit = normalizeCommercialConfigValue({
    businessUnit: "reebs_core",
    key: COMMERCIAL_CONFIG_KEYS.SERVICE_DEPOSIT_BPS,
    value: "7000",
  });
  const attendantFee = normalizeCommercialConfigValue({
    businessUnit: "REEBS_CORE",
    key: COMMERCIAL_CONFIG_KEYS.BOOKING_ATTENDANT_UNIT_FEE_CENTS,
    value: 10000,
    valueType: "MONEY_CENTS",
  });

  assert.equal(deposit.value, 7000);
  assert.equal(deposit.valueType, COMMERCIAL_VALUE_TYPES.BASIS_POINTS);
  assert.equal(attendantFee.value, 10000);
  assert.equal(attendantFee.storedValue, "10000");
});

test("commercial rule validation rejects unknown, mismatched, and out-of-range values", () => {
  assert.throws(
    () => normalizeCommercialConfigValue({ businessUnit: "WATER", key: "delivery_per_km_fee_cents", value: 50 }),
    { code: "UNKNOWN_COMMERCIAL_CONFIGURATION" }
  );
  assert.throws(
    () => normalizeCommercialConfigValue({
      businessUnit: "REEBS_CORE",
      key: COMMERCIAL_CONFIG_KEYS.SERVICE_DEPOSIT_BPS,
      value: 7000,
      valueType: "MONEY_CENTS",
    }),
    { code: "INVALID_COMMERCIAL_CONFIGURATION" }
  );
  assert.throws(
    () => normalizeCommercialConfigValue({
      businessUnit: "WATER",
      key: COMMERCIAL_CONFIG_KEYS.WATER_DISCOUNT_LIMIT_BPS,
      value: 10000,
    }),
    { code: "INVALID_COMMERCIAL_CONFIGURATION" }
  );
});

test("new effective windows reject historical starts and invalid end dates", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");
  assert.throws(
    () => normalizeEffectiveWindow({ effectiveFrom: "2026-08-14T12:00:00.000Z" }, { now }),
    { code: "PAST_EFFECTIVE_DATE" }
  );
  assert.throws(
    () => normalizeEffectiveWindow({
      effectiveFrom: "2026-08-16T12:00:00.000Z",
      effectiveTo: "2026-08-16T12:00:00.000Z",
    }, { now }),
    { code: "INVALID_EFFECTIVE_WINDOW" }
  );
});

test("finite effective-date overlays preserve the previous rule after the new period", () => {
  const plan = buildEffectiveDatedOverlapPlan(
    [currentRuleRow()],
    {
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      effectiveTo: "2026-10-01T00:00:00.000Z",
    }
  );

  assert.equal(plan.length, 1);
  assert.equal(plan[0].operation, "close_and_clone_tail");
  assert.equal(plan[0].effectiveTo, "2026-09-01T00:00:00.000Z");
  assert.equal(plan[0].tailEffectiveFrom, "2026-10-01T00:00:00.000Z");
  assert.equal(plan[0].tailEffectiveTo, null);
});

test("a replacement without an end date closes current and deactivates future overlaps", () => {
  const plan = buildEffectiveDatedOverlapPlan(
    [
      currentRuleRow({ id: 1, effectiveFrom: "2026-01-01T00:00:00.000Z" }),
      currentRuleRow({ id: 2, effectiveFrom: "2026-10-01T00:00:00.000Z" }),
    ],
    { effectiveFrom: "2026-09-01T00:00:00.000Z" }
  );

  assert.deepEqual(
    plan.map(({ id, operation }) => ({ id, operation })),
    [
      { id: 1, operation: "close" },
      { id: 2, operation: "deactivate" },
    ]
  );
});

test("effective record selection fails closed for missing and overlapping records", () => {
  const at = "2026-08-15T12:00:00.000Z";
  assert.throws(
    () => selectSingleEffectiveRecord([], { at }),
    { code: "MISSING_COMMERCIAL_CONFIGURATION", statusCode: 503 }
  );
  assert.throws(
    () => selectSingleEffectiveRecord([currentRuleRow(), currentRuleRow({ id: 2 })], { at }),
    { code: "AMBIGUOUS_COMMERCIAL_CONFIGURATION", statusCode: 503 }
  );
});

test("commercial resolver returns the typed database value with no code fallback", async () => {
  const calls = [];
  const value = await resolveCommercialValue(
    {
      async query(sql, params) {
        calls.push({ sql, params });
        return { rows: [currentRuleRow()] };
      },
    },
    {
      organizationId: 7,
      businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
      key: COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_DISCOUNT_BPS,
      at: "2026-08-15T12:00:00.000Z",
    }
  );

  assert.equal(value, 1000);
  assert.match(calls[0].sql, /"organizationId" = \$1/);
  assert.deepEqual(calls[0].params.slice(0, 3), [
    7,
    "REEBS_CORE",
    "booking_bundle_discount_bps",
  ]);
});

test("commercial resolver fails closed when its database row is missing", async () => {
  await assert.rejects(
    () => resolveCommercialValue(
      { async query() { return { rows: [] }; } },
      {
        organizationId: 7,
        businessUnit: "REEBS_CORE",
        key: COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_MIN_ITEMS,
      }
    ),
    { code: "MISSING_COMMERCIAL_CONFIGURATION", statusCode: 503 }
  );
});

test("Water product price input requires product identity and integer pesewas", () => {
  const price = normalizeWaterProductPriceInput({
    productKey: "gwater-15pk",
    productName: "15pk Gwater",
    priceType: "bulk_retail",
    minimumQuantity: 10,
    priceCents: 2600,
    currency: "ghs",
  });
  assert.equal(price.priceType, WATER_PRICE_TYPES.BULK_RETAIL);
  assert.equal(price.currency, "GHS");
  assert.throws(
    () => normalizeWaterProductPriceInput({
      ...price,
      priceCents: "26.00",
    }),
    { code: "INVALID_WATER_PRICE" }
  );
  assert.throws(
    () => normalizeWaterProductPriceInput({
      ...price,
      productId: "not-an-id",
    }),
    { code: "INVALID_WATER_PRICE" }
  );
});

test("Water sale price resolver selects the most specific effective retail tier", async () => {
  const price = await resolveWaterSalePrice(
    {
      async query() {
        return {
          rows: [
            currentWaterPriceRow({
              id: 12,
              priceType: WATER_PRICE_TYPES.BULK_RETAIL,
              minimumQuantity: 10,
              priceCents: 2600,
            }),
            currentWaterPriceRow(),
          ],
        };
      },
    },
    {
      organizationId: 7,
      productKey: "gwater-15pk",
      saleChannel: "retail",
      quantity: 10,
      at: "2026-08-15T12:00:00.000Z",
    }
  );

  assert.equal(price.priceType, WATER_PRICE_TYPES.BULK_RETAIL);
  assert.equal(price.priceCents, 2600);
});
