import { z } from "zod";
import { enquiryTypes } from "../content/catalogue-constants.js";
import { SERVICE_OPTIONS } from "./questionnaires/index.js";

// Existing enquiry data keys and service IDs remain stable. This definition is
// presentation/configuration only; contact, consent, anti-abuse and routing
// contracts continue to be enforced by the native enquiry schema.
export const INTAKE_FORM_ID = "twe-initial-enquiry";
export const INTAKE_BASELINE_VERSION = 1;
export const INTAKE_CORE_FIELDS = Object.freeze([
  { id: "enquiryType", label: "Enquiry type", type: "select", required: true, options: enquiryTypes.map(({ value, label }) => ({ value, label })) },
  { id: "service", label: "Planning support", type: "select", required: true, options: [{ value: "not_sure", label: "Help me choose" }, ...SERVICE_OPTIONS.map(({ id, title }) => ({ value: id, label: title }))] },
  { id: "destination", label: "Where would you like to go?", type: "text", required: true, placeholder: "A destination, a few ideas, or help me choose" },
  { id: "travelTimeframe", label: "When would you like to travel?", type: "text", required: true, placeholder: "Dates, a month, or still exploring" },
  { id: "travellers", label: "Travellers", type: "number", required: true },
  { id: "budget", label: "Approximate total budget (optional)", type: "text", required: false, placeholder: "Include the currency, or leave this blank" },
  { id: "name", label: "Your name", type: "text", required: true },
  { id: "email", label: "Email", type: "email", required: true },
  { id: "phone", label: "WhatsApp number", type: "tel", required: true, placeholder: "+233…" },
]);
const label = z.string().trim().min(1).max(160);
const hint = z.string().trim().max(240);
const option = z.object({ value: z.string().regex(/^[a-z0-9_-]{1,60}$/), label }).strict();
const core = z.object({
  id: z.enum(INTAKE_CORE_FIELDS.map(field => field.id)),
  label, placeholder: hint.optional(),
  options: z.array(option).min(1).max(20).optional(),
}).strict();
const additional = z.object({
  id: z.string().regex(/^custom_[a-z0-9_]{1,48}$/),
  label,
  description: hint.default(""),
  type: z.enum(["text", "textarea", "select", "multiselect", "date", "number"]),
  required: z.boolean().default(false),
  entries: z.array(z.enum(["general", "service", "package"])).min(1).max(3).default(["general", "service", "package"]),
  options: z.array(option).max(20).default([]),
}).strict();

export const intakeDefinitionSchema = z.object({
  title: label,
  core: z.array(core).length(INTAKE_CORE_FIELDS.length),
  additional: z.array(additional).max(12).default([]),
}).strict().superRefine((definition, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  const seen = new Set();
  definition.core.forEach((field, index) => {
    const original = INTAKE_CORE_FIELDS.find(item => item.id === field.id);
    if (seen.has(field.id)) issue(["core", index, "id"], "Core fields must appear exactly once.");
    seen.add(field.id);
    if (original?.options) {
      const expected = original.options.map(item => item.value).sort().join("|");
      const actual = (field.options || []).map(item => item.value).sort().join("|");
      if (actual !== expected) issue(["core", index, "options"], "Protected routing option values must remain unchanged.");
    } else if (field.options) issue(["core", index, "options"], "This field cannot have choices.");
  });
  definition.additional.forEach((field, index) => {
    if (seen.has(field.id)) issue(["additional", index, "id"], "Question identifiers must be unique.");
    seen.add(field.id);
    if (new Set(field.entries).size !== field.entries.length) issue(["additional", index, "entries"], "Select each context once.");
    const choice = ["select", "multiselect"].includes(field.type);
    if (choice ? field.options.length < 2 : field.options.length > 0) issue(["additional", index, "options"], "Choice fields need at least two choices; other fields cannot have choices.");
    if (new Set(field.options.map(item => item.value)).size !== field.options.length) issue(["additional", index, "options"], "Choice identifiers must be unique.");
  });
});

export function defaultIntakeDefinition() {
  return intakeDefinitionSchema.parse({
    title: "Tell us about your trip",
    core: INTAKE_CORE_FIELDS.map(({ id, label, placeholder, options }) => ({ id, label, ...(placeholder !== undefined ? { placeholder } : {}), ...(options ? { options } : {}) })),
    additional: [],
  });
}

// Validate and snapshot extra answers from a server-resolved immutable version,
// never from question labels/options supplied by the visitor.
const answerValue = z.union([z.string().trim().max(1500), z.array(z.string().trim().max(60)).max(20)]);
export const intakeAdditionalAnswersSchema = z.record(z.string().regex(/^custom_[a-z0-9_]{1,48}$/), answerValue);
export function validateIntakeAdditionalAnswers(definition, entryType, input) {
  const validated = intakeDefinitionSchema.parse(definition);
  const answers = intakeAdditionalAnswersSchema.parse(input);
  const fields = validated.additional.filter(field => field.entries.includes(entryType));
  const issues = [];
  const reject = (id, message) => issues.push({ code: z.ZodIssueCode.custom, path: [id], message });
  for (const id of Object.keys(answers)) if (!fields.some(field => field.id === id)) reject(id, "Unknown or hidden question.");
  const snapshot = [];
  for (const field of fields) {
    const answer = answers[field.id];
    const empty = answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0);
    if (empty) {
      if (field.required) reject(field.id, "Answer this question.");
      continue;
    }
    const values = field.options.map(item => item.value);
    if (field.type === "multiselect") {
      if (!Array.isArray(answer) || new Set(answer).size !== answer.length || answer.some(value => !values.includes(value))) reject(field.id, "Choose unique listed options.");
    } else if (typeof answer !== "string") reject(field.id, "Enter one answer.");
    else if (field.type === "select" && !values.includes(answer)) reject(field.id, "Choose a listed option.");
    else if (field.type === "text" && answer.length > 240) reject(field.id, "Enter at most 240 characters.");
    else if (field.type === "number" && (!/^-?\d+(?:\.\d{1,4})?$/.test(answer) || !Number.isFinite(Number(answer)) || Math.abs(Number(answer)) > 1e9)) reject(field.id, "Enter a valid number.");
    else if (field.type === "date") {
      const date = new Date(answer + "T00:00:00Z");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(answer) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== answer) reject(field.id, "Choose a valid date.");
    }
    snapshot.push({ id: field.id, label: field.label, type: field.type, answer, options: field.options.filter(item => Array.isArray(answer) ? answer.includes(item.value) : answer === item.value) });
  }
  if (issues.length) throw new z.ZodError(issues);
  return snapshot;
}
