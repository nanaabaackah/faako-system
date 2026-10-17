export const PROPOSAL_STEPS = [
  "Client & Project",
  "Services",
  "Integrations",
  "Pricing & Billing",
  "Scope & Delivery",
  "Review & Publish",
];

export const createStructuredProposalDraft = () => ({
  schemaVersion: 2,
  title: "New service proposal",
  customer: { reference: "", name: "", email: "", address: "" },
  project: { id: null, reference: "", title: "", summary: "" },
  currency: "GHS",
  validUntil: "",
  scope: "",
  exclusions: [],
  terms: [],
  taxRate: 0,
  discount: 0,
  depositType: "PERCENTAGE",
  depositPercent: 50,
  fixedDepositAmount: 0,
  paymentMilestones: [],
  delivery: { estimatedDelivery: "" },
  aiGeneration: {},
  items: [],
});

const defaultTier = (item) => (item.tiers || []).find((tier) => tier.active !== false && tier.isDefault)
  || (item.tiers || []).find((tier) => tier.active !== false)
  || null;

export const catalogueItemToProposalItem = (item) => {
  const tier = defaultTier(item);
  return ({
  key: globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random()}`,
  catalogueItemId: item.id || null,
  systemKey: item.systemKey || null,
  kind: item.kind,
  name: item.name,
  description: item.description || "",
  deliverables: Array.isArray(item.deliverables) ? item.deliverables : [],
  quantity: 1,
  unitPrice: Number(tier?.faakoSetupFee ?? item.defaultUnitPrice ?? 0),
  discount: 0,
  billingType: item.defaultBillingType || "ONE_TIME",
  billingFrequency: tier?.billingFrequency || item.defaultBillingFrequency || "NONE",
  required: true,
  clientSelectable: false,
  custom: !item.id,
  selected: true,
  costOwnership: item.defaultCostOwnership || "FAAKO_BILLED",
  estimatedDelivery: "",
  clientNotes: "",
  internalNotes: "",
  dependencies: (item.dependencies || []).map((dependency) => dependency.id),
  configuration: {},
  selectedTier: tier ? { ...tier } : null,
  });
};

const normalizedName = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

export const applyProposalRules = (items) => {
  const next = items.map((item) => ({ ...item, deliverables: [...(item.deliverables || [])] }));
  const website = next.find((item) => item.systemKey === "website-development" || normalizedName(item.name) === "website development");
  if (!website) return next.filter((item) => item.configuration?.autoIncludedBy !== "website-development");
  website.systemKey ||= "website-development";
  if (!website.deliverables.some((entry) => /ui\s*\/\s*ux/i.test(String(entry)))) website.deliverables.push("UI/UX design included");
  const automaticCms = next.find((item) => item.configuration?.autoIncludedBy === "website-development");
  if (!automaticCms) next.push({
    key: `auto-cms-${website.key}`, catalogueItemId: null, systemKey: "cms-setup", kind: "SERVICE",
    name: "CMS Setup", description: "Included automatically with Website Development.",
    deliverables: ["CMS configuration and editor access"], quantity: 1, unitPrice: 0, discount: 0,
    billingType: "INCLUDED", billingFrequency: "NONE", required: true, clientSelectable: false,
    custom: false, selected: true, costOwnership: "INCLUDED", estimatedDelivery: "", clientNotes: "",
    internalNotes: "", dependencies: [], configuration: { autoIncludedBy: "website-development" }, selectedTier: null,
  });
  return next;
};

export const proposalSourceFingerprint = (commercial) => {
  const source = JSON.stringify({
    customer: commercial.customer, project: commercial.project,
    items: (commercial.items || []).map(({ key, name, description, estimatedDelivery, selectedTier, quantity, required }) => ({ key, name, description, estimatedDelivery, selectedTier: selectedTier?.name || null, quantity, required })),
  });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  return `fnv1a-${(hash >>> 0).toString(16)}`;
};

export const mergePackageItems = (currentItems, packageRecord) => {
  const existingIds = new Set(currentItems.map((item) => Number(item.catalogueItemId)).filter(Boolean));
  const additions = (packageRecord?.items || [])
    .filter((entry) => entry.catalogueItem && !existingIds.has(Number(entry.catalogueItem.id)))
    .map((entry) => ({
      ...catalogueItemToProposalItem(entry.catalogueItem),
      ...(entry.configuration && typeof entry.configuration === "object"
        ? entry.configuration
        : {}),
    }));
  return applyProposalRules([...currentItems, ...additions]);
};

export const formatProposalMoney = (value, currency = "GHS") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export const buildLegacyProposalPayload = (commercial, existing = null) => ({
  title: commercial.title,
  clientName: commercial.customer?.name || "",
  proposalType: existing?.proposalType || "erp",
  status: existing?.status || "draft",
  metadata: existing?.metadata || null,
  content: {
    ...(existing?.content || {}),
    title: commercial.title,
    clientName: commercial.customer?.name || "",
    commercial,
  },
});

export const itemMatches = (item, search, category) => {
  const query = String(search || "").trim().toLowerCase();
  const categoryMatch = !category || category === "all" || item.category === category;
  const searchMatch = !query || `${item.name} ${item.description || ""} ${item.category || ""}`
    .toLowerCase()
    .includes(query);
  return categoryMatch && searchMatch;
};
