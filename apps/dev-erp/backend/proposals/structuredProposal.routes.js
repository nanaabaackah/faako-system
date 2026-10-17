import crypto from "node:crypto";

import { asyncHandler } from "../utils/asyncHandler.js";
import { buildInvoicePaymentSummary } from "../invoices/paymentSummary.js";
import {
  COMMON_CATALOGUE_ITEMS,
  adaptLegacyProposal,
  normalizeCatalogueName,
  normalizeStructuredProposal,
  validateClientSelections,
  validateVersionTransition,
} from "./proposalContract.js";
import { loadProposalClientOptions } from "./proposalClientOptions.js";
import { createProposalAiHandler } from "./proposalAi.js";

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const numberValue = (value) =>
  value === null || value === undefined
    ? null
    : typeof value?.toNumber === "function"
      ? value.toNumber()
      : Number(value);

const dateValue = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateKey = (value) => value?.toISOString?.().slice(0, 10) ?? null;

const addBillingInterval = (date, frequency) => {
  const next = new Date(date);
  if (frequency === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1);
  if (frequency === "QUARTERLY") next.setUTCMonth(next.getUTCMonth() + 3);
  if (frequency === "ANNUAL") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
};

const serializeBillingInvoice = (invoice) => {
  const payment = buildInvoicePaymentSummary({
    total: numberValue(invoice.total),
    paidAmount: numberValue(invoice.paidAmount),
  });
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    paymentStatus: payment.paymentStatus,
    currency: invoice.currency,
    total: payment.total,
    paidAmount: payment.paidAmount,
    balanceDue: payment.balanceDue,
    issueDate: dateKey(invoice.issueDate),
    dueDate: dateKey(invoice.dueDate),
    proposalVersionId: invoice.proposalVersionId,
    billingScheduleItemId: invoice.billingScheduleItemId,
  };
};

const BILLING_TYPES = ["ONE_TIME", "RECURRING", "USAGE_BASED", "INCLUDED"];
const BILLING_FREQUENCIES = ["NONE", "MONTHLY", "QUARTERLY", "ANNUAL", "CUSTOM"];
const COST_OWNERS = ["FAAKO_BILLED", "CLIENT_DIRECT", "INCLUDED", "PASS_THROUGH"];
const TIER_PRICE_MODELS = ["FIXED", "PERCENTAGE", "USAGE", "CUSTOM_QUOTE"];
const VERSION_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "SUPERSEDED",
  "WITHDRAWN",
];
const LIFECYCLE_FILTER_STATUSES = [...VERSION_STATUSES, "SENT", "VIEWED", "CHANGES_REQUESTED"];
const REVISION_STATUSES = ["RESOLVED", "REJECTED"];
const ACCEPTANCE_TERMS_VERSION = "dev-erp-commercial-terms-v1";
const PUBLIC_READABLE_VERSION_STATUSES = new Set(["PUBLISHED", "ACCEPTED"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const enumValue = (value, fallback, allowed) => {
  const normalized = String(value || fallback).trim().toUpperCase();
  return allowed.includes(normalized) ? normalized : null;
};

const safeUrl = (value) => {
  const normalized = String(value || "").trim().slice(0, 2000);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch { return null; }
};
const systemKeyValue = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || null;
const proposalSendFingerprint = ({ versionId, recipient, personalMessage, ttlHours }) => crypto
  .createHash("sha256")
  .update(JSON.stringify({ versionId, recipient, personalMessage, ttlHours }))
  .digest("hex");
const safeDeliveryFailureCategory = (error) => {
  const status = Number(error?.statusCode || 0);
  if (status === 401 || status === 403) return "PROVIDER_CONFIGURATION";
  if (status >= 400 && status < 500) return "PROVIDER_REJECTED";
  return "DELIVERY_FAILED";
};

const normalizeTiers = (value, { defaultSourceUrl = null } = {}) => {
  if (!Array.isArray(value)) return null;
  if (value.length > 30) return { error: "tiers cannot contain more than 30 entries." };
  const tiers = [];
  const names = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index] || {};
    const name = String(raw.name || "").trim().slice(0, 160);
    const normalizedName = normalizeCatalogueName(name);
    if (!name || names.has(normalizedName)) return { error: "Tier names are required and must be unique." };
    names.add(normalizedName);
    const priceModel = enumValue(raw.priceModel, "FIXED", TIER_PRICE_MODELS);
    const billingFrequency = enumValue(raw.billingFrequency, "NONE", BILLING_FREQUENCIES);
    const providerAmount = raw.providerAmount === null || raw.providerAmount === "" || raw.providerAmount === undefined ? null : Number(raw.providerAmount);
    const faakoSetupFee = Number(raw.faakoSetupFee || 0);
    if (!priceModel || !billingFrequency || (providerAmount !== null && (!Number.isFinite(providerAmount) || providerAmount < 0)) || !Number.isFinite(faakoSetupFee) || faakoSetupFee < 0) {
      return { error: `Tier ${name} has invalid pricing values.` };
    }
    if (raw.sourceUrl && !safeUrl(raw.sourceUrl)) return { error: `Tier ${name} sourceUrl must be an HTTP or HTTPS URL.` };
    tiers.push({
      name, normalizedName, priceModel, providerAmount,
      providerCurrency: String(raw.providerCurrency || "").trim().toUpperCase().slice(0, 16) || null,
      displayPrice: String(raw.displayPrice || "").trim().slice(0, 240) || null,
      faakoSetupFee, billingFrequency,
      sourceUrl: safeUrl(raw.sourceUrl) || defaultSourceUrl,
      lastVerifiedAt: dateValue(raw.lastVerifiedAt),
      includedFeatures: Array.isArray(raw.includedFeatures) ? raw.includedFeatures.slice(0, 100).map((entry) => String(entry).trim().slice(0, 500)).filter(Boolean) : [],
      isDefault: raw.isDefault === true,
      active: raw.active !== false,
      sortOrder: index,
    });
  }
  if (tiers.filter((tier) => tier.isDefault && tier.active).length > 1) return { error: "Only one active tier can be the default." };
  if (tiers.length && !tiers.some((tier) => tier.isDefault && tier.active)) {
    const firstActive = tiers.find((tier) => tier.active);
    if (firstActive) firstActive.isDefault = true;
  }
  return { tiers };
};

const serializeTier = (tier) => ({
  id: tier.id, name: tier.name, priceModel: tier.priceModel,
  providerAmount: numberValue(tier.providerAmount), providerCurrency: tier.providerCurrency,
  displayPrice: tier.displayPrice, faakoSetupFee: numberValue(tier.faakoSetupFee),
  billingFrequency: tier.billingFrequency, sourceUrl: tier.sourceUrl,
  lastVerifiedAt: dateKey(tier.lastVerifiedAt), includedFeatures: tier.includedFeatures ?? [],
  isDefault: tier.isDefault, active: tier.active, sortOrder: tier.sortOrder,
  needsReview: Boolean(tier.lastVerifiedAt && Date.now() - tier.lastVerifiedAt.getTime() > 90 * 86400000),
});

const serializeCatalogueItem = (item) => ({
  id: item.id,
  organizationId: item.organizationId,
  kind: item.kind,
  name: item.name,
  systemKey: item.systemKey ?? null,
  category: item.category ?? null,
  description: item.description ?? null,
  deliverables: item.deliverables ?? [],
  defaultUnitPrice: numberValue(item.defaultUnitPrice),
  defaultBillingType: item.defaultBillingType,
  defaultBillingFrequency: item.defaultBillingFrequency,
  defaultCostOwnership: item.defaultCostOwnership,
  sourceUrl: item.sourceUrl ?? null,
  tiers: (item.tiers || []).map(serializeTier),
  active: item.active,
  dependencies: (item.dependencies || []).map((entry) => ({
    id: entry.dependsOnItem?.id ?? entry.dependsOnItemId,
    name: entry.dependsOnItem?.name ?? null,
    kind: entry.dependsOnItem?.kind ?? null,
  })),
  createdAt: item.createdAt?.toISOString?.() ?? null,
  updatedAt: item.updatedAt?.toISOString?.() ?? null,
});

const serializeVersionItem = (item, { publicView = false } = {}) => ({
  id: item.id,
  ...(publicView ? {} : { catalogueItemId: item.catalogueItemId ?? null }),
  kind: item.kind,
  name: item.name,
  description: item.description ?? null,
  deliverables: item.deliverables ?? [],
  quantity: numberValue(item.quantity),
  unitPrice: numberValue(item.unitPrice),
  discount: numberValue(item.discount),
  amount: numberValue(item.amount),
  billingType: item.billingType,
  billingFrequency: item.billingFrequency,
  required: item.required,
  clientSelectable: item.clientSelectable,
  selectedByDefault: item.selectedByDefault,
  custom: item.custom,
  costOwnership: item.costOwnership,
  estimatedDelivery: item.estimatedDelivery ?? null,
  ...(publicView ? {} : { internalNotes: item.internalNotes ?? null }),
  clientNotes: item.clientNotes ?? null,
  dependencies: item.dependencies ?? [],
  configuration: item.configuration ?? null,
  selectedTier: item.selectedTierName ? {
    name: item.selectedTierName,
    sourceUrl: item.pricingSourceUrl ?? null,
    lastVerifiedAt: dateKey(item.pricingVerifiedAt),
    providerCharge: item.providerCharge ?? null,
  } : null,
  sortOrder: item.sortOrder,
});

const lifecycleStatus = (version) => {
  if (version.status !== "PUBLISHED") return version.status;
  if ((version.accessLinks || []).some((link) => link.lastAccessedAt && !link.revokedAt)) return "VIEWED";
  if ((version.accessLinks || []).some((link) => !link.revokedAt)) return "SENT";
  return "PUBLISHED";
};

const serializeVersion = (version, { publicView = false } = {}) => ({
  id: version.id,
  proposalId: version.proposalId,
  versionNumber: version.versionNumber,
  status: version.status,
  ...(!publicView ? { lifecycleStatus: lifecycleStatus(version) } : {}),
  schemaVersion: version.schemaVersion,
  title: version.title,
  summary: version.summary ?? null,
  currency: version.currency,
  customer: {
    reference: version.customerReference ?? null,
    name: version.customerName ?? null,
    email: version.customerEmail ?? null,
    address: version.customerAddress ?? null,
  },
  project: {
    reference: version.projectReference ?? null,
    title: version.projectTitle ?? null,
  },
  validUntil: version.validUntil?.toISOString?.().slice(0, 10) ?? null,
  scope: version.scope ?? null,
  exclusions: version.exclusions ?? [],
  terms: version.terms ?? [],
  totals: {
    subtotal: numberValue(version.subtotal),
    taxRate: numberValue(version.taxRate),
    taxAmount: numberValue(version.taxAmount),
    discount: numberValue(version.discount),
    total: numberValue(version.total),
    oneTimeTotal: numberValue(version.oneTimeTotal),
    recurringMonthlyTotal: numberValue(version.recurringMonthlyTotal),
    recurringAnnualTotal: numberValue(version.recurringAnnualTotal),
    depositPercent: numberValue(version.depositPercent),
    depositAmount: numberValue(version.depositAmount),
  },
  items: (version.items || []).map((item) => serializeVersionItem(item, { publicView })),
  billingSchedule: (version.billingSchedule || []).map((entry) => ({
    id: entry.id,
    type: entry.type,
    label: entry.label,
    percentage: numberValue(entry.percentage),
    amount: numberValue(entry.amount),
    dueRule: entry.dueRule ?? null,
    billingFrequency: entry.billingFrequency,
    status: entry.status ?? "PENDING",
    generationRule: entry.generationRule ?? "MANUAL",
    startDate: entry.startDate?.toISOString?.().slice(0, 10) ?? null,
    nextBillingDate: entry.nextBillingDate?.toISOString?.().slice(0, 10) ?? null,
    lastBillingDate: entry.lastBillingDate?.toISOString?.().slice(0, 10) ?? null,
    generatedCount: entry.generatedCount ?? 0,
    maxOccurrences: entry.maxOccurrences ?? null,
    sortOrder: entry.sortOrder,
  })),
  ...(!publicView && Array.isArray(version.invoices) ? {
    billingProgress: {
      invoices: version.invoices.map((invoice) => serializeBillingInvoice(invoice)),
    },
  } : {}),
  ...(!publicView && version.deliveryProject ? {
    deliveryProject: {
      id: version.deliveryProject.id,
      title: version.deliveryProject.title,
      stage: version.deliveryProject.stage,
      ownerUserId: version.deliveryProject.ownerUserId ?? null,
    },
  } : {}),
  ...(!publicView ? { delivery: serializeProposalDelivery(version) } : {}),
  ...(publicView ? {} : { commercial: version.sourceSnapshot }),
  publishedAt: version.publishedAt?.toISOString?.() ?? null,
  createdAt: version.createdAt?.toISOString?.() ?? null,
  updatedAt: version.updatedAt?.toISOString?.() ?? null,
});

const priceVersionSelections = (version, selections) => {
  const selectionByItemId = new Map(
    selections.map((selection) => [
      Number(selection.itemId ?? selection.proposalVersionItemId),
      selection,
    ])
  );
  const sourceItems = Array.isArray(version.sourceSnapshot?.items)
    ? version.sourceSnapshot.items
    : [];
  return normalizeStructuredProposal({
    ...version.sourceSnapshot,
    items: version.items.map((item, index) => {
      const selection = selectionByItemId.get(Number(item.id));
      const sourceItem = sourceItems[index] || {};
      return {
        ...serializeVersionItem(item),
        key: String(item.id),
        selected: item.required
          ? true
          : selection?.selected ?? item.selectedByDefault ?? sourceItem.selected ?? false,
        quantity: selection?.quantity ?? numberValue(item.quantity),
        configuration: selection?.configuration ?? item.configuration,
      };
    }),
  }, { fallbackTitle: version.title });
};

const serializeAcceptance = (snapshot) => snapshot ? ({
  id: snapshot.id,
  status: snapshot.status,
  proposalVersionId: snapshot.proposalVersionId,
  approverName: snapshot.approverName ?? null,
  approverContact: snapshot.approverContact ?? null,
  termsVersion: snapshot.termsVersion ?? null,
  consentConfirmed: Boolean(snapshot.consentConfirmed),
  acceptedAt: snapshot.acceptedAt?.toISOString?.() ?? null,
  selectionSnapshot: snapshot.selectionSnapshot,
  pricingSnapshot: snapshot.pricingSnapshot,
  termsSnapshot: snapshot.termsSnapshot ?? null,
  scopeSnapshot: snapshot.scopeSnapshot ?? null,
}) : null;

const serializeProposalDelivery = (version) => {
  const sent = (version.accessLinks || [])
    .filter((link) => link.deliveryStatus === "SENT" && link.sentAt)
    .sort((left, right) => right.sentAt.getTime() - left.sentAt.getTime())[0];
  return sent ? {
    status: sent.deliveryStatus,
    sentTo: sent.sentTo,
    lastSentAt: sent.sentAt.toISOString(),
    linkExpiresAt: sent.expiresAt.toISOString(),
  } : null;
};

const versionInclude = {
  items: { orderBy: { sortOrder: "asc" } },
  billingSchedule: { orderBy: { sortOrder: "asc" } },
  approvalSnapshot: true,
  accessLinks: {
    select: {
      id: true, createdAt: true, lastAccessedAt: true, revokedAt: true, expiresAt: true,
      sentTo: true, deliveryStatus: true, sentAt: true, failedAt: true,
    },
  },
  deliveryProject: {
    select: { id: true, title: true, stage: true, ownerUserId: true },
  },
  invoices: {
    where: { archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      currency: true,
      total: true,
      paidAmount: true,
      proposalVersionId: true,
      billingScheduleItemId: true,
      issueDate: true,
      dueDate: true,
      createdAt: true,
    },
  },
};

const proposalWhere = (proposalId, user, isGlobalAdmin) =>
  isGlobalAdmin(user)
    ? { id: proposalId }
    : { id: proposalId, organizationId: user.organizationId };

const getRequestedOrganizationId = (req, isGlobalAdmin) => {
  const requested = parseId(req.query?.organizationId ?? req.body?.organizationId);
  if (requested && isGlobalAdmin(req.user)) return requested;
  return req.user.organizationId;
};

const buildVersionData = ({ proposal, commercial, versionNumber, userId }) => ({
  proposalId: proposal.id,
  versionNumber,
  status: "DRAFT",
  schemaVersion: commercial.schemaVersion,
  customerReference: commercial.customer.reference,
  customerName: commercial.customer.name,
  customerEmail: commercial.customer.email,
  customerAddress: commercial.customer.address,
  projectReference: commercial.project.reference,
  projectTitle: commercial.project.title,
  title: commercial.title,
  summary: commercial.project.summary,
  currency: commercial.currency,
  validUntil: dateValue(commercial.validUntil),
  scope: commercial.scope,
  exclusions: commercial.exclusions,
  terms: commercial.terms,
  taxRate: commercial.totals.taxRate,
  discount: commercial.totals.discount,
  depositPercent: commercial.totals.depositPercent,
  subtotal: commercial.totals.subtotal,
  taxAmount: commercial.totals.taxAmount,
  total: commercial.totals.total,
  oneTimeTotal: commercial.totals.oneTimeTotal,
  recurringMonthlyTotal: commercial.totals.recurringMonthlyTotal,
  recurringAnnualTotal: commercial.totals.recurringAnnualTotal,
  depositAmount: commercial.totals.depositAmount,
  sourceSnapshot: commercial,
  createdByUserId: userId,
});

const buildVersionUpdateData = ({ proposal, commercial, versionNumber, userId }) => {
  const data = buildVersionData({ proposal, commercial, versionNumber, userId });
  delete data.proposalId;
  delete data.versionNumber;
  delete data.status;
  delete data.createdByUserId;
  return data;
};

const buildVersionItemData = (item, index) => ({
  catalogueItemId: item.catalogueItemId,
  kind: item.kind,
  name: item.name,
  description: item.description,
  deliverables: item.deliverables,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  discount: item.discount,
  amount: item.amount,
  billingType: item.billingType,
  billingFrequency: item.billingFrequency,
  required: item.required,
  clientSelectable: item.clientSelectable,
  selectedByDefault: item.selected,
  custom: item.custom,
  costOwnership: item.costOwnership,
  estimatedDelivery: item.estimatedDelivery,
  internalNotes: item.internalNotes,
  clientNotes: item.clientNotes,
  dependencies: item.dependencies,
  configuration: item.configuration,
  selectedTierName: item.selectedTier?.name,
  pricingSourceUrl: item.selectedTier?.sourceUrl,
  pricingVerifiedAt: dateValue(item.selectedTier?.lastVerifiedAt),
  providerCharge: item.selectedTier ? {
    priceModel: item.selectedTier.priceModel,
    amount: item.selectedTier.providerAmount,
    currency: item.selectedTier.providerCurrency,
    displayPrice: item.selectedTier.displayPrice,
    billingFrequency: item.selectedTier.billingFrequency,
  } : null,
  sortOrder: index,
});

const validateCatalogueReferences = async (prisma, organizationId, commercial) => {
  const ids = Array.from(
    new Set(commercial.items.map((item) => item.catalogueItemId).filter(Boolean))
  );
  if (!ids.length) return null;
  const count = await prisma.commercialCatalogueItem.count({
    where: { id: { in: ids }, organizationId, archivedAt: null },
  });
  return count === ids.length ? null : "One or more catalogue items are outside this organization.";
};

const validateProjectReference = async (prisma, organizationId, projectId) => {
  if (!projectId) return null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, archivedAt: null },
    select: { id: true },
  });
  return project ? null : "project.id must reference an active project in this organization.";
};

const validateOwnerReference = async (prisma, organizationId, userId) => {
  if (!userId) return null;
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId, status: { not: "SUSPENDED" } },
    select: { id: true },
  });
  return user ? null : "internalOwnerUserId must reference an active user in this organization.";
};

const replaceVersionChildren = async (tx, versionId, commercial) => {
  await tx.proposalClientSelection.deleteMany({ where: { proposalVersionId: versionId } });
  await tx.proposalBillingScheduleItem.deleteMany({ where: { proposalVersionId: versionId } });
  await tx.proposalVersionItem.deleteMany({ where: { proposalVersionId: versionId } });
  await tx.proposalVersionItem.createMany({
    data: commercial.items.map((item, index) => ({
      proposalVersionId: versionId,
      ...buildVersionItemData(item, index),
    })),
  });
  if (commercial.billingSchedule.length) {
    await tx.proposalBillingScheduleItem.createMany({
      data: commercial.billingSchedule.map((entry, index) => ({
        proposalVersionId: versionId,
        type: entry.type,
        label: entry.label,
        percentage: entry.percentage,
        amount: entry.amount,
        dueRule: entry.dueRule,
        billingFrequency: entry.billingFrequency,
        sortOrder: index,
      })),
    });
  }
};

export const createStructuredProposalHandlers = ({ prisma, isGlobalAdmin, auditWriter, acceptanceNotifier, proposalNotifier, faakoPool }) => {
  const loadScopedProposal = async (req) => {
    const proposalId = parseId(req.params.proposalId);
    if (!proposalId) return { status: 400, error: "Proposal id must be a valid number." };
    const proposal = await prisma.proposal.findFirst({
      where: proposalWhere(proposalId, req.user, isGlobalAdmin),
    });
    return proposal ? { proposal } : { status: 404, error: "Proposal not found." };
  };

  const loadScopedVersion = async (req, { publishedOnly = false } = {}) => {
    const scoped = await loadScopedProposal(req);
    if (scoped.error) return scoped;
    const versionId = parseId(req.params.versionId);
    if (!versionId) return { status: 400, error: "Version id must be a valid number." };
    const version = await prisma.proposalVersion.findFirst({
      where: {
        id: versionId,
        proposalId: scoped.proposal.id,
        ...(publishedOnly ? { status: "PUBLISHED" } : {}),
      },
      include: versionInclude,
    });
    return version ? { proposal: scoped.proposal, version } : { status: 404, error: "Proposal version not found." };
  };

  return {
    listClientOptions: async (req, res) => {
      const options = await loadProposalClientOptions({
        faakoPool,
        search: req.query?.search,
        limit: req.query?.limit,
      });
      return res.json({ options });
    },

    previewPricing: async (req, res) => {
      const normalized = normalizeStructuredProposal(req.body?.commercial, {
        fallbackTitle: "Proposal",
      });
      if (normalized.error) return res.status(400).json({ error: normalized.error });
      return res.json({ commercial: normalized.commercial });
    },

    listStructuredProposals: async (req, res) => {
      const organizationId = getRequestedOrganizationId(req, isGlobalAdmin);
      const search = String(req.query?.search || "").trim();
      const status = String(req.query?.status || "").trim().toUpperCase();
      if (status && !LIFECYCLE_FILTER_STATUSES.includes(status)) {
        return res.status(400).json({ error: "status is not a supported proposal version status." });
      }
      const proposals = await prisma.proposal.findMany({
        where: {
          organizationId,
          archivedAt: null,
          ...(search ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { clientName: { contains: search, mode: "insensitive" } },
              { versions: { some: { customerName: { contains: search, mode: "insensitive" } } } },
              { versions: { some: { projectTitle: { contains: search, mode: "insensitive" } } } },
            ],
          } : {}),
        },
        include: {
          project: { select: { id: true, title: true } },
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: versionInclude,
          },
          revisionRequests: {
            where: { status: "OPEN" },
            select: { id: true, kind: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
      const records = proposals.map((proposal) => {
        const currentVersion = proposal.versions[0]
          ? serializeVersion(proposal.versions[0])
          : null;
        if (currentVersion && proposal.revisionRequests.length && currentVersion.status === "PUBLISHED") {
          currentVersion.lifecycleStatus = "CHANGES_REQUESTED";
        }
        return ({
          id: proposal.id,
          title: proposal.title,
          clientName: proposal.clientName,
          legacyStatus: proposal.status,
          updatedAt: proposal.updatedAt,
          project: proposal.project,
          currentVersion,
          openRequests: proposal.revisionRequests,
          relatedInvoice: proposal.metadata && typeof proposal.metadata === "object" && proposal.metadata.invoiceId ? {
            id: proposal.metadata.invoiceId,
            number: proposal.metadata.invoiceNumber || null,
            status: proposal.metadata.invoiceStatus || null,
          } : null,
        });
      });
      return res.json({
        proposals: status
          ? records.filter((proposal) => proposal.currentVersion?.lifecycleStatus === status)
          : records,
      });
    },

    listCatalogue: async (req, res) => {
      const organizationId = getRequestedOrganizationId(req, isGlobalAdmin);
      const kind = String(req.query?.kind || "").trim().toUpperCase();
      if (kind && !["SERVICE", "INTEGRATION"].includes(kind)) {
        return res.status(400).json({ error: "kind must be SERVICE or INTEGRATION." });
      }
      const category = String(req.query?.category || "").trim();
      const search = String(req.query?.search || "").trim();
      const items = await prisma.commercialCatalogueItem.findMany({
        where: {
          organizationId,
          archivedAt: null,
          active: true,
          ...(kind ? { kind } : {}),
          ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } },
                  { category: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: {
          dependencies: { include: { dependsOnItem: { select: { id: true, name: true, kind: true } } } },
          tiers: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        },
        orderBy: [{ kind: "asc" }, { category: "asc" }, { name: "asc" }],
      });
      const persistedNames = new Set(items.map((item) => `${item.kind}:${item.normalizedName}`));
      const suggestions = COMMON_CATALOGUE_ITEMS.filter((item) => {
        if (kind && item.kind !== kind) return false;
        if (category && item.category.toLowerCase() !== category.toLowerCase()) return false;
        if (search && !`${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())) return false;
        return !persistedNames.has(`${item.kind}:${normalizeCatalogueName(item.name)}`);
      });
      return res.json({ items: items.map(serializeCatalogueItem), suggestions });
    },

    createCatalogueItem: async (req, res) => {
      const organizationId = getRequestedOrganizationId(req, isGlobalAdmin);
      const name = String(req.body?.name || "").trim().slice(0, 180);
      const kind = String(req.body?.kind || "").trim().toUpperCase();
      if (!name) return res.status(400).json({ error: "name is required." });
      if (!["SERVICE", "INTEGRATION"].includes(kind)) {
        return res.status(400).json({ error: "kind must be SERVICE or INTEGRATION." });
      }
      const normalizedName = normalizeCatalogueName(name);
      if (kind === "SERVICE" && normalizedName === "ui/ux design") {
        return res.status(400).json({ error: "UI/UX design is included with Website Development and is not a new selectable service." });
      }
      const duplicate = await prisma.commercialCatalogueItem.findFirst({
        where: { organizationId, kind, normalizedName },
        select: { id: true },
      });
      if (duplicate) return res.status(409).json({ error: "A matching catalogue item already exists." });
      const systemKey = systemKeyValue(req.body?.systemKey);
      if (systemKey && await prisma.commercialCatalogueItem.findFirst({ where: { organizationId, systemKey }, select: { id: true } })) {
        return res.status(409).json({ error: "A matching catalogue system key already exists." });
      }

      const dependencyIds = Array.from(new Set((req.body?.dependencyIds || []).map(parseId).filter(Boolean)));
      if (dependencyIds.length) {
        const dependencyCount = await prisma.commercialCatalogueItem.count({
          where: { id: { in: dependencyIds }, organizationId, archivedAt: null },
        });
        if (dependencyCount !== dependencyIds.length) {
          return res.status(400).json({ error: "Dependencies must belong to the same organization." });
        }
      }
      const unitPrice = req.body?.defaultUnitPrice;
      if (unitPrice !== undefined && (!Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0)) {
        return res.status(400).json({ error: "defaultUnitPrice must be 0 or greater." });
      }
      const defaultBillingType = enumValue(req.body?.defaultBillingType, "ONE_TIME", BILLING_TYPES);
      const defaultBillingFrequency = enumValue(
        req.body?.defaultBillingFrequency,
        "NONE",
        BILLING_FREQUENCIES
      );
      const defaultCostOwnership = enumValue(
        req.body?.defaultCostOwnership,
        "FAAKO_BILLED",
        COST_OWNERS
      );
      if (!defaultBillingType || !defaultBillingFrequency || !defaultCostOwnership) {
        return res.status(400).json({ error: "Catalogue billing defaults are invalid." });
      }
      const sourceUrl = safeUrl(req.body?.sourceUrl);
      if (req.body?.sourceUrl && !sourceUrl) return res.status(400).json({ error: "sourceUrl must be an HTTP or HTTPS URL." });
      const tierInput = normalizeTiers(req.body?.tiers, { defaultSourceUrl: sourceUrl });
      if (tierInput?.error) return res.status(400).json({ error: tierInput.error });
      const item = await prisma.commercialCatalogueItem.create({
        data: {
          organizationId,
          kind,
          name,
          normalizedName,
          systemKey,
          category: String(req.body?.category || "").trim().slice(0, 120) || null,
          description: String(req.body?.description || "").trim().slice(0, 2000) || null,
          deliverables: Array.isArray(req.body?.deliverables) ? req.body.deliverables.slice(0, 100) : [],
          defaultUnitPrice: unitPrice === undefined ? null : Number(unitPrice),
          defaultBillingType,
          defaultBillingFrequency,
          defaultCostOwnership,
          sourceUrl,
          createdByUserId: req.user.userId,
          dependencies: dependencyIds.length
            ? { create: dependencyIds.map((dependsOnItemId) => ({ dependsOnItemId })) }
            : undefined,
          tiers: tierInput?.tiers?.length ? { create: tierInput.tiers } : undefined,
        },
        include: {
          dependencies: { include: { dependsOnItem: { select: { id: true, name: true, kind: true } } } },
          tiers: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        },
      });
      return res.status(201).json({ item: serializeCatalogueItem(item) });
    },

    updateCatalogueItem: async (req, res) => {
      const id = parseId(req.params.catalogueItemId);
      if (!id) return res.status(400).json({ error: "Catalogue item id must be a valid number." });
      const organizationId = getRequestedOrganizationId(req, isGlobalAdmin);
      const existing = await prisma.commercialCatalogueItem.findFirst({
        where: { id, organizationId, archivedAt: null },
      });
      if (!existing) return res.status(404).json({ error: "Catalogue item not found." });

      const name = String(req.body?.name ?? existing.name).trim().slice(0, 180);
      const kind = enumValue(req.body?.kind, existing.kind, ["SERVICE", "INTEGRATION"]);
      const defaultBillingType = enumValue(
        req.body?.defaultBillingType,
        existing.defaultBillingType,
        BILLING_TYPES
      );
      const defaultBillingFrequency = enumValue(
        req.body?.defaultBillingFrequency,
        existing.defaultBillingFrequency,
        BILLING_FREQUENCIES
      );
      const defaultCostOwnership = enumValue(
        req.body?.defaultCostOwnership,
        existing.defaultCostOwnership,
        COST_OWNERS
      );
      if (!name || !kind || !defaultBillingType || !defaultBillingFrequency || !defaultCostOwnership) {
        return res.status(400).json({ error: "Catalogue item values are invalid." });
      }
      const unitPrice = req.body?.defaultUnitPrice ?? numberValue(existing.defaultUnitPrice);
      if (unitPrice !== null && (!Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0)) {
        return res.status(400).json({ error: "defaultUnitPrice must be 0 or greater." });
      }
      const normalizedName = normalizeCatalogueName(name);
      if (kind === "SERVICE" && normalizedName === "ui/ux design" && normalizeCatalogueName(existing.name) !== "ui/ux design") {
        return res.status(400).json({ error: "UI/UX design is included with Website Development and is not a new selectable service." });
      }
      const duplicate = await prisma.commercialCatalogueItem.findFirst({
        where: { organizationId, kind, normalizedName, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) return res.status(409).json({ error: "A matching catalogue item already exists." });
      const systemKey = req.body?.systemKey === undefined ? existing.systemKey : systemKeyValue(req.body.systemKey);
      if (systemKey && await prisma.commercialCatalogueItem.findFirst({ where: { organizationId, systemKey, id: { not: id } }, select: { id: true } })) {
        return res.status(409).json({ error: "A matching catalogue system key already exists." });
      }

      const dependencyIds = req.body?.dependencyIds === undefined
        ? null
        : Array.from(new Set((req.body.dependencyIds || []).map(parseId).filter(Boolean)));
      if (dependencyIds?.includes(id)) {
        return res.status(400).json({ error: "A catalogue item cannot depend on itself." });
      }
      if (dependencyIds?.length) {
        const dependencyCount = await prisma.commercialCatalogueItem.count({
          where: { id: { in: dependencyIds }, organizationId, archivedAt: null },
        });
        if (dependencyCount !== dependencyIds.length) {
          return res.status(400).json({ error: "Dependencies must belong to the same organization." });
        }
      }
      const sourceUrl = req.body?.sourceUrl === undefined ? existing.sourceUrl : safeUrl(req.body.sourceUrl);
      if (req.body?.sourceUrl && !sourceUrl) return res.status(400).json({ error: "sourceUrl must be an HTTP or HTTPS URL." });
      const tierInput = normalizeTiers(req.body?.tiers, { defaultSourceUrl: sourceUrl });
      if (tierInput?.error) return res.status(400).json({ error: tierInput.error });
      const item = await prisma.$transaction(async (tx) => {
        if (dependencyIds) {
          await tx.commercialCatalogueDependency.deleteMany({ where: { itemId: id } });
        }
        await tx.commercialCatalogueItem.update({
          where: { id },
          data: {
            kind,
            name,
            normalizedName,
            systemKey,
            category: String(req.body?.category ?? existing.category ?? "").trim().slice(0, 120) || null,
            description: String(req.body?.description ?? existing.description ?? "").trim().slice(0, 2000) || null,
            deliverables: Array.isArray(req.body?.deliverables)
              ? req.body.deliverables.slice(0, 100)
              : existing.deliverables,
            defaultUnitPrice: unitPrice === null ? null : Number(unitPrice),
            defaultBillingType,
            defaultBillingFrequency,
            defaultCostOwnership,
            sourceUrl,
            active: typeof req.body?.active === "boolean" ? req.body.active : existing.active,
          },
        });
        if (dependencyIds?.length) {
          await tx.commercialCatalogueDependency.createMany({
            data: dependencyIds.map((dependsOnItemId) => ({ itemId: id, dependsOnItemId })),
          });
        }
        if (tierInput) {
          await tx.commercialCatalogueTier.deleteMany({ where: { catalogueItemId: id } });
          if (tierInput.tiers.length) {
            await tx.commercialCatalogueTier.createMany({ data: tierInput.tiers.map((tier) => ({ ...tier, catalogueItemId: id })) });
          }
        }
        return tx.commercialCatalogueItem.findUnique({
          where: { id },
          include: {
            dependencies: {
              include: { dependsOnItem: { select: { id: true, name: true, kind: true } } },
            },
            tiers: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
          },
        });
      });
      return res.json({ item: serializeCatalogueItem(item) });
    },

    listPackages: async (req, res) => {
      const organizationId = getRequestedOrganizationId(req, isGlobalAdmin);
      const packages = await prisma.commercialPackage.findMany({
        where: { organizationId, archivedAt: null, active: true },
        include: { items: { orderBy: { sortOrder: "asc" }, include: { catalogueItem: { include: { tiers: { where: { active: true }, orderBy: { sortOrder: "asc" } } } } } } },
        orderBy: { name: "asc" },
      });
      return res.json({ packages });
    },

    createPackage: async (req, res) => {
      const organizationId = getRequestedOrganizationId(req, isGlobalAdmin);
      const name = String(req.body?.name || "").trim().slice(0, 180);
      if (!name) return res.status(400).json({ error: "name is required." });
      const normalizedName = normalizeCatalogueName(name);
      const duplicate = await prisma.commercialPackage.findFirst({
        where: { organizationId, normalizedName }, select: { id: true },
      });
      if (duplicate) return res.status(409).json({ error: "A matching package already exists." });
      const inputs = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!inputs.length) return res.status(400).json({ error: "items must include at least one item." });
      const catalogueIds = Array.from(new Set(inputs.map((item) => parseId(item.catalogueItemId)).filter(Boolean)));
      const count = await prisma.commercialCatalogueItem.count({
        where: { id: { in: catalogueIds }, organizationId, archivedAt: null },
      });
      if (count !== catalogueIds.length || catalogueIds.length !== inputs.length) {
        return res.status(400).json({ error: "Package items must reference catalogue items in this organization." });
      }
      const created = await prisma.commercialPackage.create({
        data: {
          organizationId,
          name,
          normalizedName,
          description: String(req.body?.description || "").trim().slice(0, 2000) || null,
          createdByUserId: req.user.userId,
          items: {
            create: inputs.map((item, index) => ({
              catalogueItemId: Number(item.catalogueItemId),
              configuration: item.configuration && typeof item.configuration === "object"
                ? item.configuration
                : {},
              sortOrder: index,
            })),
          },
        },
        include: { items: { orderBy: { sortOrder: "asc" }, include: { catalogueItem: { include: { tiers: { where: { active: true }, orderBy: { sortOrder: "asc" } } } } } } },
      });
      return res.status(201).json({ package: created });
    },

    listVersions: async (req, res) => {
      const scoped = await loadScopedProposal(req);
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      const versions = await prisma.proposalVersion.findMany({
        where: { proposalId: scoped.proposal.id },
        include: versionInclude,
        orderBy: { versionNumber: "desc" },
      });
      return res.json({
        compatibility: adaptLegacyProposal(scoped.proposal).mode,
        versions: versions.map((version) => serializeVersion(version)),
      });
    },

    listRevisionRequests: async (req, res) => {
      const scoped = await loadScopedVersion(req);
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      const requests = await prisma.proposalRevisionRequest.findMany({
        where: { proposalVersionId: scoped.version.id },
        orderBy: { createdAt: "desc" },
      });
      return res.json({
        requests: requests.map((request) => ({
          id: request.id,
          kind: request.kind,
          status: request.status,
          message: request.message,
          requesterName: request.requesterName,
          requesterContact: request.requesterContact,
          createdAt: request.createdAt,
          resolvedAt: request.resolvedAt,
        })),
      });
    },

    resolveRevisionRequest: async (req, res) => {
      const scoped = await loadScopedVersion(req);
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      const requestId = parseId(req.params.requestId);
      if (!requestId) return res.status(400).json({ error: "Request id must be a valid number." });
      const status = String(req.body?.status || "").trim().toUpperCase();
      if (!REVISION_STATUSES.includes(status)) {
        return res.status(400).json({ error: "status must be RESOLVED or REJECTED." });
      }
      const existing = await prisma.proposalRevisionRequest.findFirst({
        where: { id: requestId, proposalVersionId: scoped.version.id },
      });
      if (!existing) return res.status(404).json({ error: "Client request not found." });
      if (existing.status !== "OPEN") {
        return res.status(409).json({ error: "Only open client requests can be resolved." });
      }
      const updated = await prisma.proposalRevisionRequest.update({
        where: { id: existing.id },
        data: {
          status,
          resolvedAt: new Date(),
        },
      });
      await auditWriter?.({
        organizationId: scoped.proposal.organizationId,
        userId: req.user.userId,
        action: `PROPOSAL_CLIENT_REQUEST_${status}`,
        targetType: "proposal-revision-request",
        targetId: String(updated.id),
        summary: `Proposal client request marked ${status.toLowerCase()}`,
        metadata: { proposalId: scoped.proposal.id, versionId: scoped.version.id },
        requestId: req.requestId,
      });
      return res.json({
        request: {
          id: updated.id,
          kind: updated.kind,
          status: updated.status,
          resolvedAt: updated.resolvedAt,
        },
      });
    },

    createVersion: async (req, res) => {
      const scoped = await loadScopedProposal(req);
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      const source = req.body?.commercial || adaptLegacyProposal(scoped.proposal).commercial;
      const normalized = normalizeStructuredProposal(source, { fallbackTitle: scoped.proposal.title });
      if (normalized.error) return res.status(400).json({ error: normalized.error });
      const { commercial } = normalized;
      const projectError = await validateProjectReference(
        prisma,
        scoped.proposal.organizationId,
        commercial.project.id
      );
      if (projectError) return res.status(400).json({ error: projectError });
      const catalogueError = await validateCatalogueReferences(
        prisma,
        scoped.proposal.organizationId,
        commercial
      );
      if (catalogueError) return res.status(400).json({ error: catalogueError });
      const ownerError = await validateOwnerReference(
        prisma,
        scoped.proposal.organizationId,
        commercial.internalOwnerUserId
      );
      if (ownerError) return res.status(400).json({ error: ownerError });

      const latest = await prisma.proposalVersion.aggregate({
        where: { proposalId: scoped.proposal.id },
        _max: { versionNumber: true },
      });
      const versionNumber = Number(latest?._max?.versionNumber || 0) + 1;
      const version = await prisma.$transaction(async (tx) => {
        const created = await tx.proposalVersion.create({
          data: buildVersionData({
            proposal: scoped.proposal,
            commercial,
            versionNumber,
            userId: req.user.userId,
          }),
        });
        await replaceVersionChildren(tx, created.id, commercial);
        await tx.proposal.update({
          where: { id: scoped.proposal.id },
          data: {
            projectId: commercial.project.id,
            lastEditedByUserId: req.user.userId,
          },
        });
        return tx.proposalVersion.findUnique({ where: { id: created.id }, include: versionInclude });
      });
      return res.status(201).json({ version: serializeVersion(version) });
    },

    updateVersion: async (req, res) => {
      const scoped = await loadScopedVersion(req);
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      if (scoped.version.status !== "DRAFT") {
        return res.status(409).json({ error: "Published proposal versions are immutable." });
      }
      const normalized = normalizeStructuredProposal(req.body?.commercial, {
        fallbackTitle: scoped.version.title,
      });
      if (normalized.error) return res.status(400).json({ error: normalized.error });
      const { commercial } = normalized;
      const projectError = await validateProjectReference(
        prisma,
        scoped.proposal.organizationId,
        commercial.project.id
      );
      if (projectError) return res.status(400).json({ error: projectError });
      const catalogueError = await validateCatalogueReferences(
        prisma,
        scoped.proposal.organizationId,
        commercial
      );
      if (catalogueError) return res.status(400).json({ error: catalogueError });
      const ownerError = await validateOwnerReference(
        prisma,
        scoped.proposal.organizationId,
        commercial.internalOwnerUserId
      );
      if (ownerError) return res.status(400).json({ error: ownerError });

      const version = await prisma.$transaction(async (tx) => {
        await tx.proposalVersion.update({
          where: { id: scoped.version.id },
          data: buildVersionUpdateData({
            proposal: scoped.proposal,
            commercial,
            versionNumber: scoped.version.versionNumber,
            userId: scoped.version.createdByUserId,
          }),
        });
        await replaceVersionChildren(tx, scoped.version.id, commercial);
        await tx.proposal.update({
          where: { id: scoped.proposal.id },
          data: { projectId: commercial.project.id, lastEditedByUserId: req.user.userId },
        });
        return tx.proposalVersion.findUnique({
          where: { id: scoped.version.id }, include: versionInclude,
        });
      });
      return res.json({ version: serializeVersion(version) });
    },

    publishVersion: async (req, res) => {
      const scoped = await loadScopedVersion(req);
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      if (!validateVersionTransition(scoped.version.status, "PUBLISHED")) {
        return res.status(409).json({ error: "Only draft proposal versions can be published." });
      }
      const version = await prisma.$transaction(async (tx) => {
        await tx.proposalVersion.updateMany({
          where: { proposalId: scoped.proposal.id, status: "PUBLISHED", id: { not: scoped.version.id } },
          data: { status: "SUPERSEDED" },
        });
        return tx.proposalVersion.update({
          where: { id: scoped.version.id },
          data: { status: "PUBLISHED", publishedAt: new Date() },
          include: versionInclude,
        });
      });
      return res.json({ version: serializeVersion(version) });
    },

    prepareAccessLink: async (req, res) => {
      const scoped = await loadScopedVersion(req, { publishedOnly: true });
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      const ttlHours = Math.min(Math.max(Number(req.body?.ttlHours) || 336, 1), 2160);
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
      const link = await prisma.proposalAccessLink.create({
        data: {
          proposalVersionId: scoped.version.id,
          tokenHash,
          expiresAt,
          createdByUserId: req.user.userId,
        },
      });
      return res.status(201).json({
        access: {
          id: link.id,
          token,
          path: `/proposal/interactive/${token}`,
          expiresAt: expiresAt.toISOString(),
        },
      });
    },

    sendPublishedVersion: async (req, res) => {
      const scoped = await loadScopedVersion(req, { publishedOnly: true });
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      if (scoped.version.validUntil && scoped.version.validUntil.getTime() < Date.now()) {
        return res.status(409).json({ error: "This proposal has expired and cannot be sent." });
      }
      if (typeof proposalNotifier !== "function") {
        return res.status(503).json({ error: "Proposal email delivery is not configured." });
      }
      const recipient = String(req.body?.recipient || scoped.version.customerEmail || "").trim().toLowerCase();
      if (!EMAIL_PATTERN.test(recipient) || recipient.length > 320) {
        return res.status(400).json({ error: "A valid client email address is required." });
      }
      const personalMessage = String(req.body?.personalMessage || "").trim().slice(0, 1000);
      const ttlHours = Math.min(Math.max(Number(req.body?.ttlHours) || 336, 1), 2160);
      const idempotencyKey = String(req.headers?.["idempotency-key"] || "").trim();
      if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
        return res.status(400).json({ error: "Idempotency-Key must contain between 8 and 200 characters." });
      }
      const fingerprint = proposalSendFingerprint({
        versionId: scoped.version.id,
        recipient,
        personalMessage,
        ttlHours,
      });
      const existing = await prisma.proposalAccessLink.findFirst({
        where: { proposalVersionId: scoped.version.id, sendIdempotencyKey: idempotencyKey },
      });
      if (existing) {
        if (existing.sendRequestFingerprint !== fingerprint) {
          return res.status(409).json({ error: "Idempotency-Key was already used with a different request." });
        }
        if (existing.deliveryStatus === "SENT") {
          return res.json({
            duplicate: true,
            delivery: {
              status: "SENT",
              sentTo: existing.sentTo,
              sentAt: existing.sentAt?.toISOString?.() ?? null,
              linkExpiresAt: existing.expiresAt.toISOString(),
            },
          });
        }
        return res.status(409).json({
          error: existing.deliveryStatus === "FAILED"
            ? "The previous delivery failed. Retry with a new idempotency key."
            : "This proposal delivery is already in progress.",
        });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
      const isResend = scoped.version.accessLinks.some((candidate) => candidate.deliveryStatus === "SENT");
      let link;
      try {
        link = await prisma.proposalAccessLink.create({
          data: {
            proposalVersionId: scoped.version.id,
            tokenHash,
            expiresAt,
            createdByUserId: req.user.userId,
            sentTo: recipient,
            deliveryStatus: "PENDING",
            sendIdempotencyKey: idempotencyKey,
            sendRequestFingerprint: fingerprint,
          },
        });
      } catch (error) {
        if (error?.code === "P2002") {
          return res.status(409).json({ error: "This proposal delivery request is already being processed." });
        }
        throw error;
      }

      const path = `/proposal/interactive/${token}`;
      let providerMessageId = null;
      try {
        const deliveryResult = await proposalNotifier({
          recipient,
          personalMessage,
          path,
          linkExpiresAt: expiresAt,
          version: scoped.version,
        });
        providerMessageId = String(deliveryResult?.providerMessageId || "").slice(0, 240) || null;
      } catch (error) {
        const failedAt = new Date();
        const failureCategory = safeDeliveryFailureCategory(error);
        await prisma.proposalAccessLink.update({
          where: { id: link.id },
          data: { deliveryStatus: "FAILED", failedAt, failureCategory, revokedAt: failedAt },
        });
        await auditWriter?.({
          organizationId: scoped.proposal.organizationId,
          userId: req.user.userId,
          action: "PROPOSAL_EMAIL_FAILED",
          targetType: "proposal-version",
          targetId: String(scoped.version.id),
          summary: "Proposal email delivery failed",
          metadata: { proposalId: scoped.proposal.id, linkId: link.id, recipient, failureCategory },
          requestId: req.requestId,
        });
        return res.status(502).json({ error: "Unable to send the proposal email. The previous client link remains active." });
      }

      const sentAt = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.proposalAccessLink.update({
          where: { id: link.id },
          data: { deliveryStatus: "SENT", sentAt, providerMessageId },
        });
        await tx.proposalAccessLink.updateMany({
          where: {
            proposalVersionId: scoped.version.id,
            id: { not: link.id },
            revokedAt: null,
          },
          data: { revokedAt: sentAt },
        });
      });
      await auditWriter?.({
        organizationId: scoped.proposal.organizationId,
        userId: req.user.userId,
        action: isResend ? "PROPOSAL_EMAIL_RESENT" : "PROPOSAL_EMAIL_SENT",
        targetType: "proposal-version",
        targetId: String(scoped.version.id),
        summary: isResend ? "Proposal link re-emailed to client" : "Proposal link emailed to client",
        metadata: { proposalId: scoped.proposal.id, linkId: link.id, recipient, expiresAt: expiresAt.toISOString() },
        requestId: req.requestId,
      });
      return res.status(201).json({
        duplicate: false,
        delivery: { status: "SENT", sentTo: recipient, sentAt: sentAt.toISOString(), linkExpiresAt: expiresAt.toISOString() },
        access: { id: link.id, token, path, expiresAt: expiresAt.toISOString() },
      });
    },

    revokeAccessLink: async (req, res) => {
      const scoped = await loadScopedVersion(req);
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      const linkId = parseId(req.params.linkId);
      if (!linkId) return res.status(400).json({ error: "Access link id must be a valid number." });
      const link = await prisma.proposalAccessLink.findFirst({
        where: { id: linkId, proposalVersionId: scoped.version.id },
      });
      if (!link) return res.status(404).json({ error: "Access link not found." });
      if (!link.revokedAt) {
        await prisma.proposalAccessLink.update({
          where: { id: link.id },
          data: { revokedAt: new Date() },
        });
      }
      return res.status(204).send();
    },

    withdrawVersion: async (req, res) => {
      const scoped = await loadScopedVersion(req);
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      if (!validateVersionTransition(scoped.version.status, "WITHDRAWN")) {
        return res.status(409).json({ error: `${scoped.version.status} proposal versions cannot be withdrawn.` });
      }
      const withdrawn = await prisma.$transaction(async (tx) => {
        const changed = await tx.proposalVersion.updateMany({
          where: { id: scoped.version.id, status: "PUBLISHED" },
          data: { status: "WITHDRAWN" },
        });
        if (changed.count !== 1) return null;
        await tx.proposalAccessLink.updateMany({
          where: { proposalVersionId: scoped.version.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return tx.proposalVersion.findUnique({ where: { id: scoped.version.id }, include: versionInclude });
      }, { isolationLevel: "Serializable" });
      if (!withdrawn) return res.status(409).json({ error: "Proposal version changed before it could be withdrawn." });
      await auditWriter?.({
        organizationId: scoped.proposal.organizationId,
        userId: req.user.userId,
        action: "PROPOSAL_VERSION_WITHDRAWN",
        targetType: "proposal-version",
        targetId: String(withdrawn.id),
        summary: `Withdrew proposal version ${withdrawn.versionNumber}`,
        metadata: { proposalId: scoped.proposal.id },
        requestId: req.requestId,
      });
      return res.json({ version: serializeVersion(withdrawn) });
    },

    generateBillingInvoice: async (req, res) => {
      const scoped = await loadScopedVersion(req);
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      if (scoped.version.status !== "ACCEPTED" || scoped.version.approvalSnapshot?.status !== "ACCEPTED") {
        return res.status(409).json({ error: "Invoices can only be generated from an accepted proposal version." });
      }
      const billingItemId = parseId(req.params.billingItemId);
      if (!billingItemId) return res.status(400).json({ error: "Billing item id must be a valid number." });
      const billingItem = await prisma.proposalBillingScheduleItem.findFirst({
        where: { id: billingItemId, proposalVersionId: scoped.version.id },
      });
      if (!billingItem) return res.status(404).json({ error: "Billing schedule item not found." });
      if (["CANCELLED", "COMPLETED"].includes(billingItem.status)) {
        const existingInvoice = await prisma.invoice.findFirst({
          where: { billingScheduleItemId: billingItem.id, archivedAt: null },
          orderBy: { createdAt: "desc" },
        });
        if (existingInvoice && billingItem.type !== "RECURRING") {
          return res.json({ created: false, invoice: serializeBillingInvoice(existingInvoice) });
        }
        return res.status(409).json({ error: "This billing schedule item is not active." });
      }
      if (billingItem.status === "PAUSED") {
        return res.status(409).json({ error: "This billing schedule is paused." });
      }
      if (billingItem.type === "RECURRING" && !["MONTHLY", "QUARTERLY", "ANNUAL"].includes(billingItem.billingFrequency)) {
        return res.status(409).json({ error: "Recurring invoice generation requires a monthly, quarterly, or annual frequency." });
      }
      if (billingItem.generationRule === "MANUAL" && req.body?.triggerConfirmed !== true) {
        return res.status(400).json({ error: "triggerConfirmed is required for milestone or completion invoices." });
      }

      const now = new Date();
      const requestedBillingDate = req.body?.billingDate ? dateValue(req.body.billingDate) : null;
      if (req.body?.billingDate && !requestedBillingDate) {
        return res.status(400).json({ error: "billingDate must be a valid date." });
      }
      const occurrenceDate = billingItem.type === "RECURRING"
        ? requestedBillingDate || billingItem.nextBillingDate || now
        : billingItem.startDate || now;
      if (billingItem.type === "RECURRING" && billingItem.nextBillingDate && occurrenceDate < billingItem.nextBillingDate) {
        return res.status(409).json({ error: "The next recurring billing date has not arrived." });
      }
      const generationKey = billingItem.type === "RECURRING"
        ? `proposal:${scoped.version.id}:billing:${billingItem.id}:${dateKey(occurrenceDate)}`
        : `proposal:${scoped.version.id}:billing:${billingItem.id}`;
      const existing = await prisma.invoice.findUnique({ where: { generationKey } });
      if (existing) return res.json({ created: false, invoice: serializeBillingInvoice(existing) });

      const issueDate = requestedBillingDate || now;
      const dueDate = req.body?.dueDate ? dateValue(req.body.dueDate) : new Date(issueDate);
      if (req.body?.dueDate && !dueDate) return res.status(400).json({ error: "dueDate must be a valid date." });
      if (!req.body?.dueDate) dueDate.setUTCDate(dueDate.getUTCDate() + 14);
      if (dueDate < issueDate) return res.status(400).json({ error: "dueDate cannot be earlier than issueDate." });

      const stamp = `${issueDate.getUTCFullYear()}${String(issueDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const prefix = `INV-${stamp}-${String(scoped.proposal.organizationId).padStart(3, "0")}`;
      const count = await prisma.invoice.count({
        where: { organizationId: scoped.proposal.organizationId, invoiceNumber: { startsWith: prefix } },
      });
      const invoiceNumber = `${prefix}-${String(count + 1).padStart(4, "0")}`;
      const amount = numberValue(billingItem.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(409).json({ error: "The billing schedule amount is invalid." });
      }

      let invoice;
      try {
        invoice = await prisma.$transaction(async (tx) => {
          const created = await tx.invoice.create({
            data: {
              organizationId: scoped.proposal.organizationId,
              invoiceNumber,
              status: "DRAFT",
              currency: scoped.version.currency,
              issueDate,
              dueDate,
              clientName: scoped.version.customerName || scoped.proposal.clientName || scoped.version.title,
              clientEmail: scoped.version.customerEmail,
              clientAddress: scoped.version.customerAddress,
              notes: `Generated from accepted proposal #${scoped.proposal.id}, version ${scoped.version.versionNumber}, billing event: ${billingItem.label}. Review before sending.`,
              subtotal: amount,
              taxRate: 0,
              taxAmount: 0,
              discount: 0,
              total: amount,
              paidAmount: 0,
              proposalVersionId: scoped.version.id,
              billingScheduleItemId: billingItem.id,
              generationKey,
              lineItems: {
                create: [{
                  description: `${billingItem.label} — ${scoped.version.title}`,
                  quantity: 1,
                  unitPrice: amount,
                  amount,
                  sortOrder: 0,
                }],
              },
            },
          });
          const nextDate = billingItem.type === "RECURRING"
            ? addBillingInterval(occurrenceDate, billingItem.billingFrequency)
            : null;
          const nextCount = Number(billingItem.generatedCount || 0) + 1;
          const recurringComplete = billingItem.maxOccurrences && nextCount >= billingItem.maxOccurrences;
          await tx.proposalBillingScheduleItem.update({
            where: { id: billingItem.id },
            data: {
              status: billingItem.type === "RECURRING" && !recurringComplete ? "ACTIVE" : "COMPLETED",
              lastBillingDate: occurrenceDate,
              nextBillingDate: billingItem.type === "RECURRING" && !recurringComplete ? nextDate : null,
              generatedCount: { increment: 1 },
            },
          });
          return created;
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (error?.code === "P2002") {
          const duplicate = await prisma.invoice.findUnique({ where: { generationKey } });
          if (duplicate) return res.json({ created: false, invoice: serializeBillingInvoice(duplicate) });
          return res.status(409).json({ error: "Invoice numbering changed concurrently. Retry safely." });
        }
        await prisma.proposalBillingScheduleItem.update({
          where: { id: billingItem.id }, data: { status: "ERROR" },
        }).catch(() => null);
        throw error;
      }
      await auditWriter?.({
        organizationId: scoped.proposal.organizationId,
        userId: req.user.userId,
        action: "PROPOSAL_BILLING_INVOICE_CREATED",
        targetType: "invoice",
        targetId: String(invoice.id),
        category: "financial",
        summary: `Created invoice ${invoice.invoiceNumber} from accepted proposal billing`,
        metadata: {
          proposalId: scoped.proposal.id,
          versionId: scoped.version.id,
          billingScheduleItemId: billingItem.id,
          generationKey,
        },
        requestId: req.requestId,
      });
      return res.status(201).json({ created: true, invoice: serializeBillingInvoice(invoice) });
    },

    updateBillingScheduleStatus: async (req, res) => {
      const scoped = await loadScopedVersion(req);
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      if (scoped.version.status !== "ACCEPTED") {
        return res.status(409).json({ error: "Billing schedules require an accepted proposal." });
      }
      const billingItemId = parseId(req.params.billingItemId);
      if (!billingItemId) return res.status(400).json({ error: "Billing item id must be a valid number." });
      const status = String(req.body?.status || "").trim().toUpperCase();
      if (!["ACTIVE", "PAUSED", "CANCELLED"].includes(status)) {
        return res.status(400).json({ error: "status must be ACTIVE, PAUSED, or CANCELLED." });
      }
      const item = await prisma.proposalBillingScheduleItem.findFirst({
        where: { id: billingItemId, proposalVersionId: scoped.version.id },
      });
      if (!item) return res.status(404).json({ error: "Billing schedule item not found." });
      if (item.status === "COMPLETED") return res.status(409).json({ error: "Completed billing cannot be changed." });
      const updated = await prisma.proposalBillingScheduleItem.update({
        where: { id: item.id }, data: { status },
      });
      return res.json({
        billingItem: {
          id: updated.id,
          status: updated.status,
          nextBillingDate: dateKey(updated.nextBillingDate),
        },
      });
    },

    linkAcceptedProject: async (req, res) => {
      const scoped = await loadScopedVersion(req);
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      if (scoped.version.status !== "ACCEPTED") {
        return res.status(409).json({ error: "A project can only be linked from an accepted proposal." });
      }
      const requestedProjectId = parseId(req.body?.projectId);
      if (scoped.proposal.projectId && requestedProjectId && scoped.proposal.projectId !== requestedProjectId) {
        return res.status(409).json({ error: "This proposal is already linked to another project." });
      }
      if (scoped.version.deliveryProject) {
        return res.json({ project: scoped.version.deliveryProject, created: false });
      }
      let project = null;
      let createdProject = false;
      if (requestedProjectId) {
        project = await prisma.project.findFirst({
          where: { id: requestedProjectId, organizationId: scoped.proposal.organizationId, archivedAt: null },
        });
        if (!project) return res.status(404).json({ error: "Project not found." });
        if (project.acceptedProposalVersionId && project.acceptedProposalVersionId !== scoped.version.id) {
          return res.status(409).json({ error: "Project is already linked to another accepted proposal version." });
        }
      } else if (scoped.proposal.projectId) {
        project = await prisma.project.findFirst({
          where: { id: scoped.proposal.projectId, organizationId: scoped.proposal.organizationId },
        });
      } else {
        const ownerUserId = parseId(req.body?.ownerUserId ?? scoped.version.sourceSnapshot?.internalOwnerUserId);
        if (ownerUserId) {
          const owner = await prisma.user.findFirst({
            where: { id: ownerUserId, organizationId: scoped.proposal.organizationId, status: { not: "SUSPENDED" } },
            select: { id: true },
          });
          if (!owner) return res.status(400).json({ error: "ownerUserId is not active in this organization." });
        }
        try {
          project = await prisma.$transaction(async (tx) => {
            const created = await tx.project.create({
            data: {
              organizationId: scoped.proposal.organizationId,
              ownerUserId,
              title: String(req.body?.title || scoped.version.projectTitle || scoped.version.title).trim().slice(0, 180),
              clientName: scoped.version.customerName,
              projectType: "EXTERNAL",
              stage: "SCOPING",
              priority: "MEDIUM",
              currency: scoped.version.currency,
              budgetAmount: scoped.version.oneTimeTotal,
              description: scoped.version.scope || scoped.version.summary,
              externalRef: `proposal-version:${scoped.version.id}`,
              acceptedProposalVersionId: scoped.version.id,
            },
          });
            if (req.body?.importDeliverables === true) {
              const acceptedItems = Array.isArray(scoped.version.approvalSnapshot?.scopeSnapshot?.items)
                ? scoped.version.approvalSnapshot.scopeSnapshot.items
                : [];
              const tasks = acceptedItems.flatMap((item) =>
                (Array.isArray(item.deliverables) ? item.deliverables : []).map((deliverable) => ({
                  organizationId: scoped.proposal.organizationId,
                  projectId: created.id,
                  title: String(deliverable).trim().slice(0, 180),
                  description: `Accepted proposal deliverable for ${item.name}`,
                  status: "BACKLOG",
                  priority: "MEDIUM",
                }))
              ).filter((task) => task.title);
              if (tasks.length) await tx.projectTask.createMany({ data: tasks.slice(0, 200) });
            }
            await tx.proposal.update({
              where: { id: scoped.proposal.id }, data: { projectId: created.id },
            });
            return created;
          });
          createdProject = true;
        } catch (error) {
          if (error?.code !== "P2002") throw error;
          project = await prisma.project.findUnique({
            where: { acceptedProposalVersionId: scoped.version.id },
          });
          if (!project) throw error;
        }
      }
      if (project && (
        project.acceptedProposalVersionId !== scoped.version.id || scoped.proposal.projectId !== project.id
      )) {
        const operations = [];
        if (project.acceptedProposalVersionId !== scoped.version.id) {
          operations.push(prisma.project.update({
            where: { id: project.id }, data: { acceptedProposalVersionId: scoped.version.id },
          }));
        }
        if (scoped.proposal.projectId !== project.id) {
          operations.push(prisma.proposal.update({
            where: { id: scoped.proposal.id }, data: { projectId: project.id },
          }));
        }
        try {
          await prisma.$transaction(operations);
        } catch (error) {
          if (error?.code !== "P2002") throw error;
          project = await prisma.project.findUnique({
            where: { acceptedProposalVersionId: scoped.version.id },
          });
          if (!project) throw error;
        }
      }
      return res.json({
        project: {
          id: project.id,
          title: project.title,
          stage: project.stage,
          ownerUserId: project.ownerUserId ?? null,
        },
        created: createdProject,
      });
    },

    prepareApprovalSnapshot: async (req, res) => {
      const scoped = await loadScopedVersion(req, { publishedOnly: true });
      if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
      const existing = await prisma.proposalApprovalSnapshot.findUnique({
        where: { proposalVersionId: scoped.version.id },
        select: { id: true },
      });
      if (existing) {
        return res.status(409).json({ error: "An approval snapshot already exists for this version." });
      }
      const accessLinkId = parseId(req.body?.accessLinkId);
      if (req.body?.accessLinkId !== undefined && !accessLinkId) {
        return res.status(400).json({ error: "accessLinkId must be a valid number." });
      }
      let clientKey = String(req.body?.clientKey || "default").trim().slice(0, 160) || "default";
      if (accessLinkId) {
        const accessLink = await prisma.proposalAccessLink.findFirst({
          where: { id: accessLinkId, proposalVersionId: scoped.version.id, revokedAt: null },
          select: { id: true },
        });
        if (!accessLink) {
          return res.status(400).json({ error: "accessLinkId must reference an active link for this version." });
        }
        clientKey = `access:${accessLink.id}`;
      }
      const selections = await prisma.proposalClientSelection.findMany({
        where: { proposalVersionId: scoped.version.id, clientKey },
        orderBy: { proposalVersionItemId: "asc" },
      });
      const pricedSelection = priceVersionSelections(scoped.version, selections);
      if (pricedSelection.error) return res.status(400).json({ error: pricedSelection.error });
      const snapshot = await prisma.proposalApprovalSnapshot.create({
        data: {
          proposalVersionId: scoped.version.id,
          status: "PREPARED",
          selectionSnapshot: {
            clientKey,
            items: selections.map((selection) => ({
              proposalVersionItemId: selection.proposalVersionItemId,
              selected: selection.selected,
              quantity: numberValue(selection.quantity),
              configuration: selection.configuration,
            })),
          },
          pricingSnapshot: {
            ...pricedSelection.commercial.totals,
            billingSchedule: pricedSelection.commercial.billingSchedule,
          },
          termsSnapshot: {
            validUntil: scoped.version.validUntil?.toISOString?.().slice(0, 10) ?? null,
            scope: scoped.version.scope,
            exclusions: scoped.version.exclusions,
            terms: scoped.version.terms,
          },
        },
      });
      return res.status(201).json({
        snapshot: { id: snapshot.id, status: snapshot.status, acceptedAt: null },
      });
    },

    acceptInteractive: async (req, res) => {
      const token = String(req.params.token || "").trim();
      if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).json({ error: "Proposal link is invalid." });
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const link = await prisma.proposalAccessLink.findUnique({
        where: { tokenHash },
        include: { proposalVersion: { include: { ...versionInclude, proposal: true } } },
      });
      if (!link || link.revokedAt) return res.status(404).json({ error: "Proposal link is unavailable." });
      if (link.expiresAt <= new Date()) return res.status(410).json({ error: "Proposal link has expired." });

      const version = link.proposalVersion;
      if (version.status === "ACCEPTED" && version.approvalSnapshot?.status === "ACCEPTED") {
        return res.json({
          accepted: true,
          duplicate: true,
          acceptance: serializeAcceptance(version.approvalSnapshot),
          billingSchedule: serializeVersion(version, { publicView: true }).billingSchedule,
        });
      }
      if (version.status !== "PUBLISHED") {
        return res.status(409).json({ error: "This proposal version is not eligible for acceptance." });
      }
      const validUntil = version.validUntil?.toISOString?.().slice(0, 10) ?? null;
      if (validUntil && new Date().toISOString().slice(0, 10) > validUntil) {
        await prisma.proposalVersion.updateMany({
          where: { id: version.id, status: "PUBLISHED" },
          data: { status: "EXPIRED" },
        });
        return res.status(410).json({ error: "This proposal has expired." });
      }
      const expectedVersionNumber = Number(req.body?.expectedVersionNumber);
      if (!Number.isInteger(expectedVersionNumber) || expectedVersionNumber !== version.versionNumber) {
        return res.status(409).json({ error: "The proposal version changed. Refresh before accepting." });
      }
      if (req.body?.consentConfirmed !== true) {
        return res.status(400).json({ error: "Explicit consent is required before acceptance." });
      }
      const approverName = String(req.body?.approverName || "").trim().slice(0, 180);
      const approverContact = String(req.body?.approverContact || "").trim().slice(0, 320);
      if (!approverName || !approverContact) {
        return res.status(400).json({ error: "Client name and email are required for acceptance." });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approverContact)) {
        return res.status(400).json({ error: "Client email must be valid for acceptance." });
      }
      const rawRequestKey = String(req.body?.requestKey || "").trim().slice(0, 160);
      if (!rawRequestKey) return res.status(400).json({ error: "requestKey is required." });
      const acceptanceKey = crypto
        .createHash("sha256")
        .update(`${link.id}:${rawRequestKey}`)
        .digest("hex");
      const existingByKey = await prisma.proposalApprovalSnapshot.findUnique({
        where: { acceptanceKey },
      });
      if (existingByKey) {
        return res.json({
          accepted: existingByKey.status === "ACCEPTED",
          duplicate: true,
          acceptance: serializeAcceptance(existingByKey),
          billingSchedule: serializeVersion(version, { publicView: true }).billingSchedule,
        });
      }

      const clientKey = `access:${link.id}`;
      const selections = await prisma.proposalClientSelection.findMany({
        where: { proposalVersionId: version.id, clientKey },
        orderBy: { proposalVersionItemId: "asc" },
      });
      const pricedSelection = priceVersionSelections(version, selections);
      if (pricedSelection.error) return res.status(409).json({ error: pricedSelection.error });
      const acceptedAt = new Date();
      const selectionSnapshot = {
        clientKey,
        items: pricedSelection.commercial.items.map((item) => ({
          itemId: Number(item.key) || null,
          name: item.name,
          selected: item.selected,
          quantity: item.quantity,
          configuration: item.configuration,
        })),
      };
      const pricingSnapshot = {
        ...pricedSelection.commercial.totals,
        currency: pricedSelection.commercial.currency,
        billingSchedule: pricedSelection.commercial.billingSchedule,
      };
      const termsSnapshot = {
        validUntil,
        terms: version.terms ?? [],
        exclusions: version.exclusions ?? [],
      };
      const scopeSnapshot = {
        scope: version.scope,
        items: pricedSelection.commercial.items
          .filter((item) => item.selected)
          .map((item) => ({
            name: item.name,
            description: item.description,
            deliverables: item.deliverables,
            estimatedDelivery: item.estimatedDelivery,
            quantity: item.quantity,
            billingType: item.billingType,
            billingFrequency: item.billingFrequency,
          })),
      };

      let acceptance;
      try {
        acceptance = await prisma.$transaction(async (tx) => {
          const transitioned = await tx.proposalVersion.updateMany({
            where: { id: version.id, status: "PUBLISHED" },
            data: { status: "ACCEPTED" },
          });
          if (transitioned.count !== 1) {
            throw Object.assign(new Error("This proposal is no longer eligible for acceptance."), { status: 409 });
          }
          const data = {
            status: "ACCEPTED",
            accessLinkId: link.id,
            acceptanceKey,
            selectionSnapshot,
            pricingSnapshot,
            termsSnapshot,
            scopeSnapshot,
            termsVersion: ACCEPTANCE_TERMS_VERSION,
            consentConfirmed: true,
            approverName,
            approverContact,
            acceptedAt,
            revokedAt: null,
          };
          const snapshot = version.approvalSnapshot
            ? await tx.proposalApprovalSnapshot.update({
                where: { id: version.approvalSnapshot.id },
                data,
              })
            : await tx.proposalApprovalSnapshot.create({
                data: { proposalVersionId: version.id, ...data },
              });
          await tx.proposalBillingScheduleItem.updateMany({
            where: { proposalVersionId: version.id, type: { in: ["FULL", "DEPOSIT"] } },
            data: {
              status: "ACTIVE",
              generationRule: "ON_ACCEPTANCE",
              startDate: acceptedAt,
            },
          });
          await tx.proposalBillingScheduleItem.updateMany({
            where: { proposalVersionId: version.id, type: { in: ["MILESTONE", "BALANCE"] } },
            data: { status: "PENDING", generationRule: "MANUAL" },
          });
          await tx.proposalBillingScheduleItem.updateMany({
            where: { proposalVersionId: version.id, type: "RECURRING" },
            data: {
              status: "ACTIVE",
              generationRule: "SCHEDULED",
              startDate: acceptedAt,
              nextBillingDate: acceptedAt,
            },
          });
          return snapshot;
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (error?.status === 409) return res.status(409).json({ error: error.message });
        if (error?.code === "P2002") {
          const duplicate = await prisma.proposalApprovalSnapshot.findUnique({
            where: { proposalVersionId: version.id },
          });
          if (duplicate?.status === "ACCEPTED") {
            return res.json({
              accepted: true,
              duplicate: true,
              acceptance: serializeAcceptance(duplicate),
              billingSchedule: serializeVersion(version, { publicView: true }).billingSchedule,
            });
          }
        }
        throw error;
      }
      await auditWriter?.({
        organizationId: version.proposal.organizationId,
        action: "PROPOSAL_VERSION_ACCEPTED",
        targetType: "proposal-version",
        targetId: String(version.id),
        category: "financial",
        summary: `Client accepted proposal version ${version.versionNumber}`,
        metadata: { proposalId: version.proposalId, acceptanceId: acceptance.id },
        requestId: req.requestId,
      });
      let notification = { status: "unavailable" };
      if (acceptanceNotifier) {
        try {
          await acceptanceNotifier({
            recipient: approverContact,
            approverName,
            proposalId: version.proposalId,
            versionNumber: version.versionNumber,
            title: version.title,
            acceptedAt,
            currency: pricedSelection.commercial.currency,
            oneTimeTotal: pricedSelection.commercial.totals.oneTimeTotal,
            billingSchedule: pricedSelection.commercial.billingSchedule,
          });
          notification = { status: "sent" };
        } catch {
          notification = { status: "failed" };
          await auditWriter?.({
            organizationId: version.proposal.organizationId,
            action: "PROPOSAL_ACCEPTANCE_NOTIFICATION_FAILED",
            targetType: "proposal-version",
            targetId: String(version.id),
            category: "system",
            summary: "Proposal acceptance was committed but its confirmation notification failed",
            metadata: { proposalId: version.proposalId, acceptanceId: acceptance.id },
            requestId: req.requestId,
          }).catch(() => null);
        }
      }
      return res.status(201).json({
        accepted: true,
        duplicate: false,
        acceptance: serializeAcceptance(acceptance),
        billingSchedule: pricedSelection.commercial.billingSchedule,
        invoiceReady: false,
        notification,
      });
    },

    viewInteractive: async (req, res) => {
      const token = String(req.params.token || "").trim();
      if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).json({ error: "Proposal link is invalid." });
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const link = await prisma.proposalAccessLink.findUnique({
        where: { tokenHash },
        include: { proposalVersion: { include: versionInclude } },
      });
      if (!link || link.revokedAt) return res.status(404).json({ error: "Proposal link is unavailable." });
      if (link.expiresAt <= new Date()) return res.status(410).json({ error: "Proposal link has expired." });
      if (!PUBLIC_READABLE_VERSION_STATUSES.has(link.proposalVersion.status)) {
        return res.status(409).json({ error: "This proposal version is no longer available." });
      }
      const publicValidUntil = dateKey(link.proposalVersion.validUntil);
      if (
        link.proposalVersion.status === "PUBLISHED" &&
        publicValidUntil &&
        new Date().toISOString().slice(0, 10) > publicValidUntil
      ) {
        await prisma.proposalVersion.updateMany({
          where: { id: link.proposalVersion.id, status: "PUBLISHED" },
          data: { status: "EXPIRED" },
        });
        return res.status(410).json({ error: "This proposal has expired." });
      }
      await prisma.proposalAccessLink.update({
        where: { id: link.id }, data: { lastAccessedAt: new Date() },
      });
      const clientKey = `access:${link.id}`;
      const selections = await prisma.proposalClientSelection.findMany({
        where: { proposalVersionId: link.proposalVersion.id, clientKey },
        orderBy: { proposalVersionItemId: "asc" },
      });
      const pricedSelection = priceVersionSelections(link.proposalVersion, selections);
      if (pricedSelection.error) return res.status(409).json({ error: pricedSelection.error });
      return res.json({
        version: serializeVersion(link.proposalVersion, { publicView: true }),
        selections: selections.map((selection) => ({
          itemId: selection.proposalVersionItemId,
          selected: selection.selected,
          quantity: numberValue(selection.quantity),
          configuration: selection.configuration,
        })),
        estimatedTotals: pricedSelection.commercial.totals,
        billingSchedule: pricedSelection.commercial.billingSchedule,
        acceptance: serializeAcceptance(link.proposalVersion.approvalSnapshot),
      });
    },

    listInteractiveVersions: async (req, res) => {
      const token = String(req.params.token || "").trim();
      if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).json({ error: "Proposal link is invalid." });
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const link = await prisma.proposalAccessLink.findUnique({
        where: { tokenHash },
        include: {
          proposalVersion: {
            include: { proposal: { select: { organizationId: true } } },
          },
        },
      });
      if (!link || link.revokedAt) return res.status(404).json({ error: "Proposal link is unavailable." });
      if (link.expiresAt <= new Date()) return res.status(410).json({ error: "Proposal link has expired." });
      if (!PUBLIC_READABLE_VERSION_STATUSES.has(link.proposalVersion.status)) {
        return res.status(409).json({ error: "This proposal version is no longer available." });
      }
      const versions = await prisma.proposalVersion.findMany({
        where: {
          proposalId: link.proposalVersion.proposalId,
          status: { in: ["PUBLISHED", "ACCEPTED", "SUPERSEDED"] },
        },
        select: { id: true, versionNumber: true, status: true, title: true, publishedAt: true },
        orderBy: { versionNumber: "desc" },
      });
      return res.json({ versions });
    },

    updateSelections: async (req, res) => {
      const token = String(req.params.token || "").trim();
      if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).json({ error: "Proposal link is invalid." });
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const link = await prisma.proposalAccessLink.findUnique({
        where: { tokenHash },
        include: { proposalVersion: { include: versionInclude } },
      });
      if (!link || link.revokedAt) return res.status(404).json({ error: "Proposal link is unavailable." });
      if (link.expiresAt <= new Date()) return res.status(410).json({ error: "Proposal link has expired." });
      const validation = validateClientSelections({
        versionStatus: link.proposalVersion.status,
        items: link.proposalVersion.items,
        selections: req.body?.selections,
      });
      if (validation.error) return res.status(400).json({ error: validation.error });
      const clientKey = `access:${link.id}`;
      await prisma.$transaction(
        validation.selections.map((selection) =>
          prisma.proposalClientSelection.upsert({
            where: {
              proposalVersionItemId_clientKey: {
                proposalVersionItemId: selection.itemId,
                clientKey,
              },
            },
            create: {
              proposalVersionId: link.proposalVersion.id,
              proposalVersionItemId: selection.itemId,
              clientKey,
              selected: selection.selected,
              quantity: selection.quantity,
              configuration: selection.configuration,
            },
            update: {
              selected: selection.selected,
              quantity: selection.quantity,
              configuration: selection.configuration,
            },
          })
        )
      );
      const savedSelections = await prisma.proposalClientSelection.findMany({
        where: { proposalVersionId: link.proposalVersion.id, clientKey },
        orderBy: { proposalVersionItemId: "asc" },
      });
      const pricedSelection = priceVersionSelections(link.proposalVersion, savedSelections);
      if (pricedSelection.error) {
        return res.status(400).json({ error: pricedSelection.error });
      }
      return res.json({
        selections: savedSelections.map((selection) => ({
          itemId: selection.proposalVersionItemId,
          selected: selection.selected,
          quantity: numberValue(selection.quantity),
          configuration: selection.configuration,
        })),
        estimatedTotals: pricedSelection.commercial.totals,
        billingSchedule: pricedSelection.commercial.billingSchedule,
      });
    },

    submitClientMessage: async (req, res) => {
      const token = String(req.params.token || "").trim();
      if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).json({ error: "Proposal link is invalid." });
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const link = await prisma.proposalAccessLink.findUnique({
        where: { tokenHash },
        include: {
          proposalVersion: {
            include: { proposal: { select: { organizationId: true } } },
          },
        },
      });
      if (!link || link.revokedAt) return res.status(404).json({ error: "Proposal link is unavailable." });
      if (link.expiresAt <= new Date()) return res.status(410).json({ error: "Proposal link has expired." });
      if (link.proposalVersion.status !== "PUBLISHED") {
        return res.status(409).json({ error: "Client responses are only accepted for published versions." });
      }
      const message = String(req.body?.message || "").trim().slice(0, 5000);
      if (!message) return res.status(400).json({ error: "message is required." });
      const kind = String(req.body?.kind || "REVISION").trim().toUpperCase();
      if (!["REVISION", "QUESTION", "DECLINE"].includes(kind)) {
        return res.status(400).json({ error: "kind must be REVISION, QUESTION, or DECLINE." });
      }
      const rawRequestKey = String(req.body?.requestKey || "").trim().slice(0, 160) || null;
      const requestKey = rawRequestKey
        ? crypto.createHash("sha256").update(`${link.id}:${rawRequestKey}`).digest("hex")
        : null;
      if (requestKey) {
        const existing = await prisma.proposalRevisionRequest.findUnique({ where: { requestKey } });
        if (existing) {
          return res.status(200).json({
            request: { id: existing.id, kind: existing.kind, status: existing.status },
            duplicate: true,
          });
        }
      }
      const messageData = {
          proposalId: link.proposalVersion.proposalId,
          proposalVersionId: link.proposalVersion.id,
          kind,
          message,
          requesterName: String(req.body?.requesterName || "").trim().slice(0, 160) || null,
          requesterContact: String(req.body?.requesterContact || "").trim().slice(0, 240) || null,
          requestKey,
        };
      const revision = kind === "DECLINE"
        ? await prisma.$transaction(async (tx) => {
            const created = await tx.proposalRevisionRequest.create({ data: messageData });
            const transitioned = await tx.proposalVersion.updateMany({
              where: { id: link.proposalVersion.id, status: "PUBLISHED" },
              data: { status: "DECLINED" },
            });
            if (transitioned.count !== 1) {
              throw Object.assign(new Error("This proposal can no longer be declined."), { status: 409 });
            }
            return created;
          }, { isolationLevel: "Serializable" })
        : await prisma.proposalRevisionRequest.create({ data: messageData });
      await auditWriter?.({
        organizationId: link.proposalVersion.proposal.organizationId,
        action: `PROPOSAL_CLIENT_${kind}`,
        targetType: "proposal-version",
        targetId: String(link.proposalVersion.id),
        summary: `Client submitted a ${kind.toLowerCase()} response for a proposal`,
        metadata: { proposalId: link.proposalVersion.proposalId, requestId: revision.id },
        requestId: req.requestId,
      });
      return res.status(201).json({
        request: { id: revision.id, kind: revision.kind, status: revision.status },
        duplicate: false,
      });
    },
  };
};

export const registerStructuredProposalRoutes = (
  app,
  { prisma, authMiddleware, requireAdmin, isGlobalAdmin, auditWriter, publicRateLimit, acceptanceNotifier, proposalNotifier, faakoPool, proposalAi }
) => {
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin, auditWriter, acceptanceNotifier, proposalNotifier, faakoPool });
  const publicGuard = publicRateLimit || ((_req, _res, next) => next());
  const publicProposalGuard = (req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    return publicGuard(req, res, next);
  };
  app.get("/api/proposals/structured", authMiddleware, requireAdmin, asyncHandler(handlers.listStructuredProposals));
  app.get("/api/proposals/client-options", authMiddleware, requireAdmin, asyncHandler(handlers.listClientOptions));
  app.post("/api/proposals/ai/generate", authMiddleware, requireAdmin, asyncHandler(createProposalAiHandler({ prisma, ...proposalAi })));
  app.post("/api/proposals/pricing-preview", authMiddleware, requireAdmin, asyncHandler(handlers.previewPricing));
  app.get("/api/proposals/catalogue", authMiddleware, requireAdmin, asyncHandler(handlers.listCatalogue));
  app.post("/api/proposals/catalogue", authMiddleware, requireAdmin, asyncHandler(handlers.createCatalogueItem));
  app.patch("/api/proposals/catalogue/:catalogueItemId", authMiddleware, requireAdmin, asyncHandler(handlers.updateCatalogueItem));
  app.get("/api/proposals/packages", authMiddleware, requireAdmin, asyncHandler(handlers.listPackages));
  app.post("/api/proposals/packages", authMiddleware, requireAdmin, asyncHandler(handlers.createPackage));
  app.get("/api/proposals/:proposalId/versions", authMiddleware, requireAdmin, asyncHandler(handlers.listVersions));
  app.post("/api/proposals/:proposalId/versions", authMiddleware, requireAdmin, asyncHandler(handlers.createVersion));
  app.patch("/api/proposals/:proposalId/versions/:versionId", authMiddleware, requireAdmin, asyncHandler(handlers.updateVersion));
  app.post("/api/proposals/:proposalId/versions/:versionId/publish", authMiddleware, requireAdmin, asyncHandler(handlers.publishVersion));
  app.post("/api/proposals/:proposalId/versions/:versionId/withdraw", authMiddleware, requireAdmin, asyncHandler(handlers.withdrawVersion));
  app.post("/api/proposals/:proposalId/versions/:versionId/access-links", authMiddleware, requireAdmin, asyncHandler(handlers.prepareAccessLink));
  app.post("/api/proposals/:proposalId/versions/:versionId/send", authMiddleware, requireAdmin, asyncHandler(handlers.sendPublishedVersion));
  app.patch("/api/proposals/:proposalId/versions/:versionId/access-links/:linkId/revoke", authMiddleware, requireAdmin, asyncHandler(handlers.revokeAccessLink));
  app.post("/api/proposals/:proposalId/versions/:versionId/approval-snapshot", authMiddleware, requireAdmin, asyncHandler(handlers.prepareApprovalSnapshot));
  app.post("/api/proposals/:proposalId/versions/:versionId/billing/:billingItemId/invoice", authMiddleware, requireAdmin, asyncHandler(handlers.generateBillingInvoice));
  app.patch("/api/proposals/:proposalId/versions/:versionId/billing/:billingItemId", authMiddleware, requireAdmin, asyncHandler(handlers.updateBillingScheduleStatus));
  app.post("/api/proposals/:proposalId/versions/:versionId/project", authMiddleware, requireAdmin, asyncHandler(handlers.linkAcceptedProject));
  app.get("/api/proposals/:proposalId/versions/:versionId/revision-requests", authMiddleware, requireAdmin, asyncHandler(handlers.listRevisionRequests));
  app.patch("/api/proposals/:proposalId/versions/:versionId/revision-requests/:requestId", authMiddleware, requireAdmin, asyncHandler(handlers.resolveRevisionRequest));
  app.get("/api/proposals/interactive/:token", publicProposalGuard, asyncHandler(handlers.viewInteractive));
  app.get("/api/proposals/interactive/:token/versions", publicProposalGuard, asyncHandler(handlers.listInteractiveVersions));
  app.put("/api/proposals/interactive/:token/selections", publicProposalGuard, asyncHandler(handlers.updateSelections));
  app.post("/api/proposals/interactive/:token/accept", publicProposalGuard, asyncHandler(handlers.acceptInteractive));
  app.post("/api/proposals/interactive/:token/messages", publicProposalGuard, asyncHandler(handlers.submitClientMessage));
  app.post("/api/proposals/interactive/:token/revision-requests", publicProposalGuard, asyncHandler((req, res) => {
    req.body = { ...req.body, kind: "REVISION" };
    return handlers.submitClientMessage(req, res);
  }));
};
