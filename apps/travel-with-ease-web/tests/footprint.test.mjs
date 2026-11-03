import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { footprintRows, footprintBand, experienceRows } from "../src/lib/footprint.js";
const { countries } = JSON.parse(readFileSync(new URL("../src/lib/world-boundaries.json", import.meta.url)));
test("footprint rejects demo projection outside the demo and invalid aggregates", () => {
  assert.throws(() => footprintRows([{countryCode:"KE",total:12,status:"demo"}], countries));
  for (const total of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => footprintRows([{countryCode:"KE",total,status:"verified"}],countries));
  assert.throws(() => footprintRows([{countryCode:"ZZ",total:1,status:"verified"}],countries));
  assert.throws(() => footprintRows(Array(2).fill({countryCode:"KE",total:1,status:"verified"}),countries));
});

test("all 21 supplied countries retain qualified visits without becoming exact business trips", () => {
  const snapshot = JSON.parse(readFileSync(new URL("../content/approved-public-release.json", import.meta.url)));
  const tiny = JSON.parse(readFileSync(new URL("../src/lib/footprint-small-countries.json", import.meta.url)));
  const source = snapshot.pages["travel-footprint"].experienceCountries;
  const rows = experienceRows(source, [...countries, ...tiny.countries]);
  assert.equal(rows.length, 21);
  assert.equal(new Set(rows.map(row => row.countryCode)).size, 21);
  assert.equal(rows.find(row => row.countryCode === "GB").label, "25+ visits");
  assert.equal(rows.find(row => row.countryCode === "US").label, "About 5 visits");
  assert.equal(rows.find(row => row.countryCode === "ZA").label, "3 visits");
  assert.equal(rows.find(row => row.countryCode === "GR").label, "Visited");
  assert.ok(rows.some(row => row.countryCode === "TZ"));
  assert.ok(!rows.some(row => row.countryCode === "Zanzibar"));
  assert.ok(rows.every(row => !("source" in row) && !("total" in row)));
  for (const code of ["MC", "MT", "SC", "MU"]) {
    assert.ok(rows.some(row => row.countryCode === code));
    const point = tiny.countries.find(item => item.code === code);
    assert.ok((point.longitude + 180) * 2 >= 0 && (90 - point.latitude) * 2 <= 300);
  }
  assert.throws(() => experienceRows([...source, source[0]], [...countries, ...tiny.countries]));
  assert.throws(() => experienceRows([{ ...source[0], visitCount: null }], countries));
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
