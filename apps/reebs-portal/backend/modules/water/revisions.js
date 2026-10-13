import { waterSettlementError } from "./settlement.js";

// Compare the revision the browser opened, not a fresh pre-write API read.
// Call only after obtaining the row lock in the mutation's transaction.
export const assertWaterRevision = (record, payload) => {
  const expected = new Date(payload.expectedUpdatedAt || "").getTime();
  const actual = new Date(record.updatedAt || record.createdAt || "").getTime();
  if (!Number.isFinite(expected) || !Number.isFinite(actual) || expected !== actual) {
    throw waterSettlementError("This Water record changed, or its revision is missing. Refresh and reopen it before saving.", "WATER_RECORD_CHANGED");
  }
};
