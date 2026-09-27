import test from "node:test";
import assert from "node:assert/strict";
import { toLeadRow } from "../src/leadView.js";
test("maps a CRM lead without exposing inquiry notes or contact details", () => {
  const row = toLeadRow({ id: "lead-1", stage: "proposal_sent", createdAt: "2026-09-27T10:00:00Z", contact: { name: "Ama", email: "private@example.com" }, inquiry: { destination: "Istanbul", travellers: 2, travelDate: "2027-01-15", notes: "private" } });
  assert.equal(row.name, "Ama"); assert.equal(row.stage, "proposal sent"); assert.equal(row.party, "2 travellers"); assert.equal("notes" in row, false); assert.equal("email" in row, false);
});
