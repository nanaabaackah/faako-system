import test from "node:test";
import assert from "node:assert/strict";
import { defaultIntakeDefinition, intakeDefinitionSchema, validateIntakeAdditionalAnswers } from "../src/enquiries/intake-definition.js";

const field = (type, overrides = {}) => ({
  id: "custom_preference", label: "Travel preference", type, required: true,
  entries: ["general"], description: "",
  options: ["select", "multiselect"].includes(type) ? [{ value: "guided", label: "Guided" }, { value: "flexible", label: "Flexible" }] : [],
  ...overrides,
});
const definition = question => ({ ...defaultIntakeDefinition(), additional: [question] });

test("intake core routing values cannot be removed, duplicated or replaced", () => {
  const baseline = defaultIntakeDefinition();
  assert.equal(intakeDefinitionSchema.safeParse(baseline).success, true);
  const changed = structuredClone(baseline);
  changed.core[0].options[0].label = "Personal trip";
  changed.core.reverse();
  assert.equal(intakeDefinitionSchema.safeParse(changed).success, true);
  changed.core.find(item => item.id === "enquiryType").options[0].value = "invented";
  assert.equal(intakeDefinitionSchema.safeParse(changed).success, false);
  assert.equal(intakeDefinitionSchema.safeParse({ ...baseline, core: baseline.core.slice(1) }).success, false);
  const duplicate = structuredClone(baseline);
  duplicate.core[1] = duplicate.core[0];
  assert.equal(intakeDefinitionSchema.safeParse(duplicate).success, false);
});
test("conditional answers reject hidden, unknown and missing required fields", () => {
  const configured = definition(field("select"));
  assert.throws(() => validateIntakeAdditionalAnswers(configured, "general", {}));
  assert.throws(() => validateIntakeAdditionalAnswers(configured, "package", { custom_preference: "guided" }));
  assert.throws(() => validateIntakeAdditionalAnswers(configured, "general", { custom_preference: "invented" }));
  assert.throws(() => validateIntakeAdditionalAnswers(configured, "general", { custom_preference: "guided", custom_unknown: "x" }));
  assert.deepEqual(validateIntakeAdditionalAnswers(configured, "package", {}), []);
  const result = validateIntakeAdditionalAnswers(configured, "general", { custom_preference: "guided" });
  assert.deepEqual(result[0].options, [{ value: "guided", label: "Guided" }]);
  assert.equal(result[0].label, "Travel preference");
});
test("additional answer types enforce dates, bounded numbers, text and unique selections", () => {
  for (const [type, valid, invalid] of [
    ["date", "2028-02-29", "2027-02-29"],
    ["number", "1.25", "1e100"],
    ["text", "Window seat", "a".repeat(241)],
    ["textarea", "Longer answer", "a".repeat(1501)],
    ["multiselect", ["guided", "flexible"], ["guided", "guided"]],
  ]) {
    assert.equal(validateIntakeAdditionalAnswers(definition(field(type)), "general", { custom_preference: valid }).length, 1);
    assert.throws(() => validateIntakeAdditionalAnswers(definition(field(type)), "general", { custom_preference: invalid }));
  }
});
