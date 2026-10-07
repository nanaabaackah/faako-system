import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCommercialRulePayload,
  formatCommercialRuleValue,
  getCommercialScheduleAccess,
  getCoreRuleModels,
  getEffectiveScheduleState,
  toEffectiveFrom,
} from "./commercialSettings.js";

const NOW = new Date("2026-08-15T12:30:00.000Z");

test("Water alone accepts historical periods, whole current days and an exclusive end", () => {
  const draft = { productKey: "gwater-15pk", productName: "15pk Gwater", priceType: "RETAIL", minimumQuantity: "1", price: "28", effectiveDate: "2026-03-01", effectiveEndDate: "2026-06-01" };
  assert.equal(buildWaterPricePayload(draft, {}, NOW).effectiveFrom, "2026-03-01T00:00:00.000Z");
  assert.equal(buildWaterPricePayload(draft, {}, NOW).effectiveTo, "2026-06-01T00:00:00.000Z");
  assert.equal(buildWaterPricePayload({ ...draft, effectiveDate: "2026-08-15", effectiveEndDate: "" }, {}, NOW).effectiveFrom, "2026-08-15T00:00:00.000Z");
  for (const effectiveDate of ["invalid", "2026-02-30"]) {
    assert.throws(() => buildWaterPricePayload({ ...draft, effectiveDate }, {}, NOW), /valid effective date/);
  }
  assert.throws(() => buildWaterPricePayload({ ...draft, effectiveEndDate: "2026-03-01" }, {}, NOW), /later/);
  assert.throws(() => toEffectiveFrom(draft.effectiveDate, NOW), /today or later/);
});

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

test("Core rule schedule state separates the active value from the next scheduled value", () => {
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

test("only owners/admins manage Core commercial rules; managers can view them", () => {
  assert.deepEqual(getCommercialScheduleAccess("owner"), {
    canManage: true,
    canViewCore: true,
  });
  assert.deepEqual(getCommercialScheduleAccess("admin"), {
    canManage: true,
    canViewCore: true,
  });
  assert.deepEqual(getCommercialScheduleAccess("manager"), {
    canManage: false,
    canViewCore: true,
  });
  assert.deepEqual(getCommercialScheduleAccess("water"), {
    canManage: false,
    canViewCore: false,
  });
});

test("AdminSettings removes Water price scheduling from Commercial Settings", () => {
  const source = readFileSync(new URL("./AdminSettings.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /WaterPricePeriodFields|buildWaterPricePayload|water_price|Water price schedule/i);
  assert.match(source, /getCoreRuleModels/);
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
