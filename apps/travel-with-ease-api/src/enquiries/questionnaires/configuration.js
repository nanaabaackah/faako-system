import { z } from "zod";
import { questions, questionnaireSteps, branching, questionnaireRoute, applicableQuestionIds } from "./index.js";

export const DETAILED_FORM_ID = "twe-detailed-questionnaire";
export const DETAILED_BASELINE_VERSION = 1;
export const DETAILED_ROUTES = ["router", "planning", "safe_general", "package", "group"];
const contactIds = ["476632894", "1078451195", "214964047"];
// Existing routing, conditional branches, contact mapping and commercial
// constraints remain system-owned, even when their display text is edited.
export const protectedQuestionIds = Object.freeze([
  ...contactIds, "1997323435", branching.serviceRouterQuestionId,
  branching.notSureQuestionId, branching.visaQuestionId,
  branching.groupDestinationStatusQuestionId, branching.groupDestinationDetailsQuestionId,
  branching.groupCostCoverageQuestionId, branching.groupCostCoverageDetailsQuestionId,
  "836507955", "300000015", "300000023",
]);
const protectedSet = new Set(protectedQuestionIds);
const approved = Object.fromEntries(Object.entries(questions).filter(([, question]) => question.collection === "approved"));
const label = z.string().trim().min(1).max(240);
const questionId = z.string().regex(/^\d{1,12}$/);
const stepId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const route = z.enum(DETAILED_ROUTES);
const condition = z.object({ questionId, option: label }).strict();
const editableQuestion = z.object({
  id: questionId,
  label,
  description: z.string().trim().max(2000),
  type: z.enum(["TEXT", "PARAGRAPH_TEXT", "MULTIPLE_CHOICE", "CHECKBOX", "DATE", "NUMBER", "DROPDOWN"]),
  required: z.boolean(),
  options: z.array(label).max(30),
  condition: condition.optional(),
}).strict();
const editableStep = z.object({
  id: stepId, title: label, routes: z.array(route).min(1).max(5),
  questionIds: z.array(questionId).min(1).max(50),
}).strict();

function baselineQuestion(question) {
  return { id: question.id, label: question.label, description: question.description,
    type: question.type, required: question.required, options: [...question.options] };
}
const baselineSteps = questionnaireSteps.map(step => ({
  id: step.id, title: step.title, routes: step.routes.includes("all") ? [...DETAILED_ROUTES] : [...step.routes],
  questionIds: step.questionIds.filter(id => approved[id]),
})).filter(step => step.questionIds.length);
const baselineIds = new Set(baselineSteps.flatMap(step => step.questionIds));
const originalRouteIds = name => baselineSteps.filter(step => step.routes.includes(name)).flatMap(step => step.questionIds);

export const detailedDefinitionSchema = z.object({
  steps: z.array(editableStep).min(1).max(40),
  questions: z.array(editableQuestion).min(1).max(100),
  continueLabel: label,
  submitLabel: label,
}).strict().superRefine((definition, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  const ids = new Map();
  const stepIds = new Set();
  for (const [index, item] of definition.questions.entries()) {
    const path = ["questions", index];
    if (ids.has(item.id)) issue([...path, "id"], "Duplicate question identifier.");
    ids.set(item.id, item);
    // New questions use a separate reserved 12-digit namespace. Never
    // revive a deferred source question or repurpose an unused source ID.
    if (!baselineIds.has(item.id) && (!/^9\d{11}$/.test(item.id) || Object.hasOwn(questions, item.id))) issue([...path, "id"], "Unknown or deferred source question.");
    const choice = ["MULTIPLE_CHOICE", "CHECKBOX", "DROPDOWN"].includes(item.type);
    if (choice ? item.options.length < 2 : item.options.length !== 0) issue([...path, "options"], "Choice questions need at least two options; other types cannot have options.");
    if (new Set(item.options).size !== item.options.length) issue([...path, "options"], "Choices must be unique.");
    if (protectedSet.has(item.id)) {
      const original = approved[item.id];
      if (!original || item.type !== original.type || item.required !== original.required || JSON.stringify(item.options) !== JSON.stringify(original.options) || item.condition)
        issue(path, "Protected question type, requiredness, routing choices and conditions cannot change.");
    }
  }
  for (const [index, step] of definition.steps.entries()) {
    if (stepIds.has(step.id)) issue(["steps", index, "id"], "Duplicate step identifier.");
    stepIds.add(step.id);
    if (new Set(step.routes).size !== step.routes.length) issue(["steps", index, "routes"], "Duplicate route.");
    if (step.questionIds.some(id => !ids.has(id))) issue(["steps", index, "questionIds"], "Step references an unknown question.");
  }
  const used = new Set();
  for (const name of DETAILED_ROUTES) {
    const sequence = definition.steps.filter(step => step.routes.includes(name)).flatMap(step => step.questionIds);
    if (!sequence.length) issue(["steps"], "Every questionnaire route needs at least one step.");
    if (new Set(sequence).size !== sequence.length) issue(["steps"], "A question may appear only once per route.");
    sequence.forEach(id => used.add(id));
    const expected = originalRouteIds(name);
    for (const id of protectedQuestionIds) {
      if (sequence.includes(id) !== expected.includes(id)) issue(["steps"], "Protected questions must remain on their original routes.");
    }
    // The existing wizard branches as soon as a support answer changes;
    // retain the same first-step routing questions on all router routes.
    if (expected.includes(branching.serviceRouterQuestionId)) {
      const first = definition.steps.find(step => step.routes.includes(name));
      const routing = [branching.serviceRouterQuestionId, "1997323435", branching.notSureQuestionId];
      if (first && routing.some(id => !first.questionIds.includes(id))) issue(["steps"], "Support routing questions must stay together in the first step.");
    }
    for (const [parent, child] of [[branching.groupDestinationStatusQuestionId, branching.groupDestinationDetailsQuestionId], [branching.groupCostCoverageQuestionId, branching.groupCostCoverageDetailsQuestionId]]) {
      if (sequence.includes(child) && sequence.indexOf(parent) >= sequence.indexOf(child)) issue(["steps"], "Protected follow-up questions must follow their routing question.");
    }
    for (const id of sequence) {
      const item = ids.get(id);
      if (!item?.condition) continue;
      const dependency = ids.get(item.condition.questionId);
      if (!dependency || !["MULTIPLE_CHOICE", "DROPDOWN", "CHECKBOX"].includes(dependency.type) ||
          !dependency.options.includes(item.condition.option) || sequence.indexOf(dependency.id) < 0 ||
          sequence.indexOf(dependency.id) >= sequence.indexOf(id)) {
        issue(["questions"], "Conditional questions must reference an earlier listed choice on every applicable route.");
      }
    }
  }
  if (definition.questions.some(item => !used.has(item.id))) issue(["questions"], "Every question must belong to a step.");
});

export function defaultDetailedDefinition() {
  return detailedDefinitionSchema.parse({
    steps: baselineSteps,
    questions: [...baselineIds].map(id => baselineQuestion(approved[id])),
    continueLabel: "Continue", submitLabel: "Submit",
  });
}

// Apply the existing protected branch rules to an edited layout. Additional
// conditional questions are processed in order; a hidden dependency never
// makes its child visible, even if a client sends a stale hidden answer.
export function detailedApplicableIds(definition, context = {}, answers = {}) {
  const routeName = questionnaireRoute(context, answers);
  const originalApplicable = new Set(applicableQuestionIds(context, answers));
  const byId = new Map(definition.questions.map(question => [question.id, question]));
  const visible = new Set();
  for (const step of definition.steps.filter(step => step.routes.includes(routeName))) {
    for (const id of step.questionIds) {
      const item = byId.get(id);
      if (!item || (protectedSet.has(id) && !originalApplicable.has(id))) continue;
      if (item.condition) {
        const { questionId: parent, option } = item.condition;
        const answer = answers[parent];
        if (!visible.has(parent) || !(Array.isArray(answer) ? answer.includes(option) : answer === option)) continue;
      }
      visible.add(id);
    }
  }
  return [...visible];
}
