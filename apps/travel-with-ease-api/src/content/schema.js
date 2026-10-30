import { z } from "zod";

export const pageNames = [
  "home",
  "about",
  "services",
  "how-it-works",
  "faqs",
  "testimonials",
  "contact",
  "journal",
  "travel-footprint",
  "privacy",
  "terms",
  "cookies",
];
export const pageSchema = z.enum(pageNames);
const text = (max) => z.string().trim().max(max);
// Countries represented by the reviewed Natural Earth public map. Zanzibar is TZ.
export const footprintCountryCodes =
  "FJ TZ EH CA US KZ UZ PG ID AR CL CD SO KE SD TD HT DO RU BS FK NO GL TF TL ZA LS MX UY BR BO PE CO PA CR NI HN SV GT BZ VE GY SR FR EC PR JM CU ZW BW NA SN ML MR BJ NE NG CM TG GH CI GN GW LR SL BF CF CG GA GQ ZM MW MZ SZ AO BI IL LB MG PS GM TN DZ JO AE QA KW IQ OM VU KH TH LA MM VN KP KR MN IN BD BT NP PK AF TJ KG TM IR SY AM SE BY UA PL AT HU MD RO LT LV EE DE BG GR TR AL HR CH LU BE NL PT ES IE NC SB NZ AU LK CN TW IT DK GB IS AZ GE PH MY BN SI FI SK CZ ER JP PY YE SA CY MA EG LY ET DJ UG RW BA MK RS ME XK TT SS".split(
    " ",
  );
const articleSchema = z
  .object({
    slug: text(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: text(120).min(1),
    excerpt: text(240).min(1),
    body: text(6000).min(1),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (value) =>
          !Number.isNaN(Date.parse(value)) &&
          new Date(value).toISOString().slice(0, 10) === value,
      ),
  })
  .strict();
export const contentBodySchema = z
  .object({
    heading: text(120).min(1),
    body: text(6000),
    ctaLabel: text(60).default(""),
    ctaPath: z
      .enum(["/#plan", "/about", "/services", "/destinations"])
      .default("/#plan"),
    seoTitle: text(70).min(1),
    seoDescription: text(180).min(1),
    imageId: z.string().uuid().nullable().default(null),
    entries: z
      .array(
        z
          .object({
            heading: text(160).min(1),
            text: text(2000).min(1),
            attribution: text(160).default(""),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    contactEmail: z
      .union([z.literal(""), z.string().email().max(254)])
      .default(""),
    contactPhone: text(40)
      .regex(/^[+0-9 ()-]*$/)
      .default(""),
    articles: z
      .array(articleSchema)
      .max(20)
      .default([])
      .refine(
        (items) =>
          new Set(items.map((item) => item.slug)).size === items.length,
        "Article URLs must be unique.",
      ),
    footprint: z
      .array(
        z
          .object({
            countryCode: z
              .string()
              .refine((value) => footprintCountryCodes.includes(value)),
            total: z.number().int().min(0).max(1_000_000),
            status: z.literal("verified"),
          })
          .strict(),
      )
      .max(180)
      .default([])
      .refine(
        (items) =>
          new Set(items.map((item) => item.countryCode)).size === items.length,
        "Choose each country once.",
      ),
  })
  .strict();
export function contentForPage(page, body) {
  const value = contentBodySchema.parse(body);
  if (
    (page !== "journal" && value.articles.length) ||
    (page !== "travel-footprint" && value.footprint.length)
  ) {
    throw new ContentError(
      400,
      "validation_error",
      "Use the journal or travel footprint section for those records.",
    );
  }
  return value;
}
export const saveContentSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    body: contentBodySchema,
  })
  .strict();
export const versionSchema = z
  .object({ expectedVersion: z.number().int().min(1) })
  .strict();

export class ContentError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
