import assert from "node:assert/strict";
import test from "node:test";
import {
  appendProjectFilterParams,
  createDefaultProjectFilters,
  hasActiveProjectFilters,
} from "./projectFilters.js";

test("project filters append only active server query parameters", () => {
  const params = appendProjectFilterParams(new URLSearchParams("organizationId=4"), {
    filters: {
      ...createDefaultProjectFilters(),
      stage: "ACTIVE",
      priority: "URGENT",
      health: "AT_RISK",
      type: "EXTERNAL",
    },
    searchQuery: "  portal launch  ",
  });

  assert.equal(
    params.toString(),
    "organizationId=4&stage=ACTIVE&priority=URGENT&health=AT_RISK&type=EXTERNAL&search=portal+launch"
  );
});

test("default project filters produce no filter query and report inactive", () => {
  const filters = createDefaultProjectFilters();
  const params = appendProjectFilterParams(new URLSearchParams(), {
    filters,
    searchQuery: "   ",
  });

  assert.equal(params.toString(), "");
  assert.equal(hasActiveProjectFilters({ filters, searchQuery: "" }), false);
  assert.equal(hasActiveProjectFilters({ filters: { ...filters, health: "BLOCKED" } }), true);
  assert.equal(hasActiveProjectFilters({ filters, searchQuery: "client" }), true);
});
