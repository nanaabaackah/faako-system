import { z } from "zod";
import { emailSchema, phoneSchema } from "@faako/validation";
import {
  QUESTIONNAIRE_ID, QUESTIONNAIRE_VERSION, SERVICE_OPTIONS,
  applicableQuestionIds, questions, selectedServiceFromAnswers,
} from "./questionnaires/index.js";

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

export const smartEnquirySchema = z.object({
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
}).strict().superRefine((data, validation) => {
  if (data.entryType === "service" && !data.context.serviceId) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["context", "serviceId"], message: "Choose a valid service." });
  if (data.entryType === "package" && !data.context.packageId) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["context", "packageId"], message: "Choose a valid package." });
  const applicable = new Set(applicableQuestionIds(data.context, data.answers));
  for (const id of Object.keys(data.answers)) {
    if (!applicable.has(id)) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "Hidden or deferred answers are not accepted." });
  }
  for (const id of applicable) {
    const question = questions[id];
    const value = data.answers[id];
    const required = question.required || (id === "1653151808" && selectedServiceFromAnswers(data.answers) === "not_sure");
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
    } else if (question.type === "MULTIPLE_CHOICE" && !question.options.includes(value) && !question.allowOther) {
      validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "Choose a listed option." });
    }
  }
  const contactMap = { "476632894": "name", "1078451195": "phone", "214964047": "email" };
  for (const [id, field] of Object.entries(contactMap)) {
    if (data.answers[id] !== data.contact[field]) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["answers", id], message: "Contact answer does not match the contact details." });
  }
});

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
