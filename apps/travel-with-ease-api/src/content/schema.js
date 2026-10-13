import { z } from "zod";

export const pageNames = ["home", "about", "services", "faqs", "testimonials", "contact"];
export const pageSchema = z.enum(pageNames);
const text = (max) => z.string().trim().max(max);
export const contentBodySchema = z.object({
  heading: text(120).min(1),
  body: text(6000),
  ctaLabel: text(60).default(""),
  ctaPath: z.enum(["/#plan", "/about", "/services", "/destinations"]).default("/#plan"),
  seoTitle: text(70).min(1),
  seoDescription: text(180).min(1),
  imageId: z.string().uuid().nullable().default(null),
  entries: z.array(z.object({ heading: text(160).min(1), text: text(2000).min(1), attribution: text(160).default("") }).strict()).max(30).default([]),
  contactEmail: z.union([z.literal(""), z.string().email().max(254)]).default(""),
  contactPhone: text(40).regex(/^[+0-9 ()-]*$/).default(""),
}).strict();
export const saveContentSchema = z.object({
  expectedVersion: z.number().int().min(0),
  body: contentBodySchema,
}).strict();
export const versionSchema = z.object({ expectedVersion: z.number().int().min(1) }).strict();

export class ContentError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
