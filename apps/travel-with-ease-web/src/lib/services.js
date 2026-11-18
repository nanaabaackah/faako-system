import { serviceSlug } from "../../../travel-with-ease-api/src/content/catalogue-constants.js";
export { serviceSlug };

export function publishedServices(page) {
  const slugs = new Set();
  return (page?.entries || []).map((entry, index) => {
    const slug = entry.serviceSlug || serviceSlug(entry.heading);
    if (!slug || slugs.has(slug))
      throw new Error("Published service headings require unique URL names.");
    slugs.add(slug);
    const [title, ...fees] = entry.heading.split(" · ");
    return { ...entry, slug, title, fee: fees.join(" · "), index };
  });
}
