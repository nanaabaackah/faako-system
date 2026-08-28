import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isAllowedWaterPaymentTransition } from "./water-momo-webhook.js";

test("Water payment notifications cannot downgrade a paid sale", () => {
  assert.equal(isAllowedWaterPaymentTransition("paid", "paid"), true);
  assert.equal(isAllowedWaterPaymentTransition("paid", "pending"), false);
  assert.equal(isAllowedWaterPaymentTransition("paid", "unpaid"), false);
});

test("Water pending notifications may reach a terminal settlement state", () => {
  assert.equal(isAllowedWaterPaymentTransition("pending", "paid"), true);
  assert.equal(isAllowedWaterPaymentTransition("pending", "unpaid"), true);
});

test("Water payment notifications advance the sale concurrency timestamp", () => {
  const source = readFileSync(new URL("./water-momo-webhook.js", import.meta.url), "utf8");
  assert.match(source, /"paidAt" = \$6,\s*"updatedAt" = NOW\(\)/);
});
