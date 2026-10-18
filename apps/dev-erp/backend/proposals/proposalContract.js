import { calculateStructuredProposalPricing } from "../commercial/pricing.js";

export const STRUCTURED_PROPOSAL_SCHEMA_VERSION = 2;

const RAW_COMMON_CATALOGUE_ITEMS = [
  ["SERVICE", "Website Development", "Web & Digital"],
  ["SERVICE", "ERP Implementation", "Business Systems"],
  ["SERVICE", "Custom Software Development", "Software"],
  ["SERVICE", "CMS Setup", "Web & Digital"],
  ["SERVICE", "Search Engine Optimisation (SEO)", "Search & Discovery"],
  ["SERVICE", "Answer Engine Optimisation (AEO)", "Search & Discovery"],
  ["SERVICE", "Generative Engine Optimisation (GEO)", "Search & Discovery"],
  ["SERVICE", "Geographic Search Targeting", "Search & Discovery"],
  ["SERVICE", "Search Console & Analytics Setup", "Search & Discovery"],
  ["SERVICE", "Accessibility Audit & Remediation", "Accessibility"],
  ["SERVICE", "Agentic AI Readiness Assessment", "AI & Security"],
  ["SERVICE", "Workflow Automation", "Automation"],
  ["SERVICE", "API Development", "Software"],
  ["SERVICE", "Data Migration", "Data"],
  ["SERVICE", "Database Setup", "Data"],
  ["SERVICE", "Hosting & Deployment", "Infrastructure"],
  ["SERVICE", "Maintenance & Support", "Support"],
  ["SERVICE", "Training & Onboarding", "Enablement"],
  ["SERVICE", "Technical Consultation", "Consulting"],
  ["INTEGRATION", "Paystack", "Payments"],
  ["INTEGRATION", "MTN MoMo", "Payments"],
  ["INTEGRATION", "Hubtel", "Payments"],
  ["INTEGRATION", "Flutterwave", "Payments"],
  ["INTEGRATION", "WhatsApp Business", "Messaging"],
  ["INTEGRATION", "Resend", "Messaging"],
  ["INTEGRATION", "Google Workspace", "Productivity"],
  ["INTEGRATION", "Microsoft 365", "Productivity"],
  ["INTEGRATION", "Supabase", "Infrastructure"],
  ["INTEGRATION", "Cloudflare", "Infrastructure"],
  ["INTEGRATION", "Railway", "Infrastructure"],
  ["INTEGRATION", "Google Calendar", "Productivity"],
  ["INTEGRATION", "OpenAI", "AI"],
  ["INTEGRATION", "Cloudinary", "Media"],
  ["INTEGRATION", "Google Analytics", "Analytics"],
];

const BUILT_IN_CATALOGUE_METADATA = {
  "Website Development": {
    systemKey: "website-development",
    sourceUrl: "https://faako.com/pricing",
    tiers: [
      { name: "Website + Leads", priceModel: "FIXED", faakoSetupFee: 2500, providerCurrency: "GHS", displayPrice: "GHS 2,500 setup", billingFrequency: "NONE", includedFeatures: ["UI/UX design", "CMS setup", "Lead capture"], isDefault: true },
      { name: "Website + Dashboard", priceModel: "FIXED", faakoSetupFee: 8500, providerCurrency: "GHS", displayPrice: "GHS 8,500 setup", billingFrequency: "NONE", includedFeatures: ["UI/UX design", "CMS setup", "Operations dashboard"] },
      { name: "Complete System", priceModel: "FIXED", faakoSetupFee: 18000, providerCurrency: "GHS", displayPrice: "From GHS 18,000 setup", billingFrequency: "NONE", includedFeatures: ["UI/UX design", "CMS setup", "Integrated business system"] },
    ],
  },
  "CMS Setup": { systemKey: "cms-setup" },
  "Search Engine Optimisation (SEO)": {
    systemKey: "search-engine-optimisation",
    description: "Technical and on-page search foundations for approved public pages, including crawlability, indexability, metadata, canonical URLs, redirects, sitemaps and performance checks.",
    deliverables: ["Technical SEO audit", "Metadata and canonical configuration", "Robots and sitemap validation", "Search-ready release checks"],
  },
  "Answer Engine Optimisation (AEO)": {
    systemKey: "answer-engine-optimisation",
    description: "Answer-first content structure and supported structured data that help answer engines understand facts already visible on the website.",
    deliverables: ["Answer-first content structure", "Visible FAQ and breadcrumb alignment", "Supported structured-data implementation", "Visible-content and schema validation"],
  },
  "Generative Engine Optimisation (GEO)": {
    systemKey: "generative-engine-optimisation",
    description: "Clear entities, relationships, provenance and citation-suitable public content for generative discovery, without promising rankings or citations.",
    deliverables: ["Entity and relationship review", "Source and provenance improvements", "Citation-suitable content structure", "Generative-discovery output checks"],
  },
  "Geographic Search Targeting": {
    systemKey: "geographic-search-targeting",
    description: "Accurate market, language, currency and service-area signals based only on verified locations and coverage.",
    deliverables: ["Verified service-area configuration", "Locale and currency signals", "Geographic structured-data review", "Duplicate and doorway-page safeguards"],
  },
  "Search Console & Analytics Setup": {
    systemKey: "search-measurement-setup",
    description: "Search ownership verification, sitemap submission and consent-aware analytics configuration with an initial measurement baseline.",
    deliverables: ["Search Console ownership setup", "Sitemap submission", "Consent-aware analytics configuration", "Initial search and traffic baseline"],
  },
  "Accessibility Audit & Remediation": {
    systemKey: "accessibility-audit-remediation",
    description: "Accessibility review and remediation for keyboard use, screen readers, readable content, focus, contrast and reduced motion; maintained separately from AEO.",
    deliverables: ["Keyboard and focus review", "Screen-reader and semantic review", "Contrast and readable-content checks", "Prioritised remediation and regression checks"],
  },
  "Agentic AI Readiness Assessment": {
    systemKey: "agentic-ai-readiness-assessment",
    description: "Security and architecture assessment for future AI-assisted actions, covering authentication, permissions, validation, auditability, idempotency and human confirmation.",
    deliverables: ["Named-use-case assessment", "Threat model and data-boundary review", "Capability and permission design", "Safe implementation recommendations"],
  },
  Paystack: { systemKey: "paystack", sourceUrl: "https://paystack.com/gh/pricing" },
  "MTN MoMo": { systemKey: "mtn-momo", sourceUrl: "https://mtn.com.gh/momo/business/" },
  Hubtel: { systemKey: "hubtel", sourceUrl: "https://hubtel.com/" },
  Flutterwave: { systemKey: "flutterwave", sourceUrl: "https://flutterwave.com/gh/pricing" },
  "WhatsApp Business": { systemKey: "whatsapp-business", sourceUrl: "https://developers.facebook.com/docs/whatsapp/pricing" },
  Resend: { systemKey: "resend", sourceUrl: "https://resend.com/pricing" },
  "Google Workspace": { systemKey: "google-workspace", sourceUrl: "https://workspace.google.com/pricing.html" },
  "Microsoft 365": { systemKey: "microsoft-365", sourceUrl: "https://www.microsoft.com/en-us/microsoft-365/business/compare-all-microsoft-365-business-products" },
  Supabase: { systemKey: "supabase", sourceUrl: "https://supabase.com/pricing" },
  Cloudflare: { systemKey: "cloudflare", sourceUrl: "https://www.cloudflare.com/plans/" },
  Railway: { systemKey: "railway", sourceUrl: "https://railway.com/pricing" },
  "Google Calendar": { systemKey: "google-calendar", sourceUrl: "https://workspace.google.com/pricing.html" },
  OpenAI: { systemKey: "openai", sourceUrl: "https://openai.com/api/pricing/" },
  Cloudinary: { systemKey: "cloudinary", sourceUrl: "https://cloudinary.com/pricing" },
  "Google Analytics": { systemKey: "google-analytics", sourceUrl: "https://marketingplatform.google.com/about/analytics/" },
};
export const COMMON_CATALOGUE_ITEMS = RAW_COMMON_CATALOGUE_ITEMS.map(([kind, name, category]) => {
  const metadata = BUILT_IN_CATALOGUE_METADATA[name] || {};
  const sourceUrl = metadata.sourceUrl || null;
  return {
    kind,
    name,
    category,
    description: metadata.description || null,
    deliverables: metadata.deliverables || [],
    systemKey: metadata.systemKey || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    sourceUrl,
    tiers: (metadata.tiers || [{
      name: "Custom quote",
      priceModel: "CUSTOM_QUOTE",
      providerAmount: null,
      providerCurrency: null,
      displayPrice: "Custom quote",
      faakoSetupFee: 0,
      billingFrequency: "NONE",
      sourceUrl,
      includedFeatures: [],
      isDefault: true,
    }]).map((tier) => ({ ...tier, sourceUrl: tier.sourceUrl || sourceUrl, lastVerifiedAt: "2026-10-16" })),
  };
});

const ITEM_KINDS = new Set(["SERVICE", "INTEGRATION"]);
const BILLING_TYPES = new Set(["ONE_TIME", "RECURRING", "USAGE_BASED", "INCLUDED"]);
const BILLING_FREQUENCIES = new Set(["NONE", "MONTHLY", "QUARTERLY", "ANNUAL", "CUSTOM"]);
const COST_OWNERS = new Set(["FAAKO_BILLED", "CLIENT_DIRECT", "INCLUDED", "PASS_THROUGH"]);

const text = (value, maxLength = 1000) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized.slice(0, maxLength) : null;
};

const enumValue = (value, allowed, fallback) => {
  const normalized = String(value || "").trim().toUpperCase();
  return allowed.has(normalized) ? normalized : fallback;
};

const jsonArray = (value, maxItems = 100) =>
  Array.isArray(value)
    ? value
        .filter((entry) => entry !== undefined)
        .slice(0, maxItems)
        .map((entry) => (typeof entry === "string" ? entry.trim().slice(0, 1000) : entry))
    : [];

const cloneJson = (value, fallback = null) => {
  try {
    return value === undefined ? fallback : JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
};

export const normalizeCatalogueName = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ")
    .slice(0, 180);

export const normalizeStructuredProposal = (value, { fallbackTitle = "Proposal" } = {}) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "commercial must be an object." };
  }

  const rawItems = Array.isArray(value.items) ? value.items : [];
  if (!rawItems.length) return { error: "commercial.items must include at least one item." };

  const items = [];
  for (let index = 0; index < rawItems.length; index += 1) {
    const item = rawItems[index] || {};
    const name = text(item.name, 180);
    if (!name) return { error: `commercial.items[${index}].name is required.` };

    const kind = enumValue(item.kind, ITEM_KINDS, null);
    if (!kind) return { error: `commercial.items[${index}].kind must be SERVICE or INTEGRATION.` };
    if (item.billingType && !BILLING_TYPES.has(String(item.billingType).trim().toUpperCase())) {
      return { error: `commercial.items[${index}].billingType is invalid.` };
    }
    const billingType = enumValue(item.billingType, BILLING_TYPES, "ONE_TIME");
    if (
      item.billingFrequency
      && !BILLING_FREQUENCIES.has(String(item.billingFrequency).trim().toUpperCase())
    ) {
      return { error: `commercial.items[${index}].billingFrequency is invalid.` };
    }
    const billingFrequency = enumValue(
      item.billingFrequency,
      BILLING_FREQUENCIES,
      billingType === "RECURRING" ? "MONTHLY" : "NONE"
    );
    if (billingType === "RECURRING" && billingFrequency === "NONE") {
      return { error: `commercial.items[${index}] recurring items require a billingFrequency.` };
    }
    if (billingType === "RECURRING" && billingFrequency === "CUSTOM") {
      return { error: `commercial.items[${index}] custom recurring schedules are not supported yet.` };
    }
    if (item.costOwnership && !COST_OWNERS.has(String(item.costOwnership).trim().toUpperCase())) {
      return { error: `commercial.items[${index}].costOwnership is invalid.` };
    }
    const required = item.required !== false;
    const clientSelectable = required ? false : Boolean(item.clientSelectable);

    items.push({
      key: text(item.key, 100) || `item-${index + 1}`,
      systemKey: text(item.systemKey, 100),
      catalogueItemId: Number.isInteger(Number(item.catalogueItemId)) && Number(item.catalogueItemId) > 0
        ? Number(item.catalogueItemId)
        : null,
      kind,
      name,
      description: text(item.description, 2000),
      deliverables: jsonArray(item.deliverables, 100),
      quantity: item.quantity ?? 1,
      unitPrice: item.unitPrice ?? 0,
      discount: item.discount ?? 0,
      billingType,
      billingFrequency,
      required,
      clientSelectable,
      custom: item.custom === true || !item.catalogueItemId,
      selected: required ? true : item.selected !== false,
      costOwnership: enumValue(
        item.costOwnership,
        COST_OWNERS,
        billingType === "INCLUDED" ? "INCLUDED" : "FAAKO_BILLED"
      ),
      estimatedDelivery: text(item.estimatedDelivery, 240),
      internalNotes: text(item.internalNotes, 2000),
      clientNotes: text(item.clientNotes, 2000),
      dependencies: jsonArray(item.dependencies, 50),
      configuration: cloneJson(item.configuration, null),
      selectedTier: item.selectedTier && typeof item.selectedTier === "object" ? {
        id: Number.isInteger(Number(item.selectedTier.id)) ? Number(item.selectedTier.id) : null,
        name: text(item.selectedTier.name, 160),
        priceModel: text(item.selectedTier.priceModel, 40),
        providerAmount: item.selectedTier.providerAmount ?? null,
        providerCurrency: text(item.selectedTier.providerCurrency, 16),
        displayPrice: text(item.selectedTier.displayPrice, 240),
        faakoSetupFee: item.selectedTier.faakoSetupFee ?? item.unitPrice ?? 0,
        billingFrequency: text(item.selectedTier.billingFrequency, 40),
        sourceUrl: text(item.selectedTier.sourceUrl, 2000),
        lastVerifiedAt: text(item.selectedTier.lastVerifiedAt, 40),
        includedFeatures: jsonArray(item.selectedTier.includedFeatures, 100),
      } : null,
    });
  }

  const websiteItems = items.filter((item) =>
    item.systemKey === "website-development"
    || normalizeCatalogueName(item.name) === "website development"
  );
  if (websiteItems.length) {
    for (const website of websiteItems) {
      website.systemKey ||= "website-development";
      if (!website.deliverables.some((entry) => /ui\s*\/\s*ux/i.test(String(entry)))) {
        website.deliverables.push("UI/UX design included");
      }
    }
    const hasAutomaticCms = items.some((item) => item.configuration?.autoIncludedBy === "website-development");
    if (!hasAutomaticCms) {
      items.push({
        key: `auto-cms-${websiteItems[0].key}`,
        systemKey: "cms-setup",
        catalogueItemId: null,
        kind: "SERVICE",
        name: "CMS Setup",
        description: "Included automatically with Website Development.",
        deliverables: ["CMS configuration and editor access"],
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        billingType: "INCLUDED",
        billingFrequency: "NONE",
        required: true,
        clientSelectable: false,
        custom: false,
        selected: true,
        costOwnership: "INCLUDED",
        estimatedDelivery: null,
        internalNotes: null,
        clientNotes: null,
        dependencies: [],
        configuration: { autoIncludedBy: "website-development" },
        selectedTier: null,
      });
    }
  } else {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (items[index].configuration?.autoIncludedBy === "website-development") items.splice(index, 1);
    }
  }

  const pricing = calculateStructuredProposalPricing({
    items: items.filter((item) => item.required || item.selected),
    taxRate: value.taxRate ?? 0,
    discount: value.discount ?? 0,
    depositPercent: value.depositPercent ?? 0,
    fixedDepositAmount: String(value.depositType || "").toUpperCase() === "FIXED"
      ? value.fixedDepositAmount ?? 0
      : null,
    milestones: value.paymentMilestones,
  });
  if (pricing.error) return { error: pricing.error };

  const pricedByKey = new Map(pricing.items.map((item) => [item.key, item]));
  const normalizedItems = items.map((item) => {
    const priced = pricedByKey.get(item.key);
    return priced || { ...item, amount: 0 };
  });

  const projectId = Number(value.project?.id ?? value.projectId);
  const currency = String(value.currency || "GHS").trim().toUpperCase();
  if (!["CAD", "GHS"].includes(currency)) return { error: "commercial.currency is invalid." };
  const validUntil = text(value.validUntil, 40);
  const parsedValidUntil = validUntil ? new Date(`${validUntil}T00:00:00.000Z`) : null;
  if (
    validUntil
    && (
      !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)
      || Number.isNaN(parsedValidUntil.getTime())
      || parsedValidUntil.toISOString().slice(0, 10) !== validUntil
    )
  ) {
    return { error: "commercial.validUntil must use YYYY-MM-DD." };
  }
  return {
    commercial: {
      schemaVersion: STRUCTURED_PROPOSAL_SCHEMA_VERSION,
      customer: {
        reference: text(value.customer?.reference ?? value.customerReference, 160),
        name: text(value.customer?.name ?? value.customerName, 240),
        email: text(value.customer?.email ?? value.customerEmail, 320),
        address: text(value.customer?.address ?? value.customerAddress, 1000),
      },
      project: {
        id: Number.isInteger(projectId) && projectId > 0 ? projectId : null,
        reference: text(value.project?.reference ?? value.projectReference, 160),
        title: text(value.project?.title ?? value.projectTitle, 240),
        summary: text(value.project?.summary ?? value.summary, 4000),
      },
      title: text(value.title, 240) || fallbackTitle,
      internalOwnerUserId: Number.isInteger(Number(value.internalOwnerUserId))
        && Number(value.internalOwnerUserId) > 0
        ? Number(value.internalOwnerUserId)
        : null,
      currency,
      validUntil,
      scope: text(value.scope, 10000),
      exclusions: jsonArray(value.exclusions, 100),
      terms: cloneJson(value.terms, []),
      delivery: cloneJson(value.delivery, {}),
      aiGeneration: cloneJson(value.aiGeneration, {}),
      taxRate: pricing.totals.taxRate,
      discount: pricing.totals.discount,
      depositPercent: pricing.totals.depositPercent,
      depositType: pricing.totals.depositType,
      fixedDepositAmount: pricing.totals.depositType === "FIXED"
        ? pricing.totals.depositAmount
        : 0,
      paymentMilestones: jsonArray(value.paymentMilestones, 25),
      items: normalizedItems,
      totals: pricing.totals,
      billingSchedule: pricing.billingSchedule,
    },
  };
};

const parseLegacyAmount = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  const normalized = String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export const adaptLegacyProposal = (proposal) => {
  const content = proposal?.content && typeof proposal.content === "object" ? proposal.content : {};
  if (content.commercial?.schemaVersion === STRUCTURED_PROPOSAL_SCHEMA_VERSION) {
    const normalized = normalizeStructuredProposal(content.commercial, {
      fallbackTitle: proposal?.title || content.title || "Proposal",
    });
    return normalized.error
      ? { mode: "structured_invalid", error: normalized.error, commercial: content.commercial }
      : { mode: "structured", ...normalized };
  }

  const pricingRows = (Array.isArray(content.blocks) ? content.blocks : [])
    .filter((block) => block?.type === "pricing" && (block.required || block.enabled !== false))
    .flatMap((block) => (Array.isArray(block.pricingItems) ? block.pricingItems : []));
  const legacyItems = pricingRows.length
    ? pricingRows.map((row, index) => ({
        key: `legacy-${index + 1}`,
        kind: "SERVICE",
        name: text(row?.label, 180) || `Proposal line ${index + 1}`,
        description: text(row?.note, 2000),
        quantity: 1,
        unitPrice: parseLegacyAmount(row?.amount),
        billingType: "ONE_TIME",
        billingFrequency: "NONE",
        required: true,
        clientSelectable: false,
        custom: true,
        selected: true,
        costOwnership: "FAAKO_BILLED",
      }))
    : [{
        key: "legacy-1",
        kind: "SERVICE",
        name: proposal?.title || content.title || "Approved proposal",
        quantity: 1,
        unitPrice: 0,
        billingType: "ONE_TIME",
        required: true,
        clientSelectable: false,
        custom: true,
        selected: true,
        costOwnership: "FAAKO_BILLED",
      }];

  const normalized = normalizeStructuredProposal({
    title: proposal?.title || content.title,
    customer: { name: proposal?.clientName || content.clientName },
    currency: JSON.stringify(pricingRows).toUpperCase().includes("GHS") ? "GHS" : "CAD",
    items: legacyItems,
    scope: null,
    exclusions: [],
    terms: [],
  });
  return { mode: "legacy", ...normalized };
};

export const validateVersionTransition = (currentStatus, nextStatus) => {
  const allowed = {
    DRAFT: new Set(["PUBLISHED", "WITHDRAWN"]),
    PUBLISHED: new Set(["ACCEPTED", "DECLINED", "EXPIRED", "SUPERSEDED", "WITHDRAWN"]),
    ACCEPTED: new Set(),
    DECLINED: new Set(),
    EXPIRED: new Set(),
    SUPERSEDED: new Set(),
    WITHDRAWN: new Set(),
  };
  return Boolean(allowed[currentStatus]?.has(nextStatus));
};

export const validateClientSelections = ({ versionStatus, items, selections }) => {
  if (versionStatus !== "PUBLISHED") {
    return { error: "Client selections are only allowed for published proposal versions." };
  }
  if (!Array.isArray(selections)) return { error: "selections must be an array." };
  const itemsById = new Map((items || []).map((item) => [Number(item.id), item]));
  const selectedItemIds = new Set();
  const normalized = [];
  for (let index = 0; index < selections.length; index += 1) {
    const input = selections[index] || {};
    const item = itemsById.get(Number(input.itemId));
    if (!item) return { error: `selections[${index}] references an unknown item.` };
    if (selectedItemIds.has(item.id)) {
      return { error: `selections[${index}] duplicates an earlier item.` };
    }
    selectedItemIds.add(item.id);
    const selected = input.selected !== false;
    if (item.required && !selected) {
      return { error: `${item.name} is required and cannot be deselected.` };
    }
    if (!item.clientSelectable && selected !== true) {
      return { error: `${item.name} cannot be changed by the client.` };
    }
    let quantity = null;
    if (input.quantity !== undefined && input.quantity !== null && input.quantity !== "") {
      if (!item.clientSelectable) return { error: `${item.name} quantity cannot be changed by the client.` };
      quantity = Number(input.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { error: `selections[${index}].quantity must be greater than 0.` };
      }
      quantity = Math.round((quantity + Number.EPSILON) * 100) / 100;
    }
    normalized.push({
      itemId: item.id,
      selected: item.required ? true : selected,
      quantity,
      configuration: item.clientSelectable ? cloneJson(input.configuration, null) : null,
    });
  }
  return { selections: normalized };
};
