import assert from "node:assert/strict";
import test from "node:test";

import {
  getProjectHealthLabel,
  getProjectHealthTone,
  normalizeProjectProgress,
} from "./projectPresentation.js";

test("project health presentation uses readable labels and tones", () => {
  assert.equal(getProjectHealthLabel("ON_TRACK"), "On track");
  assert.equal(getProjectHealthLabel("AT_RISK"), "At risk");
  assert.equal(getProjectHealthLabel("BLOCKED"), "Blocked");
  assert.equal(getProjectHealthTone("ON_TRACK"), "on-track");
  assert.equal(getProjectHealthTone("AT_RISK"), "at-risk");
  assert.equal(getProjectHealthTone("BLOCKED"), "blocked");
});

test("project progress presentation clamps values to the accessible range", () => {
  assert.equal(normalizeProjectProgress(undefined), 0);
  assert.equal(normalizeProjectProgress(-4), 0);
  assert.equal(normalizeProjectProgress(42.4), 42);
  assert.equal(normalizeProjectProgress(140), 100);
});
