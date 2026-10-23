// Shared by Studio validation and the build boundary. Plain text is intentional: no CMS HTML.
export const cmsTypes = ["siteSettings", "homePage", "programme", "event", "newsArticle", "resource", "teamMember", "impactStat", "partner"];
export const validSlug = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 96;
export const safeLink = value => {
  if (typeof value !== "string") return false;
  if (/^\/(?!\/)[a-z0-9/?=#&_%.-]*$/i.test(value) && !value.includes("\\")) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
};
const meaningful = (value, max = 20000) => typeof value === "string" && !!value.trim() && value.length <= max;
export function contentIssues(doc) {
  const issues = [];
  const require = (key, max) => { if (!meaningful(doc[key], max)) issues.push(`Provide ${key} within its length limit.`); };
  if (!cmsTypes.includes(doc._type)) return ["Unknown document type."];
  const titled = ["programme", "event", "newsArticle", "resource"];
  if (titled.includes(doc._type)) {
    require("title", 120); require("summary", 320);
    if (!validSlug(doc.slug?.current ?? doc.slug)) issues.push("Use a lowercase, hyphenated, unique slug.");
    if (!meaningful(doc.seo?.description, 160) || doc.seo.description.length < 50) issues.push("SEO description must be 50–160 characters.");
  }
  const image = doc.image || doc.logo;
  for (const [key, max] of [["socialTitle",120],["socialDescription",320]]) {
    if (doc.seo?.[key] != null && !meaningful(doc.seo[key], max)) issues.push(`Provide ${key} within its length limit.`);
  }
  const share = doc.seo?.socialImage;
  if (share) {
    if (!meaningful(share.alt, 300) || !(share.asset?._ref || share.url)) issues.push("Social image requires an asset and descriptive alt text.");
    if (share.url) {
      try {
        const url = new URL(share.url);
        if (url.protocol !== "https:" || url.hostname !== "cdn.sanity.io" || ![share.width,share.height].every(n => Number.isInteger(n) && n > 0)) issues.push("Social image requires a Sanity asset with dimensions.");
      } catch { issues.push("Invalid social image URL."); }
    }
  }
  if (["programme", "event", "newsArticle", "teamMember", "partner"].includes(doc._type) && !image) issues.push("An approved image is required.");
  if (image && (!meaningful(image.alt, 300) || !(image.asset?._ref || image.url))) issues.push("Image asset and descriptive alt text are required.");
  for (const key of ["link", "registrationUrl", "onlineUrl", "actionHref"]) if (doc[key] && !safeLink(doc[key])) issues.push(`${key} must be a safe public URL.`);
  if (doc._type === "siteSettings") { require("organisationName", 120); require("tagline", 120); require("summary", 1000); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.email || "")) issues.push("A public contact email is required."); for (const social of doc.socials || []) if (!safeLink(social.href) || !meaningful(social.label, 50)) issues.push("Provide a valid public social link and label."); }
  if (doc._type === "homePage") {
    require("heroTitle", 120); require("heroSubtitle", 320); require("introduction", 2000);
    for (const cta of doc.actions || []) if (!safeLink(cta.href) || !meaningful(cta.label, 60)) issues.push("CTA label and safe destination are required.");
  }
  if (doc._type === "programme") { require("body"); require("owner", 160); require("audience", 600); require("format", 200); require("availability", 500); require("category", 120); if (doc.safeguardingState !== "approved") issues.push("Safeguarding approval is required before publication."); }
  if (doc._type === "event") {
    if (!["in-person", "online"].includes(doc.format)) issues.push("Choose the event format.");
    if (!["not-open", "open", "closed", "not-required"].includes(doc.registrationState)) issues.push("Choose the registration state.");
    require("description"); require("owner", 160); require("accessibility", 1200);
    if (!Number.isFinite(Date.parse(doc.start)) || !Number.isFinite(Date.parse(doc.end)) || Date.parse(doc.end) <= Date.parse(doc.start)) issues.push("Event end must follow a valid start.");
    try { new Intl.DateTimeFormat("en", { timeZone: doc.timezone }).format(); } catch { issues.push("Use an IANA timezone."); }
    if (!doc.timezone) issues.push("Timezone is required.");
    if (doc.format === "online" ? !doc.onlineUrl : !doc.venue) issues.push("Provide approved public venue or joining information.");
    if (doc.registrationState === "open" && !doc.registrationUrl) issues.push("Open registration requires a URL.");
    if (doc.capacity != null && (!Number.isSafeInteger(doc.capacity) || doc.capacity <= 0 || doc.capacityApproved !== true)) issues.push("Public capacity needs a positive whole number and approval.");
  }
  if (["newsArticle", "resource"].includes(doc._type)) { require("body"); require("author", 160); if (!Number.isFinite(Date.parse(doc.publishedAt))) issues.push("Publication date is required."); }
  if (doc._type === "resource") {
    require("owner", 160); require("reviewer", 160);
    if (doc.reviewState !== "approved" || !Number.isFinite(Date.parse(doc.lastReviewed))) issues.push("Approved review and review date are required.");
    if (!Array.isArray(doc.sources) || !doc.sources.length || doc.sources.some(source => !safeLink(source.url) || !meaningful(source.title, 200))) issues.push("Provide named, linked sources.");
    if (doc.urgentSupportRelevant && !meaningful(doc.urgentSupportNotice, 2000)) issues.push("An approved urgent-support notice is required.");
  }
  if (doc._type === "teamMember") { require("name", 120); require("role", 160); require("biography", 5000); if (doc.consentStatus !== "approved") issues.push("Publication consent is required."); if (doc.publicLinks?.length && !doc.publicLinksApproved) issues.push("Public contact links require approval."); for (const link of doc.publicLinks || []) if (!safeLink(link.href)) issues.push("Invalid public team link."); }
  if (doc._type === "impactStat") { require("value", 60); require("label", 180); require("period", 180); require("source", 2000); require("owner", 160); if (doc.verificationStatus !== "verified") issues.push("Only verified impact can be published."); }
  if (doc._type === "partner") require("name", 120);
  return issues;
}

export function validateCmsDocuments(documents) {
  if (!Array.isArray(documents)) throw new Error("Invalid CMS response");
  const used = new Set();
  return documents.filter(doc => doc && !/^(drafts|versions)\./.test(doc._id || "") && doc.publishState === "published").map(doc => {
    const issues = contentIssues(doc);
    const key = ["siteSettings", "homePage"].includes(doc._type) ? doc._type : `${doc._type}/${doc.slug?.current || doc.slug || doc._id}`;
    if (used.has(key)) issues.push("Duplicate slug or singleton.");
    used.add(key);
    if (issues.length) throw new Error(`CMS publication blocked (${doc._type}): ${issues.join(" ")}`);
    const image = doc.image || doc.logo;
    if (image) {
      const url = new URL(image.url);
      if (url.protocol !== "https:" || url.hostname !== "cdn.sanity.io" || ![image.width, image.height].every(n => Number.isInteger(n) && n > 0)) throw new Error("CMS image must be a valid Sanity asset with dimensions");
    }
    return doc.slug && typeof doc.slug === "string" ? {...doc, slug: {current: doc.slug}} : doc;
  });
}
