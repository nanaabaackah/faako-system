import { z } from "zod";
import { emailSchema, phoneSchema, isoDateSchema } from "@faako/validation";

export const estimateSchema = z.object({
  destination: z.string().trim().min(2).max(120),
  travellers: z.coerce.number().int().min(1).max(30),
  nights: z.coerce.number().int().min(1).max(60),
  travelDate: isoDateSchema,
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
