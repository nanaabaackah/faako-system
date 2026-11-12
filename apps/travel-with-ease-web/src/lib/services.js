// Public service URLs are derived only from published service headings, never drafts.
export function serviceSlug(heading) {
  return heading
    .split(" · ")[0]
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function publishedServices(page) {
  const slugs = new Set();
  return (page?.entries || []).map((entry, index) => {
    const slug = serviceSlug(entry.heading);
    if (!slug || slugs.has(slug))
      throw new Error("Published service headings require unique URL names.");
    slugs.add(slug);
    const [title, ...fees] = entry.heading.split(" · ");
    return { ...entry, slug, title, fee: fees.join(" · "), index };
  });
}
