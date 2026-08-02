import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRestockPeriods, filterEntriesByRestockPeriod } from "./waterPeriodUtils.js";

test("filters sales to the current stock window using the latest restock boundary", () => {
  const restocks = [
    { id: 1, quantity: 10, date: "2024-01-01" },
    { id: 2, quantity: 20, date: "2024-01-05" },
  ];
  const sales = [
    { id: 100, quantity: 2, date: "2024-01-02" },
    { id: 101, quantity: 3, date: "2024-01-05" },
    { id: 102, quantity: 4, date: "2024-01-06" },
  ];

  const periods = buildRestockPeriods(restocks);
  const currentPeriod = periods.find((period) => period.isCurrent);

  assert.ok(currentPeriod, "expected a current restock period");
  assert.deepEqual(
    filterEntriesByRestockPeriod(sales, currentPeriod).map((sale) => sale.id),
    [101, 102],
    "the current window should include entries from the latest restock onward"
  );
});

test("water API requests include the cross-origin session cookie", () => {
  const source = readFileSync(new URL("./AdminWater.jsx", import.meta.url), "utf8");
  const includeCredentials = source.match(/credentials:\s*["']include["']/g) || [];

  assert.equal(source.includes('credentials: "same-origin"'), false);
  assert.equal(includeCredentials.length, 4);
});
