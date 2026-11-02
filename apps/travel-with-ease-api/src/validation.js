import { z } from "zod";
import { emailSchema, phoneSchema, isoDateSchema } from "@faako/validation";

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
  name: z.string().trim().min(2).max(160),
  email: emailSchema,
  phone: phoneSchema,
  notes: z.string().trim().max(1500).optional().default(""),
  consent: z.literal(true),
  website: z.string().max(200).optional().default(""),
  estimateLowMinor: z.string().regex(/^\d+$/).optional(),
  estimateHighMinor: z.string().regex(/^\d+$/).optional(),
}).strip();

// Public demo submissions are real staging test enquiries, never bookable offers.
// Do not reuse the price estimator schema: these are exploratory questions.
export const demoInquirySchema = z.object({
  kind: z.enum(["personalised", "package"]),
  destination: z.enum(["Kenya", "Zanzibar", "Help me choose"]),
  travelStyle: z.enum(["A slower pace", "Discovery and culture", "A little of both"]),
  travellers: z.enum(["1", "2", "3–5", "6 or more"]),
  name: z.string().trim().min(2).max(160),
  email: emailSchema,
  phone: phoneSchema,
  notes: z.string().trim().max(1500),
  consent: z.literal(true),
  website: z.string().max(200).optional().default(""),
}).strict();
