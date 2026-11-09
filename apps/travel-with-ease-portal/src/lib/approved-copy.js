// Resolved public asset URLs are not database Media UUIDs. Selecting an R2
// image remains a separate explicit editor action.
export function approvedEditorCopy(source) {
  const fields = ["heading", "body", "ctaLabel", "ctaPath", "seoTitle", "seoDescription", "imageId", "entries", "contactEmail", "contactPhone", "articles", "tips", "packages", "footprint", "experienceCountries"];
  const clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !["image", "socialImage", "gallery"].includes(key)).map(([key, item]) => [key, clean(item)])) : value;
  return clean(Object.fromEntries(fields.filter(key => Object.hasOwn(source, key)).map(key => [key, structuredClone(source[key])])));
}
