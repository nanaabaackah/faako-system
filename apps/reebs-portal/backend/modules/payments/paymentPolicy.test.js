import assert from "node:assert/strict";
import test from "node:test";
import { canRecordManualPayment } from "./paymentPolicy.js";

test("manual payment permission is explicit and excludes operational-only roles", () => {
  assert.equal(canRecordManualPayment({ role: "manager" }), true);
  assert.equal(canRecordManualPayment({ role: "staff" }), true);
  assert.equal(canRecordManualPayment({ role: "driver" }), false);
  assert.equal(canRecordManualPayment({ role: "water" }), false);
});
