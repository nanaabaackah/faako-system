import { z } from "zod";
import { emailSchema, phoneSchema } from "@faako/validation";
import {
  QUESTIONNAIRE_ID, QUESTIONNAIRE_VERSION, SERVICE_OPTIONS,
  applicableQuestionIds, branching, questions, selectedServiceFromAnswers, questionnaireRoute,
} from "./questionnaires/index.js";

import { detailedApplicableIds, detailedDefinitionSchema } from "./questionnaires/configuration.js";

const answerValue = z.union([
  z.string().trim().max(2000),
  z.array(z.string().trim().min(1).max(500)).max(20),
]);

const contextSchema = z.object({
  serviceId: z.enum(SERVICE_OPTIONS.map((service) => service.id)).optional(),
  serviceTitle: z.string().trim().min(1).max(160).optional(),
  packageId: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,119}$/).optional(),
  packageTitle: z.string().trim().min(1).max(160).optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.serviceId) !== Boolean(value.serviceTitle)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Service ID and title must be supplied together." });
  if (Boolean(value.packageId) !== Boolean(value.packageTitle)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Package ID and title must be supplied together." });
  const service = SERVICE_OPTIONS.find((item) => item.id === value.serviceId);
  if (service && value.serviceTitle !== service.title) context.addIssue({ code: z.ZodIssueCode.custom, message: "Service title does not match the approved service." });
});

const smartEnquiryBase = z.object({
  submissionId: z.string().uuid(),
  turnstileToken: z.string().max(2048).default(""),
  questionnaireId: z.literal(QUESTIONNAIRE_ID),
  questionnaireVersion: z.literal(QUESTIONNAIRE_VERSION),
  entryType: z.enum(["general", "service", "package", "direct"]),
  sourcePath: z.string().trim().regex(/^\/(?!\/)[a-z0-9/_-]*$/i).max(240),
  context: contextSchema,
  answers: z.record(z.string().regex(/^\d{1,12}$/), answerValue),
  contact: z.object({
    name: z.string().trim().min(2).max(160), email: emailSchema, phone: phoneSchema,
  }).strict(),
  consent: z.literal(true),
  website: z.string().max(200).default(""),
}).strict();

function validateAnswers(data, validation, applicableIds, questionMap) {
  if (data.entryType === "service" && !data.context.serviceId) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["context", "serviceId"], message: "Choose a valid service." });
  if (data.entryType === "package" && !data.context.packageId) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["context", "packageId"], message: "Choose a valid package." });
  const applicable = new Set(applicableIds);
  for (const id of Object.keys(data.answers)) {
    if (!applicable.has(id)) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "Hidden or deferred answers are not accepted." });
  }
  for (const id of applicable) {
    const question = questionMap[id];
    const value = data.answers[id];
    const required = question.required
      || (id === "1653151808" && selectedServiceFromAnswers(data.answers) === "not_sure")
      || id === branching.groupDestinationDetailsQuestionId
      || id === branching.groupCostCoverageDetailsQuestionId;
    const empty = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
    if (required && empty) {
      validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "This question is required." });
      continue;
    }
    if (empty) continue;
    if (question.type === "CHECKBOX") {
      if (!Array.isArray(value)) {
        validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "Select one or more listed choices." });
        continue;
      }
      if (new Set(value).size !== value.length || (question.maxSelections && value.length > question.maxSelections)) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: `Select no more than ${question.maxSelections || question.options.length} unique choices.` });
      if (value.some((choice) => !question.options.includes(choice)) || (question.requireAllOptions && value.length !== question.options.length)) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "Select the required listed choices." });
    } else if (Array.isArray(value)) {
      validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "Choose or enter one answer." });
    } else if (["MULTIPLE_CHOICE", "DROPDOWN"].includes(question.type) && !question.options.includes(value) && !question.allowOther) {
      validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "Choose a listed option." });
    }
    if (question.type === "DATE" && typeof value === "string") {
      const date = new Date(value + "T00:00:00Z");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "Choose a valid date." });
    }
    if (question.type === "NUMBER" && (typeof value !== "string" || !/^-?\d+(?:\.\d{1,4})?$/.test(value) || Math.abs(Number(value)) > 1e9)) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "Enter a valid number." });
    if (question.integer) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < question.min || number > question.max) validation.addIssue({
        code: z.ZodIssueCode.custom, path: ["answers", id],
        message: `Enter a whole number from ${question.min} to ${question.max}.`,
      });
    }
    if (question.format === "currency_amount" && !/^(GHS|USD|GBP)\s+[0-9][0-9,]*(?:\.[0-9]{1,2})?$/i.test(value)) validation.addIssue({
      code: z.ZodIssueCode.custom, path: ["answers", id],
      message: "Enter an amount beginning with GHS, USD or GBP, for example GHS 10,000.",
    });
  }
  const contactMap = { "476632894": "name", "1078451195": "phone", "214964047": "email" };
  for (const [id, field] of Object.entries(contactMap)) {
    if (data.answers[id] !== data.contact[field]) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "Contact answer does not match the contact details." });
  }
}

export const smartEnquirySchema = smartEnquiryBase.superRefine((data, validation) => validateAnswers(data, validation, applicableQuestionIds(data.context, data.answers), questions));

export function configuredSmartEnquirySchema(definition, version) {
  const checked = detailedDefinitionSchema.parse(definition);
  const questionMap = detailedQuestionMap(checked);
  return smartEnquiryBase.extend({ questionnaireVersion: z.literal(`cms.${version}`) }).superRefine((data, validation) => validateAnswers(data, validation, detailedApplicableIds(checked, data.context, data.answers), questionMap));
}

export function detailedQuestionMap(definition) {
  return Object.fromEntries(definition.questions.map(item => {
    const original = questions[item.id];
    const metadata = original?.type === item.type ? original : {};
    return [item.id, { ...metadata, ...item, allowOther: false }];
  }));
}

export function configuredQuestionnaireSnapshot(data, definition) {
  const applicableIds = detailedApplicableIds(definition, data.context, data.answers);
  const byId = detailedQuestionMap(definition);
  return {
    questionnaireId: data.questionnaireId, questionnaireVersion: data.questionnaireVersion,
    applicableQuestionIds: applicableIds,
    questionSnapshots: Object.fromEntries(applicableIds.map(id => {
      const item = byId[id];
      const step = definition.steps.find(step => step.routes.includes(questionnaireRoute(data.context, data.answers)) && step.questionIds.includes(id));
      return [id, { id, label: item.label, sectionId: step.id, sectionTitle: step.title, source: item.source || "cms", options: item.options }];
    })),
    answers: Object.fromEntries(applicableIds.filter(id => data.answers[id] !== undefined && data.answers[id] !== "" && data.answers[id]?.length !== 0).map(id => [id, data.answers[id]])),
  };
}

export function validatedQuestionnaireSnapshot(data) {
  const applicableIds = [...applicableQuestionIds(data.context, data.answers)];
  return {
    questionnaireId: data.questionnaireId,
    questionnaireVersion: data.questionnaireVersion,
    applicableQuestionIds: applicableIds,
    questionSnapshots: Object.fromEntries(applicableIds.map((id) => [id, {
      id, label: questions[id].label, sectionId: questions[id].sectionId,
      sectionTitle: questions[id].sectionTitle, source: questions[id].source,
    }])),
    answers: Object.fromEntries(applicableIds
      .filter((id) => data.answers[id] !== undefined && data.answers[id] !== "" && data.answers[id]?.length !== 0)
      .map((id) => [id, data.answers[id]])),
  };
}
