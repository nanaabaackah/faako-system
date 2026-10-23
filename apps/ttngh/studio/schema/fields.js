export const text = (name, max = 200, required = false) => ({ name, type: max > 400 ? "text" : "string", validation: Rule => required ? Rule.required().max(max) : Rule.max(max) });
export const choice = (name, values) => ({ name, type: "string", options: { list: values }, validation: Rule => Rule.required() });
export const refs = (name, types) => ({ name, type: "array", of: [{ type: "reference", to: types.map(type => ({ type })) }] });
export const ref = (name, type) => ({ name, type: "reference", to: [{ type }] });
export const image = (name = "image") => ({ name, type: "image", options: { hotspot: true }, fields: [text("alt", 300, true)] });
export const seo = { name: "seo", type: "object", fields: [text("title", 70), { ...text("description", 160, true), validation: Rule => Rule.required().min(50).max(160) },
  { ...text("socialTitle", 120), description: "Optional sharing title. Defaults to the page SEO title/content." },
  { ...text("socialDescription", 320), description: "Optional sharing description. Defaults to the page SEO description/content." },
  { ...image("socialImage"), description: "Optional approved share image, ideally 1200 × 630 px. Otherwise the page image or site default is used. Include descriptive alt text." },
] };
export const slug = { name: "slug", type: "slug", options: { source: "title", maxLength: 96 }, validation: Rule => Rule.required().custom(value => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.current) || "Use lowercase words separated by hyphens.") };
export const links = name => ({ name, type: "array", of: [{ type: "object", fields: [text("label", 60, true), text("href", 2048, true)] }] });
