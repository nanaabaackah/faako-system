export const BUSINESS_UNIT_CLASSIFICATIONS = Object.freeze({
  REEBS_CORE: "REEBS_CORE",
  WATER: "WATER",
  SHARED: "SHARED",
  AMBIGUOUS: "AMBIGUOUS",
});

const normalizeEvidence = (values) =>
  [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right));

export const classifyBusinessUnitEvidence = ({
  coreEvidence = [],
  waterEvidence = [],
  sharedEvidence = [],
} = {}) => {
  const normalizedCoreEvidence = normalizeEvidence(coreEvidence);
  const normalizedWaterEvidence = normalizeEvidence(waterEvidence);
  const normalizedSharedEvidence = normalizeEvidence(sharedEvidence);

  let classification = BUSINESS_UNIT_CLASSIFICATIONS.AMBIGUOUS;
  if (
    normalizedSharedEvidence.length > 0
    || (normalizedCoreEvidence.length > 0 && normalizedWaterEvidence.length > 0)
  ) {
    classification = BUSINESS_UNIT_CLASSIFICATIONS.SHARED;
  } else if (normalizedCoreEvidence.length > 0) {
    classification = BUSINESS_UNIT_CLASSIFICATIONS.REEBS_CORE;
  } else if (normalizedWaterEvidence.length > 0) {
    classification = BUSINESS_UNIT_CLASSIFICATIONS.WATER;
  }

  return {
    classification,
    coreEvidence: normalizedCoreEvidence,
    waterEvidence: normalizedWaterEvidence,
    sharedEvidence: normalizedSharedEvidence,
  };
};

export const classifyBusinessUnitRecord = ({
  entityType,
  id,
  organizationId,
  coreEvidence = [],
  waterEvidence = [],
  sharedEvidence = [],
  metadata = {},
} = {}) => ({
  entityType: String(entityType || "UNKNOWN").trim().toUpperCase(),
  id: Number.isSafeInteger(Number(id)) ? Number(id) : String(id ?? ""),
  organizationId: Number(organizationId),
  ...classifyBusinessUnitEvidence({ coreEvidence, waterEvidence, sharedEvidence }),
  metadata: metadata && typeof metadata === "object" ? metadata : {},
});

const compareRecords = (left, right) => {
  const byType = left.entityType.localeCompare(right.entityType);
  if (byType !== 0) return byType;

  const leftNumericId = typeof left.id === "number";
  const rightNumericId = typeof right.id === "number";
  if (leftNumericId && rightNumericId) return left.id - right.id;
  return String(left.id).localeCompare(String(right.id));
};

const emptyCounts = () => ({
  [BUSINESS_UNIT_CLASSIFICATIONS.REEBS_CORE]: 0,
  [BUSINESS_UNIT_CLASSIFICATIONS.WATER]: 0,
  [BUSINESS_UNIT_CLASSIFICATIONS.SHARED]: 0,
  [BUSINESS_UNIT_CLASSIFICATIONS.AMBIGUOUS]: 0,
});

export const buildBusinessUnitClassificationReport = ({
  organizationId,
  records = [],
  authoritativeFactCounts = {},
  tableAvailability = {},
  warnings = [],
} = {}) => {
  const classifiedRecords = records
    .map((record) => classifyBusinessUnitRecord({ organizationId, ...record }))
    .sort(compareRecords);
  const counts = emptyCounts();
  const countsByEntity = {};

  for (const record of classifiedRecords) {
    counts[record.classification] += 1;
    countsByEntity[record.entityType] ||= emptyCounts();
    countsByEntity[record.entityType][record.classification] += 1;
  }

  return {
    schemaVersion: 1,
    mode: "READ_ONLY",
    organizationId: Number(organizationId),
    classificationRules: {
      REEBS_CORE: "At least one structural Core relationship and no Water relationship.",
      WATER: "At least one structural Water relationship and no Core relationship.",
      SHARED: "Explicitly shared, or structurally related to both Core and Water.",
      AMBIGUOUS: "No authoritative structural or explicit business-unit evidence.",
      textFields: "Names, descriptions, notes, email addresses, and free text are never evidence.",
    },
    counts,
    countsByEntity,
    authoritativeFactCounts,
    tableAvailability: Object.fromEntries(
      Object.entries(tableAvailability).sort(([left], [right]) => left.localeCompare(right))
    ),
    warnings: normalizeEvidence(warnings),
    records: classifiedRecords,
  };
};
