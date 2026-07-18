import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectForm,
  buildProjectPayload,
  validateProjectForm,
} from "./projectForm.js";

const validForm = () =>
  buildProjectForm(null, { organizationId: "4" });

test("project form initializes foundation defaults for new projects", () => {
  const form = validForm();
  assert.equal(form.startDate, "");
  assert.equal(form.progressPercent, "0");
  assert.equal(form.health, "ON_TRACK");
});

test("project form reloads saved foundation values for editing", () => {
  const form = buildProjectForm({
    title: "Client portal",
    startDate: "2026-07-01T00:00:00.000Z",
    dueDate: "2026-08-01T00:00:00.000Z",
    progressPercent: 45,
    health: "AT_RISK",
    organization: { id: 4 },
  });
  assert.equal(form.startDate, "2026-07-01");
  assert.equal(form.dueDate, "2026-08-01");
  assert.equal(form.progressPercent, "45");
  assert.equal(form.health, "AT_RISK");
});

test("project form validates progress and delivery dates", () => {
  const form = { ...validForm(), title: "Client portal" };
  assert.equal(validateProjectForm(form), "");
  assert.match(validateProjectForm({ ...form, progressPercent: "101" }), /between 0 and 100/);
  assert.match(validateProjectForm({ ...form, progressPercent: "4.5" }), /whole number/);
  assert.match(
    validateProjectForm({ ...form, startDate: "2026-08-02", dueDate: "2026-08-01" }),
    /cannot be after/
  );
  assert.match(validateProjectForm({ ...form, startDate: "2026-02-30" }), /valid date/);
});

test("project payload includes typed foundation values", () => {
  const payload = buildProjectPayload(
    {
      ...validForm(),
      title: " Client portal ",
      startDate: "2026-07-01",
      dueDate: "2026-08-01",
      progressPercent: "45",
      health: "AT_RISK",
    },
    { includeOrganization: true }
  );
  assert.equal(payload.title, "Client portal");
  assert.equal("ownerUserId" in payload, false);
  assert.equal(payload.startDate, "2026-07-01");
  assert.equal(payload.dueDate, "2026-08-01");
  assert.equal(payload.progressPercent, 45);
  assert.equal(payload.health, "AT_RISK");
  assert.equal(payload.organizationId, 4);
});
