import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_UNIT_CLASSIFICATIONS,
  buildBusinessUnitClassificationReport,
  classifyBusinessUnitEvidence,
  classifyBusinessUnitRecord,
} from "./businessUnitClassifier.js";

test("classifies one-domain structural evidence without using labels", () => {
  assert.equal(
    classifyBusinessUnitEvidence({ coreEvidence: ["order:12"] }).classification,
    BUSINESS_UNIT_CLASSIFICATIONS.REEBS_CORE
  );
  assert.equal(
    classifyBusinessUnitEvidence({ waterEvidence: ["waterSale:7"] }).classification,
    BUSINESS_UNIT_CLASSIFICATIONS.WATER
  );
});

test("classifies dual-domain identities and explicit shared settings as shared", () => {
  assert.equal(
    classifyBusinessUnitEvidence({
      coreEvidence: ["booking:4"],
      waterEvidence: ["waterSale:8"],
    }).classification,
    BUSINESS_UNIT_CLASSIFICATIONS.SHARED
  );
  assert.equal(
    classifyBusinessUnitEvidence({ sharedEvidence: ["commercialConfiguration:SHARED"] })
      .classification,
    BUSINESS_UNIT_CLASSIFICATIONS.SHARED
  );
});

test("free-text metadata never causes Water classification", () => {
  const record = classifyBusinessUnitRecord({
    entityType: "product",
    id: 19,
    organizationId: 3,
    metadata: {
      name: "Water bottle",
      description: "Used by the Water team",
    },
  });

  assert.equal(record.classification, BUSINESS_UNIT_CLASSIFICATIONS.AMBIGUOUS);
  assert.deepEqual(record.waterEvidence, []);
});

test("normalizes duplicate evidence and builds a stable report order", () => {
  const input = {
    organizationId: 5,
    records: [
      {
        entityType: "PRODUCT",
        id: 9,
        coreEvidence: ["bookingItem", "bookingItem", "orderItem"],
      },
      { entityType: "CUSTOMER", id: 3 },
      { entityType: "CUSTOMER", id: 2, waterEvidence: ["waterSale"] },
    ],
    tableAvailability: { waterSale: true, customer: true },
    warnings: ["Review ambiguous records.", "Review ambiguous records."],
  };
  const report = buildBusinessUnitClassificationReport(input);
  const reportFromReversedInput = buildBusinessUnitClassificationReport({
    ...input,
    records: [...input.records].reverse(),
    tableAvailability: { customer: true, waterSale: true },
  });

  assert.deepEqual(
    report.records.map(({ entityType, id }) => [entityType, id]),
    [
      ["CUSTOMER", 2],
      ["CUSTOMER", 3],
      ["PRODUCT", 9],
    ]
  );
  assert.deepEqual(report.records[2].coreEvidence, ["bookingItem", "orderItem"]);
  assert.deepEqual(report.counts, {
    REEBS_CORE: 1,
    WATER: 1,
    SHARED: 0,
    AMBIGUOUS: 1,
  });
  assert.deepEqual(report.warnings, ["Review ambiguous records."]);
  assert.deepEqual(reportFromReversedInput, report);
  assert.equal(Object.hasOwn(report, "generatedAt"), false);
});
