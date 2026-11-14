import { z } from "zod";
import { emailSchema, phoneSchema, isoDateSchema } from "@faako/validation";
import { enquiryTypes } from "./content/catalogue-constants.js";
import { SERVICE_OPTIONS } from "./enquiries/questionnaires/index.js";
export { smartEnquirySchema } from "./enquiries/questionnaire-validation.js";

const nativeContextSchema = z.object({
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

// A short first-contact intake, independent of the deferred price estimator.
// Never collect passport numbers, document uploads or payment data here.
export const legacyNativeInquirySchema = z.object({
  submissionId: z.string().uuid(),
  turnstileToken: z.string().max(2048).default(""),
  enquiryType: z.enum(enquiryTypes.map(item => item.value)),
  service: z.enum(["not_sure", "readiness", "full_planning", "premium", "group"]),
  destination: z.string().trim().min(2).max(120),
  travelTimeframe: z.string().trim().min(2).max(160),
  travellers: z.number().int().min(1).max(100),
  budget: z.string().trim().max(160).default(""),
  name: z.string().trim().min(2).max(160),
  email: emailSchema,
  phone: phoneSchema,
  notes: z.string().trim().max(1500).default(""),
  entryType: z.enum(["general", "service", "package"]).default("general"),
  sourcePath: z.string().trim().regex(/^\/(?!\/)[a-z0-9/_-]*$/i).max(240).default("/"),
  context: nativeContextSchema.default({}),
  consent: z.literal(true),
  website: z.string().max(200).default(""),
}).strict().superRefine((data, validation) => {
  if (data.entryType === "service" && !data.context.serviceId) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["context", "serviceId"], message: "Choose a valid service." });
  if (data.entryType === "package" && !data.context.packageId) validation.addIssue({ code: z.ZodIssueCode.custom, path: ["context", "packageId"], message: "Choose a valid package." });
});
export const nativeInquirySchema = legacyNativeInquirySchema;

export const estimateSchema = z.object({
  destination: z.string().trim().min(2).max(120),
  travellers: z.coerce.number().int().min(1).max(30),
  nights: z.coerce.number().int().min(1).max(60),
  travelDate: isoDateSchema.refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Choose a valid calendar date."),
  accommodation: z.enum(["comfortable", "premium", "luxury"]),
  tripStyle: z.enum(["relaxed", "balanced", "immersive"]),
  activities: z.enum(["few", "some", "many"]),
  flightPreference: z.enum(["economy", "premium_economy", "business"]),
}).strip();
export const inquirySchema = estimateSchema.extend({
  turnstileToken: z.string().max(2048).default(""),
  name: z.string().trim().min(2).max(160),
  email: emailSchema,
  phone: phoneSchema,
  notes: z.string().trim().max(1500).optional().default(""),
  consent: z.literal(true),
  website: z.string().max(200).optional().default(""),
  estimateLowMinor: z.string().regex(/^\d+$/).optional(),
  estimateHighMinor: z.string().regex(/^\d+$/).optional(),
}).strip();
