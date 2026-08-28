import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCommercialRulePayload,
  buildWaterPricePayload,
  formatCommercialRuleValue,
  getCommercialScheduleAccess,
  getCoreRuleModels,
  getEffectiveScheduleState,
  groupWaterPriceSchedule,
  toEffectiveFrom,
} from "./commercialSettings.js";

const NOW = new Date("2026-08-15T12:30:00.000Z");

const coreDefinition = {
  businessUnit: "REEBS_CORE",
  key: "service_deposit_bps",
  valueType: "BASIS_POINTS",
  unit: "basis_points",
  min: 0,
  max: 10000,
};

test("commercial rule payload converts a displayed percentage to basis points", () => {
  const payload = buildCommercialRulePayload(
    { value: "37.5", effectiveDate: "2026-08-15" },
    coreDefinition,
    { inputLabel: "Deposit rate", description: "Core deposit rate" },
    NOW,
  );

  assert.deepEqual(payload, {
    resourceType: "commercial_rule",
    businessUnit: "REEBS_CORE",
    key: "service_deposit_bps",
    value: 3750,
    valueType: "BASIS_POINTS",
    description: "Core deposit rate",
  });
});

test("same-day changes use server time while future changes keep their selected date", () => {
  assert.equal(toEffectiveFrom("2026-08-15", NOW), undefined);
  assert.equal(toEffectiveFrom("2026-09-01", NOW), "2026-09-01T00:00:00.000Z");
});

test("commercial rule validation enforces definition bounds and historical immutability", () => {
  assert.throws(
    () => buildCommercialRulePayload(
      { value: "100.01", effectiveDate: "2026-08-15" },
      coreDefinition,
      { inputLabel: "Deposit rate" },
      NOW,
    ),
    /no more than 100/,
  );
  assert.throws(() => toEffectiveFrom("2026-08-14", NOW), /today or later/);
});

test("schedule state separates the active value from the next scheduled value", () => {
  const records = [
    { id: 1, active: true, effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: "2026-09-01T00:00:00.000Z" },
    { id: 2, active: true, effectiveFrom: "2026-09-01T00:00:00.000Z", effectiveTo: null },
  ];

  const state = getEffectiveScheduleState(records, NOW);
  assert.equal(state.current.id, 1);
  assert.equal(state.upcoming.id, 2);
});

test("core models include only controlled REEBS Core rule definitions", () => {
  const models = getCoreRuleModels({
    asOf: NOW.toISOString(),
    definitions: [
      coreDefinition,
      { businessUnit: "WATER", key: "water_discount_limit_bps", valueType: "BASIS_POINTS" },
      { businessUnit: "REEBS_CORE", key: "not_supported_in_ui", valueType: "INTEGER" },
    ],
    rules: [{
      id: 10,
      businessUnit: "REEBS_CORE",
      key: "service_deposit_bps",
      value: 3500,
      valueType: "BASIS_POINTS",
      active: true,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
    }],
  });

  assert.equal(models.length, 1);
  assert.equal(models[0].metadata.label, "Service deposit");
  assert.equal(formatCommercialRuleValue(models[0].current, models[0].metadata), "35%");
});

test("Water price payload preserves product identity and converts GHS to pesewas", () => {
  const payload = buildWaterPricePayload(
    {
      price: "26.50",
      minimumQuantity: "10",
      currency: "ghs",
      effectiveDate: "2026-09-01",
    },
    {
      productId: 42,
      productKey: "500ml-bottle",
      productName: "500 ml bottle",
      priceType: "BULK_RETAIL",
    },
    NOW,
  );

  assert.deepEqual(payload, {
    resourceType: "water_price",
    productId: 42,
    productKey: "500ml-bottle",
    productName: "500 ml bottle",
    priceType: "BULK_RETAIL",
    minimumQuantity: 10,
    priceCents: 2650,
    currency: "GHS",
    effectiveFrom: "2026-09-01T00:00:00.000Z",
  });
});

test("Water pricing remains grouped by product and price type", () => {
  const groups = groupWaterPriceSchedule({
    asOf: NOW.toISOString(),
    waterPrices: [
      {
        id: 1,
        productKey: "500ml-bottle",
        productName: "500 ml bottle",
        priceType: "RETAIL",
        priceCents: 2700,
        currency: "GHS",
        active: true,
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: null,
      },
      {
        id: 2,
        productKey: "500ml-bottle",
        productName: "500 ml bottle",
        priceType: "COMPANY",
        priceCents: 2500,
        currency: "GHS",
        active: true,
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: null,
      },
    ],
  });

  assert.deepEqual(groups.map(({ key }) => key), [
    "500ml-bottle:COMPANY",
    "500ml-bottle:RETAIL",
  ]);
});

test("owners and admins can edit while managers and Water staff remain read only", () => {
  assert.deepEqual(getCommercialScheduleAccess("owner"), {
    canManage: true,
    canViewCore: true,
    canViewWater: true,
  });
  assert.deepEqual(getCommercialScheduleAccess("admin"), {
    canManage: true,
    canViewCore: true,
    canViewWater: true,
  });
  assert.deepEqual(getCommercialScheduleAccess("manager"), {
    canManage: false,
    canViewCore: true,
    canViewWater: false,
  });
  assert.deepEqual(getCommercialScheduleAccess("water"), {
    canManage: false,
    canViewCore: false,
    canViewWater: true,
  });
});

test("AdminSettings retires browser-only commercial controls and persists shared document identity", () => {
  const source = readFileSync(new URL("./AdminSettings.jsx", import.meta.url), "utf8");
  assert.match(source, /Legacy browser-only currency, tax and transport controls remain retired/);
  assert.match(source, /Save document identity/);
  assert.match(source, /savePortalSettingsSection\("documentIdentity"/);
  assert.doesNotMatch(source, /localStorage\.setItem\("reebs_erp_config"/);
  assert.doesNotMatch(source, />\s*Base currency\s*</);
  assert.doesNotMatch(source, />\s*Tax rate \(%\)\s*</);
  assert.doesNotMatch(source, />\s*Transport rate/);
});
