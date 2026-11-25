import test from "node:test";
import assert from "node:assert/strict";
import { defaultDetailedDefinition, detailedDefinitionSchema, detailedApplicableIds } from "../src/enquiries/questionnaires/configuration.js";
import { applicableQuestionIds, branching } from "../src/enquiries/questionnaires/index.js";

test("default detailed configuration preserves existing visible questions for every service route", () => {
  const definition = defaultDetailedDefinition();
  for (const [context, answers] of [
    [{}, {}],
    [{}, { [branching.serviceRouterQuestionId]: "I’m not sure yet — please guide me" }],
    ...["readiness", "full_planning", "premium", "group"].map(serviceId => [{ serviceId }, {}]),
    [{ packageId: "sample" }, {}],
    [{ serviceId: "group" }, { [branching.groupDestinationStatusQuestionId]: "Yes, we have decided", [branching.groupCostCoverageQuestionId]: "A sponsor, employer or organisation will pay part" }],
  ]) {
    assert.deepEqual(detailedApplicableIds(definition, context, answers), [...applicableQuestionIds(context, answers)]);
  }
});
test("protected contact and routing questions cannot be removed or repurposed", () => {
  const definition = defaultDetailedDefinition();
  const router = definition.questions.find(question => question.id === branching.serviceRouterQuestionId);
  router.options[0] = "Unrecognised route";
  assert.equal(detailedDefinitionSchema.safeParse(definition).success, false);
  const missing = defaultDetailedDefinition();
  missing.steps = missing.steps.map(step => ({ ...step, questionIds: step.questionIds.filter(id => id !== "476632894") }));
  missing.questions = missing.questions.filter(question => question.id !== "476632894");
  assert.equal(detailedDefinitionSchema.safeParse(missing).success, false);
  const deferred = defaultDetailedDefinition();
  deferred.questions.push({ id: "1811901185", label: "Deferred", description: "", type: "TEXT", required: false, options: [] });
  deferred.steps[0].questionIds.push("1811901185");
  assert.equal(detailedDefinitionSchema.safeParse(deferred).success, false);
});
test("custom conditional questions require an earlier visible parent on each route", () => {
  const definition = defaultDetailedDefinition();
  const parent = { id: "900000000001", label: "Trip preference", description: "", type: "DROPDOWN", required: true, options: ["Guided", "Independent"] };
  const child = { id: "900000000002", label: "Preferred guide", description: "", type: "TEXT", required: false, options: [], condition: { questionId: parent.id, option: "Guided" } };
  definition.questions.push(parent, child);
  definition.steps.push({ id: "custom-preferences", title: "More preferences", routes: ["package"], questionIds: [parent.id, child.id] });
  assert.equal(detailedDefinitionSchema.safeParse(definition).success, true);
  assert.equal(detailedApplicableIds(definition, { packageId: "sample" }, {}).includes(child.id), false);
  assert.equal(detailedApplicableIds(definition, { packageId: "sample" }, { [parent.id]: "Guided" }).includes(child.id), true);
  assert.equal(detailedApplicableIds(definition, { serviceId: "group" }, { [parent.id]: "Guided" }).includes(child.id), false);
  definition.steps.at(-1).questionIds.reverse();
  assert.equal(detailedDefinitionSchema.safeParse(definition).success, false);
});
