import test from "node:test";
import assert from "node:assert/strict";
import { nextTableSort, sortTableRows, tableDate } from "./tableRows.js";

const rows = [{ id: 10, amount: 100 }, { id: 2, amount: 9 }, { id: 3, amount: 9 }, { id: 4, amount: null }];
const accessors = { id: (row) => row.id, amount: (row) => row.amount };
test("sorts full data numerically before slicing without mutation, retaining ties", () => {
  const sorted = sortTableRows(rows, accessors, { key: "amount", direction: "asc" });
  assert.deepEqual(sorted.slice(0, 2).map((row) => row.id), [2, 3]);
  assert.deepEqual(rows.map((row) => row.id), [10, 2, 3, 4]);
});
test("missing or restricted amounts stay last in descending sort", () => {
  assert.deepEqual(sortTableRows(rows, accessors, { key: "amount", direction: "desc" }).map((row) => row.id), [10, 2, 3, 4]);
});
test("unknown and inherited keys cannot become accessors", () => {
  for (const key of ["unknown", "constructor", "__proto__"]) assert.equal(sortTableRows(rows, accessors, { key }), rows);
});
test("natural text sort, date normalization and direction toggling", () => {
  assert.deepEqual(sortTableRows([{ name: "Item 10" }, { name: "Item 2" }], { name: (row) => row.name }, { key: "name" }).map((row) => row.name), ["Item 2", "Item 10"]);
  assert.equal(tableDate("invalid"), null);
  assert.equal(tableDate(null), null);
  assert.equal(tableDate("2026-01-01T00:00:00Z"), Date.UTC(2026, 0, 1));
  assert.deepEqual(nextTableSort({ key: "id", direction: "asc" }, "id"), { key: "id", direction: "desc" });
  assert.deepEqual(nextTableSort({ key: "id", direction: "desc" }, "amount"), { key: "amount", direction: "asc" });
});
