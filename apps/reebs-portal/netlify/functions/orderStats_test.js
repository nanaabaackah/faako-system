import assert from "node:assert/strict";
import test from "node:test";
import { getStatsWindowRange } from "./orderStats.js";

test("getStatsWindowRange today window has key=today and days=1", () => {
  const result = getStatsWindowRange("today");
  assert.equal(result.key, "today");
  assert.equal(result.days, 1);
  assert.ok(result.start instanceof Date);
  assert.ok(result.end instanceof Date);
  assert.ok(result.start <= result.end);
});

test("getStatsWindowRange 7d aliases all resolve correctly", () => {
  for (const alias of ["7d", "7days", "last7days"]) {
    const result = getStatsWindowRange(alias);
    assert.equal(result.key, "7d", `alias ${alias} should have key 7d`);
    assert.equal(result.days, 7, `alias ${alias} should have 7 days`);
  }
});

test("getStatsWindowRange 30d is the default for unknown input", () => {
  const result = getStatsWindowRange("unknown_window");
  assert.equal(result.key, "30d");
  assert.equal(result.days, 30);
});

test("getStatsWindowRange 30d aliases resolve correctly", () => {
  for (const alias of ["30d", "30days", "last30days"]) {
    const result = getStatsWindowRange(alias);
    assert.equal(result.key, "30d");
    assert.equal(result.days, 30);
  }
});

test("getStatsWindowRange thismonth window starts at the 1st of the current month", () => {
  const result = getStatsWindowRange("thismonth");
  assert.equal(result.key, "thisMonth");
  assert.equal(result.start.getUTCDate(), 1);
  assert.equal(result.start.getUTCHours(), 0);
  assert.ok(result.days >= 1);
});

test("getStatsWindowRange all windows return start before end", () => {
  for (const key of ["today", "7d", "30d", "thismonth"]) {
    const { start, end } = getStatsWindowRange(key);
    assert.ok(start < end, `start should be before end for window ${key}`);
  }
});

test("getStatsWindowRange handles null and empty string as 30d default", () => {
  assert.equal(getStatsWindowRange(null).key, "30d");
  assert.equal(getStatsWindowRange("").key, "30d");
});
