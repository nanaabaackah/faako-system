const text = (value) => String(value ?? "").trim();

export const normalizeDiscoveryPath = (value = "/") => {
  const candidate = text(value) || "/";
  let pathname = candidate.split(/[?#]/, 1)[0] || "/";

  try {
    if (/^https?:\/\//i.test(candidate)) pathname = new URL(candidate).pathname;
  } catch {
    pathname = "/";
  }

  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  pathname = pathname.replace(/\/{2,}/g, "/");
  return pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
};

export const canonicalUrl = (path, origin) => {
  const base = new URL(origin);
  base.pathname = "/";
  base.search = "";
  base.hash = "";
  return new URL(normalizeDiscoveryPath(path), base).toString();
};

export const absoluteDiscoveryUrl = (value, origin) => {
  const candidate = text(value);
  if (!candidate) return canonicalUrl("/", origin);
  return new URL(candidate, canonicalUrl("/", origin)).toString();
};

export const serializeJsonLd = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export const buildBreadcrumbList = (items, origin) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: text(item.name),
    item: canonicalUrl(item.path, origin),
  })),
});

export const buildFaqPage = (items) => ({
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: text(item.question),
    acceptedAnswer: {
      "@type": "Answer",
      text: text(item.answer),
    },
  })),
});

export const buildRobotsText = ({
  indexable = false,
  sitemapUrl,
  disallow = [],
} = {}) => {
  const lines = ["User-agent: *"];

  if (!indexable) {
    lines.push("Disallow: /");
    return `${lines.join("\n")}\n`;
  }

  lines.push("Allow: /");
  for (const path of disallow) {
    const normalized = normalizeDiscoveryPath(path);
    if (normalized !== "/") lines.push(`Disallow: ${normalized}`);
  }
  if (text(sitemapUrl)) lines.push("", `Sitemap: ${text(sitemapUrl)}`);
  return `${lines.join("\n")}\n`;
};

export const validateDiscoveryPage = (page = {}) => {
  const errors = [];
  const title = text(page.title);
  const description = text(page.description);

  if (!title) errors.push("title is required");
  if (!description) errors.push("description is required");

  try {
    const canonical = new URL(page.canonical);
    if (!/^https?:$/.test(canonical.protocol)) errors.push("canonical must use HTTP or HTTPS");
    if (canonical.search || canonical.hash) errors.push("canonical must not include a query or fragment");
  } catch {
    errors.push("canonical must be an absolute URL");
  }

  const h1Count = Number(page.h1Count);
  if (!Number.isInteger(h1Count) || h1Count !== 1) errors.push("page must contain exactly one H1");
  if (page.indexable && page.status !== 200) errors.push("indexable page must return status 200");
  if (page.indexable && page.noIndex) errors.push("indexable page must not be noindex");

  return { valid: errors.length === 0, errors };
};
