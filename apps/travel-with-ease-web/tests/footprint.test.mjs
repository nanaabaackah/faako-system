import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { footprintRows, footprintBand } from "../src/lib/footprint.js";
const { countries } = JSON.parse(readFileSync(new URL("../src/lib/world-boundaries.json", import.meta.url)));
test("footprint rejects demo projection outside the demo and invalid aggregates", () => {
  assert.throws(() => footprintRows([{countryCode:"KE",total:12,status:"demo"}], countries));
  for (const total of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => footprintRows([{countryCode:"KE",total,status:"verified"}],countries));
  assert.throws(() => footprintRows([{countryCode:"ZZ",total:1,status:"verified"}],countries));
  assert.throws(() => footprintRows(Array(2).fill({countryCode:"KE",total:1,status:"verified"}),countries));
});
test("fixed logarithmic bins handle empty, zero and outliers consistently", () => {
  assert.deepEqual(footprintRows([],countries),[]);
  assert.deepEqual([0,1,9,10,99,100,999,1000,Number.MAX_SAFE_INTEGER].map(footprintBand),[0,1,1,2,2,3,3,4,4]);
});
test("country projection is aggregate-only and Zanzibar belongs to Tanzania", () => {
  const rows = footprintRows([{countryCode:"TZ",total:4,status:"demo",traveller:"must not escape"}],countries,true);
  assert.deepEqual(rows,[{countryCode:"TZ",name:"Tanzania",total:4,status:"demo"}]);
  assert.ok(countries.some(country=>country.code==="KE"));
  assert.ok(!countries.some(country=>country.name==="Zanzibar"));
  assert.ok(countries.every(country=>/^[MLZ0-9.,-]+$/.test(country.path)));
});
