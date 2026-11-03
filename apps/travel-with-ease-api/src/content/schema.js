import { z } from "zod";
import { packageOccasions } from "./catalogue-constants.js";

export const pageNames = [
  "home",
  "about",
  "services",
  "how-it-works",
  "faqs",
  "testimonials",
  "contact",
  "journal",
  "packages",
  "travel-tips",
  "travel-footprint",
  "privacy",
  "terms",
  "cookies",
];
export const pageSchema = z.enum(pageNames);
const text = (max) => z.string().trim().max(max);
const slug = text(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const packageSchema = z
  .object({
    id: z.string().uuid(),
    slug,
    title: text(120).min(1),
    destination: text(100).min(1),
    category: text(60).default(""),
    tagline: text(200).default(""),
    occasions: z.array(z.enum(packageOccasions.map(item => item.value))).max(5).default([]).refine(items => new Set(items).size === items.length, "Choose each occasion once."),
    groupFriendly: z.boolean().default(false),
    nights: z.number().int().min(0).max(100).nullable().default(null),
    days: z.number().int().min(1).max(101).nullable().default(null),
    pricingStatus: z.enum(["indicative", "coming_soon"]).default("coming_soon"),
    referenceMonth: z.union([z.literal(""), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)]).default(""),
    priceDisclaimer: text(2000).default(""),
    tiers: z.array(z.object({
      id: slug, label: text(80).min(1), description: text(500).default(""),
      amountMinor: z.number().int().min(1).max(100_000_000_000).nullable().default(null),
      currency: z.literal("GHS").default("GHS"),
    }).strict()).max(8).default([]).refine(items => new Set(items.map(item => item.id)).size === items.length, "Tier IDs must be unique."),
    duration: text(60).default(""),
    dates: text(160).default(""),
    overview: text(6000).min(1),
    priceFrom: text(120).default(""),
    priceDisclosure: text(500).default(""),
    availability: z
      .enum(["enquiry", "available", "sold_out", "closed"])
      .default("enquiry"),
    imageId: z.string().uuid().nullable().default(null),
    galleryImageIds: z.array(z.string().uuid()).max(12).default([]),
    highlights: z.array(text(300).min(1)).max(20).default([]),
    inclusions: z.array(text(300).min(1)).max(20).default([]),
    exclusions: z.array(text(300).min(1)).max(20).default([]),
    transport: text(2000).default(""),
    accommodation: text(2000).default(""),
    important: text(2000).default(""),
    itinerary: z
      .array(
        z
          .object({
            day: z.number().int().min(1).max(100),
            title: text(120).min(1),
            text: text(2000).min(1),
          })
          .strict(),
      )
      .max(40)
      .default([])
      .refine(
        (items) => new Set(items.map((item) => item.day)).size === items.length,
        "Itinerary days must be unique.",
      ),
    relatedArticles: z.array(slug).max(8).default([]),
    relatedPackageSlugs: z.array(slug).max(8).default([]),
  })
  .strict()
  .refine(item => item.pricingStatus === "indicative"
    ? item.tiers.length > 0 && item.tiers.every(tier => tier.amountMinor !== null) && Boolean(item.referenceMonth) && Boolean(item.priceDisclaimer)
    : item.tiers.every(tier => tier.amountMinor === null),
  "Indicative prices require tiers, a reference month and the approved disclaimer; coming-soon packages cannot carry prices.");
export const tipCategories = [
  "Before You Go",
  "Packing Smart",
  "Airport Guides",
  "Travel Documents",
  "Destination Preparation",
  "Safety and Practical Advice",
];
const tipSchema = z
  .object({
    slug: text(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: text(120).min(1),
    excerpt: text(240).min(1),
    body: text(6000).min(1),
    category: z.enum(tipCategories),
    featured: z.boolean().default(false),
    order: z.number().int().min(0).max(999).default(0),
    imageId: z.string().uuid().nullable().default(null),
    relatedArticle: z
      .union([z.literal(""), text(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)])
      .default(""),
  })
  .strict();
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
    category: text(80).default("Travel stories"),
    author: text(120).default(""),
    imageId: z.string().uuid().nullable().default(null),
    galleryImageIds: z.array(z.string().uuid()).max(12).default([]),
    relatedPackageSlugs: z.array(slug).max(8).default([]),
  })
  .strict();
export const contentBodySchema = z
  .object({
    heading: text(120).min(1),
    body: text(6000),
    ctaLabel: text(60).default(""),
    ctaPath: z
      .enum(["/#plan", "/about", "/services", "/destinations", "/packages", "/journal", "/travel-tips", "/contact", "/how-it-works", "/travel-footprint"])
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
    tips: z
      .array(tipSchema)
      .max(30)
      .default([])
      .refine(
        (items) =>
          new Set(items.map((item) => item.slug)).size === items.length,
        "Tip URLs must be unique.",
      ),
    packages: z
      .array(packageSchema)
      .max(30)
      .default([])
      .refine(
        (items) =>
          new Set(items.map((item) => item.slug)).size === items.length &&
          new Set(items.map((item) => item.id)).size === items.length,
        "Package IDs and URLs must be unique.",
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
    experienceCountries: z.array(z.object({
      countryCode: z.enum([...footprintCountryCodes, "MC", "MT", "SC", "MU"]),
      source: z.enum(["founder", "business"]),
      visitCount: z.number().int().min(1).max(1_000_000).nullable().default(null),
      countQualifier: z.enum(["exact", "approximate", "at_least", "unspecified"]).default("unspecified"),
    }).strict().refine(row => row.visitCount === null
      ? row.countQualifier === "unspecified" : row.countQualifier !== "unspecified",
    "Specify whether the supplied visit count is exact, approximate or a lower bound."))
      .max(180).default([])
      .refine(rows => new Set(rows.map(row => row.countryCode)).size === rows.length,
        "Travel experience countries must be unique."),
  })
  .strict();
export function contentForPage(page, body) {
  const value = contentBodySchema.parse(body);
  if (
    (page !== "journal" && value.articles.length) ||
    (page !== "travel-tips" && value.tips.length) ||
    (page !== "packages" && value.packages.length) ||
    (page !== "travel-footprint" && (value.footprint.length || value.experienceCountries.length))
  ) {
    throw new ContentError(
      400,
      "validation_error",
      "Use the packages, journal, travel tips or travel footprint section for those records.",
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

export function contentMediaIds(body) {
  return [
    ...new Set(
      [
        body.imageId,
        ...body.tips.map((tip) => tip.imageId),
        ...[...body.packages, ...body.articles].flatMap((item) => [
          item.imageId,
          ...item.galleryImageIds,
        ]),
      ].filter(Boolean),
    ),
  ];
}
