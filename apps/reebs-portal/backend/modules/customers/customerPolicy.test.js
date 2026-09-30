import assert from "node:assert/strict";
import test from "node:test";
import { parseCustomerPage, parseCustomerScope } from "./customerPolicy.js";

test("Customer commercial scope defaults to Core and Water remains explicit", () => {
  assert.equal(parseCustomerScope(), "core");
  assert.equal(parseCustomerScope("consolidated"), "core");
  assert.equal(parseCustomerScope("water"), "water");
});

test("Customer pagination is bounded", () => {
  assert.deepEqual(parseCustomerPage({ page: "2", pageSize: "500" }), {
    page: 2,
    pageSize: 100,
    offset: 100,
  });
});
