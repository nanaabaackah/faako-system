import express from "express";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;
const N_A = "N/A";
const CONVERTED_STATUS = "CONVERTED";
const PROJECT_EXTERNAL_REF_PREFIX = "faako-onboarding";
const PROJECT_DESCRIPTION_MAX_LENGTH = 2000;
const PROJECT_TITLE_MAX_LENGTH = 180;
const PROJECT_CURRENCY_VALUES = new Set(["CAD", "GHS"]);

export const FAAKO_ONBOARDING_STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "APPROVED", label: "Approved" },
  { value: "SETUP_IN_PROGRESS", label: "Setup In Progress" },
  { value: "CONVERTED", label: "Converted" },
  { value: "CLOSED", label: "Closed" },
];

const LEGACY_STATUS_LABELS = {
  REVIEWING: "Reviewed",
};

const STATUS_VALUE_SET = new Set(FAAKO_ONBOARDING_STATUS_OPTIONS.map((option) => option.value));
const STATUS_LABEL_BY_VALUE = new Map(
  FAAKO_ONBOARDING_STATUS_OPTIONS.map((option) => [option.value, option.label])
);

const SIGNUP_REQUEST_COLUMNS = [
  "id",
  "companyName",
  "email",
  "contactName",
  "phone",
  "teamSize",
  "currency",
  "websiteUrl",
  "logoUrl",
  "brandPrimaryColor",
  "brandSecondaryColor",
  "packageTier",
  "requestedModules",
  "businessType",
  "currentWorkflow",
  "communicationChannels",
  "timelinePreference",
  "projectDetails",
  "painPoints",
  "additionalNotes",
  "status",
  "source",
  "createdAt",
  "updatedAt",
  "onboardingIntake",
  "setupChecklist",
  "internalNotes",
  "assignedOwner",
  "activityTimeline",
  "emailDelivery",
  "pdfSummary",
  "archivedAt",
  "archivedBy",
  "managementUpdatedAt",
  "managementUpdatedBy",
];

const WIZARD_FIELD_SCHEMA = {
  company: {
    businessName: "Business name",
    tradingName: "Trading name",
    mainEmail: "Main email",
    mainPhone: "Main phone",
    location: "Location",
    websiteDomain: "Website or domain",
    currency: "Currency",
    logoStatus: "Logo",
  },
  contact: {
    businessName: "Business name",
    name: "Contact name",
    roleTitle: "Role/title",
    email: "Email",
    phoneWhatsapp: "Phone/WhatsApp",
    preferredContactMethod: "Preferred contact method",
  },
  service: {
    primaryProduct: "Main service needed",
    extraProducts: "Related services",
    selectedServices: "Selected services",
    selectedServiceLabels: "Selected service labels",
    projectReason: "Why the service is needed now",
    desiredOutcome: "Successful outcome",
  },
  business: {
    industry: "Business type / industry",
    currentWebsite: "Current website or social page",
    customerType: "Customers served",
    teamSize: "Team size",
    toolsUsedLabels: "Tools currently used",
    currentTools: "Other current tools",
    currentProcess: "Current process",
    painPoints: "Pain points",
  },
  brand: {
    sharedContentLink: "Google Drive or shared folder link",
    colourScheme: "Colour scheme or brand colours",
    brandFeeling: "Design feeling",
    logoStatus: "Logo status",
    contentOwner: "Content owner",
    mustAvoid: "Design/content should avoid",
    contentNotes: "Content notes",
  },
  operations: {
    offerings: "What the business sells/provides",
    staffCount: "Number of staff/users",
    locations: "Locations/branches",
    workflowProblems: "Current workflow problems",
    priorityGoals: "Priority goals",
  },
  modules: {
    selected: "Selected modules",
    customNotes: "Custom module notes",
  },
  payments: {
    acceptsOnlinePayments: "Accepts online payments",
    paymentMethods: "Payment methods",
    paystackAccountStatus: "Paystack account status",
    paymentNotes: "Payment notes",
  },
  communications: {
    customerNotificationChannels: "Customer notification channels",
    emailDomain: "Business email/domain",
    needsBusinessEmailSetup: "Needs business email setup",
    whatsappNumber: "WhatsApp number",
    smsNeeded: "SMS needed",
  },
  domain: {
    hasDomain: "Has domain",
    desiredDomain: "Desired domain",
    needsHostingSetup: "Needs hosting setup",
    launchTimeline: "Launch timeline",
  },
  users: {
    adminUsers: "Admin users",
    staffRoles: "Staff roles",
    customerAccess: "Customer access",
  },
  security: {
    dataSensitivity: "Sensitive data handled",
    privacyConcerns: "Data/privacy concerns",
    consent: "Setup review consent",
  },
  website: {
    websiteType: "Website work type",
    websiteGoal: "What the website should explain",
    targetAudience: "Main website audience",
    pagesNeededLabels: "Pages needed",
    featuresNeededLabels: "Website features needed",
    mainAction: "What visitors should do",
    mustHaveInfo: "Must-have website information",
    contentReady: "Content and images ready",
    updateFrequency: "Website update frequency",
    exampleSites: "Example websites",
  },
  portal: {
    audience: "Portal users",
    portalPurpose: "Portal purpose",
    informationShown: "Information users should see",
    actionsNeeded: "User actions needed",
    needsDifferentAccess: "Different access needed",
  },
  shop: {
    sellWhat: "What will be sold or paid for",
    itemCount: "Product/service count",
    paymentMethods: "Payment methods",
    deliveryMethod: "Delivery or pickup method",
    trackInventory: "Track stock or availability",
  },
  dashboard: {
    numbersToTrack: "Numbers or updates to track",
    dataSources: "Current data sources",
    reportFrequency: "Report frequency",
    viewers: "Dashboard viewers",
    needsExports: "Exports or scheduled summaries needed",
  },
  operationsSystem: {
    workflowsToManage: "Workflows to manage",
    workflowSteps: "Current workflow steps",
    peopleAndLocations: "People and locations",
    recordsToImport: "Records to import",
    needsRoles: "Different staff access needed",
  },
  automation: {
    repetitiveTasks: "Repeated task to reduce",
    toolsToConnect: "Tools to connect",
    alertChannels: "Alert/update channels",
    taskFrequency: "Task frequency",
    exceptionHandling: "What should happen when something goes wrong",
  },
  integrations: {
    selectedIntegrationLabels: "Selected integrations",
    existingAccounts: "Existing accounts or tools",
    integrationNotes: "Integration notes",
  },
  launch: {
    timeline: "Preferred start timeline",
    budgetComfort: "Budget comfort",
    hasDecisionMaker: "Decision maker available",
    filesReady: "Brand files/photos/content ready",
    bestTimeToContact: "Best time to contact",
    extraNotes: "Extra notes",
    consent: "Contact consent",
  },
};

const normalizeText = (value, maxLength = 4000) => {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, maxLength);
};

const normalizeStatus = (value) => {
  const normalized = normalizeText(value, 80).toUpperCase();
  if (normalized === "REVIEWING") return "REVIEWED";
  return STATUS_VALUE_SET.has(normalized) ? normalized : "";
};

const normalizeProjectCurrency = (value) => {
  const normalized = normalizeText(value, 20).toUpperCase();
  return PROJECT_CURRENCY_VALUES.has(normalized) ? normalized : null;
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value.map((item) => normalizeText(item, 240)).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(/[,\n;]/)
    .map((item) => normalizeText(item, 240))
    .filter(Boolean);
};

const normalizeJson = (value, fallback = null) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toIso = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const formatWizardValue = (value) => {
  if (value === undefined || value === null) return N_A;
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => formatWizardValue(item)).join(", ") : N_A;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, formatWizardValue(item)])
      .filter(([, item]) => item !== N_A);
    return entries.length ? entries.map(([key, item]) => `${key}: ${item}`).join("; ") : N_A;
  }
  const normalized = String(value).trim();
  return normalized || N_A;
};

const isMeaningfulWizardValue = (value) => {
  const normalized = normalizeText(value, 4000);
  return Boolean(normalized && normalized !== N_A);
};

const sectionLabel = (key) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const collectKnownFieldKeys = () => {
  const known = new Set();
  Object.entries(WIZARD_FIELD_SCHEMA).forEach(([sectionKey, fields]) => {
    Object.keys(fields).forEach((fieldKey) => known.add(`${sectionKey}.${fieldKey}`));
  });
  return known;
};

const flattenUnknownFields = (value, knownKeys, prefix = "") => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return flattenUnknownFields(item, knownKeys, path);
    }
    if (knownKeys.has(path)) return [];
    const formattedValue = formatWizardValue(item);
    return isMeaningfulWizardValue(formattedValue)
      ? [{ label: sectionLabel(path), value: formattedValue }]
      : [];
  });
};

export const buildWizardSections = (intakeValue) => {
  const intake = normalizeJson(intakeValue, {}) || {};
  const sections = Object.entries(WIZARD_FIELD_SCHEMA)
    .map(([sectionKey, fields]) => ({
      key: sectionKey,
      title: sectionLabel(sectionKey),
      fields: Object.entries(fields)
        .map(([fieldKey, label]) => ({
          key: `${sectionKey}.${fieldKey}`,
          label,
          value: formatWizardValue(intake?.[sectionKey]?.[fieldKey]),
        }))
        .filter((field) => isMeaningfulWizardValue(field.value)),
    }))
    .filter((section) => section.fields.length);

  const additionalFields = flattenUnknownFields(intake, collectKnownFieldKeys());
  if (additionalFields.length) {
    sections.push({
      key: "additional",
      title: "Additional responses",
      fields: additionalFields,
    });
  }

  return sections;
};

const buildStatusMeta = (value) => {
  const normalized = normalizeText(value || "NEW", 80).toUpperCase();
  const mapped = normalized === "REVIEWING" ? "REVIEWED" : normalized;
  return {
    value: mapped,
    sourceValue: normalized,
    label: STATUS_LABEL_BY_VALUE.get(mapped) || LEGACY_STATUS_LABELS[normalized] || sectionLabel(mapped),
  };
};

const buildPdfSummary = (row) => {
  const pdfSummary = normalizeJson(row.pdfSummary, null);
  if (pdfSummary && typeof pdfSummary === "object" && !Array.isArray(pdfSummary)) {
    return {
      stored: Boolean(pdfSummary.stored && pdfSummary.downloadPath),
      fileName: normalizeText(pdfSummary.fileName, 240) || null,
      generatedAt: toIso(pdfSummary.generatedAt),
      downloadPath: normalizeText(pdfSummary.downloadPath, 500) || null,
      note: normalizeText(pdfSummary.note, 500) || null,
    };
  }
  return {
    stored: false,
    fileName: null,
    generatedAt: null,
    downloadPath: null,
    note: "No stored PDF summary is available for this submission.",
  };
};

const normalizeTimeline = (value) => {
  const source = normalizeJson(value, []);
  if (!Array.isArray(source)) return [];
  return source
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      type: normalizeText(entry.type, 80) || "activity",
      label: normalizeText(entry.label, 160) || "Activity",
      at: toIso(entry.at) || new Date().toISOString(),
      by: normalizeText(entry.by, 160) || "System",
      from: entry.from === undefined || entry.from === null ? null : normalizeText(entry.from, 240),
      to: entry.to === undefined || entry.to === null ? null : normalizeText(entry.to, 240),
      note: normalizeText(entry.note, 500) || null,
    }))
    .slice(-60);
};

const buildActivityTimeline = (row) => {
  const timeline = [
    {
      type: "submitted",
      label: "Submission received",
      at: toIso(row.createdAt) || toIso(row.updatedAt) || new Date().toISOString(),
      by: "Faako website",
      note: normalizeText(row.source, 120) || "website",
    },
    ...normalizeTimeline(row.activityTimeline),
  ];
  const emailDelivery = normalizeJson(row.emailDelivery, null);
  if (emailDelivery?.updatedAt || emailDelivery?.status) {
    timeline.push({
      type: "email_delivery",
      label: `Email delivery ${normalizeText(emailDelivery.status, 80) || "recorded"}`,
      at: toIso(emailDelivery.updatedAt) || toIso(row.updatedAt) || new Date().toISOString(),
      by: "Faako API",
      note: Array.isArray(emailDelivery.attempts)
        ? `${emailDelivery.attempts.length} email attempt(s) recorded`
        : null,
    });
  }
  return timeline.sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
};

const formatDescriptionList = (items = []) =>
  Array.isArray(items) && items.length ? items.join(", ") : "";

const getDescriptionValue = (value, maxLength = 500) => {
  const normalized = normalizeText(value, maxLength);
  return normalized && normalized !== N_A ? normalized : "";
};

const buildConvertedProjectExternalRef = (row) =>
  normalizeText(`${PROJECT_EXTERNAL_REF_PREFIX}:${row.id}`, 160);

const getConvertedProjectClientName = (row) =>
  getDescriptionValue(row.companyName, 180) ||
  getDescriptionValue(row.contactName, 180) ||
  getDescriptionValue(row.email, 180) ||
  "Faako client";

const getConvertedProjectPriority = (row) => {
  const timeline = normalizeText(row.timelinePreference, 160).toLowerCase();
  if (/\b(asap|urgent|immediate|this week|today|tomorrow|rush)\b/.test(timeline)) return "URGENT";
  if (/\b(soon|this month|2 weeks|two weeks)\b/.test(timeline)) return "HIGH";
  return "MEDIUM";
};

const buildConvertedProjectTitle = (row) => {
  const clientName = getConvertedProjectClientName(row);
  const packageTier = getDescriptionValue(row.packageTier, 80);
  const suffix = packageTier ? `${packageTier} setup` : "client setup";
  return normalizeText(`${clientName} - ${suffix}`, PROJECT_TITLE_MAX_LENGTH);
};

const buildConvertedProjectDescription = (row) => {
  const intake = normalizeJson(row.onboardingIntake, {}) || {};
  const formLabel =
    getDescriptionValue(intake?.meta?.formLabel || row.formLabel, 120) ||
    getDescriptionValue(row.source, 120) ||
    "Faako form submission";
  const contactName = getDescriptionValue(row.contactName, 160);
  const email = getDescriptionValue(row.email, 254);
  const contact = [contactName, email ? `<${email}>` : ""].filter(Boolean).join(" ");
  const requestedModules = formatDescriptionList(normalizeArray(row.requestedModules));
  const setupChecklist = formatDescriptionList(normalizeArray(normalizeJson(row.setupChecklist, row.setupChecklist)));
  const wizardFields = buildWizardSections(intake)
    .flatMap((section) =>
      section.fields.map((field) => ({
        section: section.title,
        label: field.label,
        value: field.value,
      }))
    )
    .filter((field) => getDescriptionValue(field.value, 500))
    .slice(0, 10);

  const lines = [
    `Created from Faako form submission ${row.id}.`,
    `Form: ${formLabel}`,
    contact ? `Contact: ${contact}` : "",
    getDescriptionValue(row.phone, 80) ? `Phone: ${getDescriptionValue(row.phone, 80)}` : "",
    getDescriptionValue(row.packageTier, 120) ? `Package: ${getDescriptionValue(row.packageTier, 120)}` : "",
    requestedModules ? `Requested modules: ${requestedModules}` : "",
    setupChecklist ? `Setup checklist: ${setupChecklist}` : "",
    getDescriptionValue(row.businessType, 160) ? `Business type: ${getDescriptionValue(row.businessType, 160)}` : "",
    getDescriptionValue(row.timelinePreference, 160) ? `Timeline: ${getDescriptionValue(row.timelinePreference, 160)}` : "",
    getDescriptionValue(row.websiteUrl, 500) ? `Website: ${getDescriptionValue(row.websiteUrl, 500)}` : "",
    getDescriptionValue(row.currentWorkflow, 500) ? `Current workflow: ${getDescriptionValue(row.currentWorkflow, 500)}` : "",
    getDescriptionValue(row.projectDetails, 700) ? `Project details: ${getDescriptionValue(row.projectDetails, 700)}` : "",
    getDescriptionValue(row.painPoints, 700) ? `Pain points: ${getDescriptionValue(row.painPoints, 700)}` : "",
    getDescriptionValue(row.additionalNotes, 900) ? `Additional notes: ${getDescriptionValue(row.additionalNotes, 900)}` : "",
  ].filter(Boolean);

  if (wizardFields.length) {
    lines.push(
      "Submitted answers:",
      ...wizardFields.map((field) => `${field.section} - ${field.label}: ${field.value}`)
    );
  }

  return normalizeText(lines.join("\n"), PROJECT_DESCRIPTION_MAX_LENGTH) || null;
};

export const buildConvertedProjectPayload = (row, { organizationId, ownerUserId = null } = {}) => ({
  organizationId,
  ownerUserId,
  title: buildConvertedProjectTitle(row),
  clientName: getConvertedProjectClientName(row),
  projectType: "EXTERNAL",
  stage: "ACTIVE",
  priority: getConvertedProjectPriority(row),
  currency: normalizeProjectCurrency(row.currency),
  budgetAmount: null,
  dueDate: null,
  description: buildConvertedProjectDescription(row),
  externalRef: buildConvertedProjectExternalRef(row),
});

const serializeConvertedProject = (project) =>
  project
    ? {
        id: project.id,
        organizationId: project.organizationId,
        organization: project.organization
          ? {
              id: project.organization.id,
              name: project.organization.name,
              slug: project.organization.slug,
            }
          : null,
        ownerUserId: project.ownerUserId ?? null,
        ownerUser: project.ownerUser
          ? {
              id: project.ownerUser.id,
              fullName: project.ownerUser.fullName,
              email: project.ownerUser.email,
            }
          : null,
        title: project.title,
        clientName: project.clientName ?? null,
        projectType: project.projectType,
        stage: project.stage,
        priority: project.priority,
        currency: project.currency ?? null,
        budgetAmount:
          project.budgetAmount === null || project.budgetAmount === undefined
            ? null
            : typeof project.budgetAmount?.toNumber === "function"
              ? project.budgetAmount.toNumber()
              : Number(project.budgetAmount),
        dueDate: project.dueDate ? project.dueDate.toISOString() : null,
        description: project.description ?? null,
        externalRef: project.externalRef ?? null,
        archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
        createdAt: project.createdAt ? project.createdAt.toISOString() : null,
        updatedAt: project.updatedAt ? project.updatedAt.toISOString() : null,
      }
    : null;

const resolveConvertedProjectOwnerId = async ({ prisma, row, user, organizationId }) => {
  if (!prisma?.user?.findFirst) return null;

  const assignedOwner = normalizeText(row.assignedOwner, 160);
  if (assignedOwner) {
    const owner = await prisma.user.findFirst({
      where: {
        email: assignedOwner,
        organizationId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (owner) return owner.id;
  }

  const fallbackOwnerId = Number(user?.userId);
  if (!Number.isInteger(fallbackOwnerId) || fallbackOwnerId <= 0) return null;
  const fallbackOwner = await prisma.user.findFirst({
    where: {
      id: fallbackOwnerId,
      organizationId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return fallbackOwner?.id ?? null;
};

const ensureProjectForConvertedSubmission = async ({ prisma, row, user }) => {
  if (!prisma?.project?.findFirst || !prisma?.project?.create) {
    return { errorStatus: 503, error: "Project workspace is not available." };
  }

  const organizationId = Number(user?.organizationId);
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return {
      errorStatus: 400,
      error: "Converted submissions need an organization scope before a project can be created.",
    };
  }

  const include = {
    organization: { select: { id: true, name: true, slug: true } },
    ownerUser: { select: { id: true, fullName: true, email: true } },
  };
  const externalRef = buildConvertedProjectExternalRef(row);
  const existingProject = await prisma.project.findFirst({
    where: { organizationId, externalRef },
    include,
  });

  if (existingProject) {
    return {
      created: false,
      project: serializeConvertedProject(existingProject),
    };
  }

  const ownerUserId = await resolveConvertedProjectOwnerId({ prisma, row, user, organizationId });
  const project = await prisma.project.create({
    data: buildConvertedProjectPayload(row, { organizationId, ownerUserId }),
    include,
  });

  return {
    created: true,
    project: serializeConvertedProject(project),
  };
};

export const serializeFaakoOnboardingSubmission = (row, { includeDetail = false } = {}) => {
  const intake = normalizeJson(row.onboardingIntake, null);
  const status = buildStatusMeta(row.status);
  const requestedModules = normalizeArray(row.requestedModules);
  const setupChecklist = normalizeArray(normalizeJson(row.setupChecklist, row.setupChecklist));
  const formType = normalizeText(intake?.meta?.formType || row.formType, 80) || "client-onboarding";
  const formLabel =
    normalizeText(intake?.meta?.formLabel || row.formLabel, 120) ||
    (formType === "client-setup" ? "Client setup form" : "Client onboarding intake");

  return {
    id: row.id,
    companyName: normalizeText(row.companyName, 180) || N_A,
    email: normalizeText(row.email, 254) || N_A,
    contactName: normalizeText(row.contactName, 160) || N_A,
    phone: normalizeText(row.phone, 80) || N_A,
    packageTier: normalizeText(row.packageTier, 120) || N_A,
    requestedModules,
    selectedModules: requestedModules,
    setupChecklist,
    businessType: normalizeText(row.businessType, 120) || N_A,
    timelinePreference: normalizeText(row.timelinePreference, 120) || N_A,
    status,
    source: normalizeText(row.source, 120) || "website",
    formType,
    formLabel,
    assignedOwner: normalizeText(row.assignedOwner, 160) || "",
    internalNotes: normalizeText(row.internalNotes, 12000) || "",
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    archivedAt: toIso(row.archivedAt),
    archivedBy: normalizeText(row.archivedBy, 160) || "",
    managementUpdatedAt: toIso(row.managementUpdatedAt),
    managementUpdatedBy: normalizeText(row.managementUpdatedBy, 160) || "",
    emailDelivery: normalizeJson(row.emailDelivery, null),
    pdfSummary: buildPdfSummary(row),
    ...(includeDetail
      ? {
          websiteUrl: normalizeText(row.websiteUrl, 500) || N_A,
          currency: normalizeText(row.currency, 20) || N_A,
          teamSize: normalizeText(row.teamSize, 80) || N_A,
          currentWorkflow: normalizeText(row.currentWorkflow, 4000) || N_A,
          projectDetails: normalizeText(row.projectDetails, 4000) || N_A,
          painPoints: normalizeText(row.painPoints, 4000) || N_A,
          additionalNotes: normalizeText(row.additionalNotes, 8000) || N_A,
          onboardingIntake: intake,
          wizardSections: buildWizardSections(intake),
          activityTimeline: buildActivityTimeline(row),
        }
      : {}),
  };
};

const parseLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const parseDateBoundary = (value, { endOfDay = false } = {}) => {
  const normalized = normalizeText(value, 40);
  if (!normalized) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const date = new Date(dateOnly ? `${normalized}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildQualifiedName = ({ schema, table }) => `"${schema}"."${table}"`;

const resolveSignupRequestTable = async (faakoPool) => {
  if (!faakoPool) {
    return { errorStatus: 503, error: "FAAKO_DATABASE_URL is not configured." };
  }

  const tableResult = await faakoPool.query(
    `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_name = 'SignupRequest'
      ORDER BY CASE WHEN table_schema = 'public' THEN 0 ELSE 1 END, table_schema
      LIMIT 1
    `
  );
  const table = tableResult.rows[0];
  if (!table) {
    return { errorStatus: 503, error: "Faako SignupRequest table is not available." };
  }

  const columnsResult = await faakoPool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
    `,
    [table.table_schema, table.table_name]
  );
  const columns = new Set(columnsResult.rows.map((row) => row.column_name));
  if (!columns.has("id") || !columns.has("companyName") || !columns.has("email")) {
    return { errorStatus: 503, error: "Faako SignupRequest table is missing required columns." };
  }

  return {
    qualifiedName: buildQualifiedName({ schema: table.table_schema, table: table.table_name }),
    columns,
  };
};

const buildSelectColumns = (columns) =>
  SIGNUP_REQUEST_COLUMNS.filter((column) => columns.has(column)).map((column) => `"${column}"`);

const appendWhere = (whereParts, values, sql, value) => {
  values.push(value);
  whereParts.push(sql.replace("?", `$${values.length}`));
};

const buildListQuery = ({ query, columns }) => {
  const values = [];
  const whereParts = [];
  const includeArchived = String(query.includeArchived || "").toLowerCase() === "true";
  const status = normalizeStatus(query.status);
  const packageTier = normalizeText(query.package, 120);
  const company = normalizeText(query.company || query.q, 180);
  const modules = normalizeArray(query.modules || query.module);
  const dateFrom = parseDateBoundary(query.dateFrom);
  const dateTo = parseDateBoundary(query.dateTo, { endOfDay: true });

  if (columns.has("archivedAt") && !includeArchived) whereParts.push(`"archivedAt" IS NULL`);
  if (status && columns.has("status")) appendWhere(whereParts, values, `"status" = ?`, status);
  if (packageTier && columns.has("packageTier")) {
    appendWhere(whereParts, values, `LOWER("packageTier") = LOWER(?)`, packageTier);
  }
  if (company) {
    const searchColumns = ["companyName", "email", "contactName"].filter((column) => columns.has(column));
    if (searchColumns.length) {
      values.push(`%${company}%`);
      whereParts.push(
        `(${searchColumns.map((column) => `"${column}" ILIKE $${values.length}`).join(" OR ")})`
      );
    }
  }
  if (modules.length && columns.has("requestedModules")) {
    values.push(modules);
    whereParts.push(`"requestedModules" && $${values.length}::text[]`);
  }
  if (dateFrom && columns.has("createdAt")) appendWhere(whereParts, values, `"createdAt" >= ?`, dateFrom);
  if (dateTo && columns.has("createdAt")) appendWhere(whereParts, values, `"createdAt" <= ?`, dateTo);

  return {
    values,
    whereSql: whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "",
  };
};

const loadOwnerOptions = async (prisma) => {
  if (!prisma?.user?.findMany) return [];
  const users = await prisma.user
    .findMany({
      where: { status: "ACTIVE" },
      select: { id: true, fullName: true, email: true },
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
      take: 80,
    })
    .catch(() => []);
  return users.map((user) => ({
    value: user.email,
    label: user.fullName ? `${user.fullName} (${user.email})` : user.email,
  }));
};

const loadFilterOptions = async ({ faakoPool, table, columns }) => {
  const activePackageCondition = columns.has("archivedAt") ? ` AND "archivedAt" IS NULL` : "";
  const activeModulesWhere = columns.has("archivedAt") ? `WHERE "archivedAt" IS NULL` : "";
  const [packagesResult, modulesResult] = await Promise.all([
    columns.has("packageTier")
      ? faakoPool.query(
          `SELECT DISTINCT "packageTier" AS value FROM ${table.qualifiedName} WHERE "packageTier" IS NOT NULL AND trim("packageTier") <> ''${activePackageCondition} ORDER BY "packageTier" LIMIT 80`
        )
      : Promise.resolve({ rows: [] }),
    columns.has("requestedModules")
      ? faakoPool.query(
          `SELECT DISTINCT unnest("requestedModules") AS value FROM ${table.qualifiedName} ${activeModulesWhere} ORDER BY value LIMIT 120`
        )
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    statuses: FAAKO_ONBOARDING_STATUS_OPTIONS,
    packages: packagesResult.rows.map((row) => ({ value: row.value, label: row.value })),
    modules: modulesResult.rows
      .map((row) => normalizeText(row.value, 160))
      .filter(Boolean)
      .map((value) => ({ value, label: sectionLabel(value) })),
  };
};

const loadSummary = async ({ faakoPool, table, columns }) => {
  const activeWhereSql = columns.has("archivedAt") ? `WHERE "archivedAt" IS NULL` : "";
  const totalResult = await faakoPool.query(
    `SELECT COUNT(*)::int AS count FROM ${table.qualifiedName} ${activeWhereSql}`
  );
  const statusRows = columns.has("status")
    ? (
        await faakoPool.query(
          `SELECT "status"::text AS status, COUNT(*)::int AS count FROM ${table.qualifiedName} ${activeWhereSql} GROUP BY "status"`
        )
      ).rows
    : [];
  return {
    total: totalResult.rows[0]?.count ?? 0,
    byStatus: statusRows.reduce((result, row) => {
      const status = buildStatusMeta(row.status);
      result[status.value] = (result[status.value] || 0) + Number(row.count || 0);
      return result;
    }, {}),
  };
};

const findSubmissionRow = async ({ faakoPool, table, columns, id }) => {
  const selectColumns = buildSelectColumns(columns);
  const result = await faakoPool.query(
    `SELECT ${selectColumns.join(", ")} FROM ${table.qualifiedName} WHERE "id" = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
};

const buildFaakoOnboardingCapabilities = (columns) => ({
  status: columns.has("status"),
  internalNotes: columns.has("internalNotes"),
  assignedOwner: columns.has("assignedOwner"),
  pdfSummary: columns.has("pdfSummary"),
  emailDelivery: columns.has("emailDelivery"),
  activityTimeline: columns.has("activityTimeline"),
  archive: columns.has("archivedAt"),
});

export const buildUpdatePatch = ({ body, existingRow, columns, user, extraTimelineEntries = [] }) => {
  const updates = [];
  const values = [];
  const timeline = normalizeTimeline(existingRow.activityTimeline);
  const changedFields = [];
  const actor = normalizeText(user?.fullName || user?.email, 160) || "Dev ERP admin";
  const now = new Date().toISOString();

  const pushUpdate = (column, value) => {
    values.push(value);
    updates.push(`"${column}" = $${values.length}`);
  };

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const status = normalizeStatus(body.status);
    if (!status) return { errorStatus: 400, error: "Choose a valid onboarding status." };
    if (!columns.has("status")) return { errorStatus: 409, error: "Status tracking is not available." };
    if (status !== buildStatusMeta(existingRow.status).value) {
      pushUpdate("status", status);
      changedFields.push("status");
      timeline.push({
        type: "status_changed",
        label: "Status changed",
        from: buildStatusMeta(existingRow.status).label,
        to: STATUS_LABEL_BY_VALUE.get(status) || sectionLabel(status),
        at: now,
        by: actor,
      });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "internalNotes")) {
    const internalNotes = normalizeText(body.internalNotes, 12000);
    if (!columns.has("internalNotes")) {
      if (internalNotes) {
        return { errorStatus: 409, error: "Internal notes are not available until the Faako migration is applied." };
      }
    } else if (internalNotes !== normalizeText(existingRow.internalNotes, 12000)) {
      pushUpdate("internalNotes", internalNotes || null);
      changedFields.push("internalNotes");
      timeline.push({
        type: "notes_updated",
        label: "Internal notes updated",
        at: now,
        by: actor,
      });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "assignedOwner")) {
    const assignedOwner = normalizeText(body.assignedOwner, 160);
    if (!columns.has("assignedOwner")) {
      if (assignedOwner) {
        return { errorStatus: 409, error: "Assigned owner is not available until the Faako migration is applied." };
      }
    } else if (assignedOwner !== normalizeText(existingRow.assignedOwner, 160)) {
      pushUpdate("assignedOwner", assignedOwner || null);
      changedFields.push("assignedOwner");
      timeline.push({
        type: "owner_assigned",
        label: assignedOwner ? "Owner assigned" : "Owner cleared",
        from: normalizeText(existingRow.assignedOwner, 160) || null,
        to: assignedOwner || null,
        at: now,
        by: actor,
      });
    }
  }

  const normalizedExtraTimelineEntries = Array.isArray(extraTimelineEntries)
    ? extraTimelineEntries.filter((entry) => entry && typeof entry === "object")
    : [];
  normalizedExtraTimelineEntries.forEach((entry) => {
    timeline.push({
      type: normalizeText(entry.type, 80) || "activity",
      label: normalizeText(entry.label, 160) || "Activity",
      at: toIso(entry.at) || now,
      by: normalizeText(entry.by, 160) || actor,
      from: entry.from === undefined || entry.from === null ? null : normalizeText(entry.from, 240),
      to: entry.to === undefined || entry.to === null ? null : normalizeText(entry.to, 240),
      note: normalizeText(entry.note, 500) || null,
    });
  });
  if (normalizedExtraTimelineEntries.length && !changedFields.includes("project")) {
    changedFields.push("project");
  }

  if (changedFields.length && columns.has("activityTimeline")) {
    pushUpdate("activityTimeline", JSON.stringify(timeline.slice(-60)));
  }
  if (changedFields.length && columns.has("managementUpdatedAt")) {
    updates.push('"managementUpdatedAt" = NOW()');
  }
  if (changedFields.length && columns.has("managementUpdatedBy")) {
    pushUpdate("managementUpdatedBy", actor);
  }
  if (changedFields.length && columns.has("updatedAt")) {
    updates.push('"updatedAt" = NOW()');
  }

  return { updates, values, changedFields };
};

const buildArchivePatch = ({ existingRow, columns, user }) => {
  if (!columns.has("archivedAt")) {
    return {
      errorStatus: 409,
      error: "Archive is not available until the Faako archive migration is applied.",
    };
  }

  if (toIso(existingRow.archivedAt)) {
    return { updates: [], values: [], changedFields: [] };
  }

  const updates = [];
  const values = [];
  const actor = normalizeText(user?.fullName || user?.email, 160) || "Dev ERP admin";
  const now = new Date().toISOString();
  const timeline = normalizeTimeline(existingRow.activityTimeline);

  const pushUpdate = (column, value) => {
    values.push(value);
    updates.push(`"${column}" = $${values.length}`);
  };

  pushUpdate("archivedAt", now);
  if (columns.has("archivedBy")) pushUpdate("archivedBy", actor);
  if (columns.has("activityTimeline")) {
    timeline.push({
      type: "archived",
      label: "Submission archived",
      at: now,
      by: actor,
    });
    pushUpdate("activityTimeline", JSON.stringify(timeline.slice(-60)));
  }
  if (columns.has("managementUpdatedAt")) updates.push('"managementUpdatedAt" = NOW()');
  if (columns.has("managementUpdatedBy")) pushUpdate("managementUpdatedBy", actor);
  if (columns.has("updatedAt")) updates.push('"updatedAt" = NOW()');

  return { updates, values, changedFields: ["archivedAt"] };
};

const recordFaakoOnboardingAudit = ({ prisma, writeAuditLog, req, submission, action, summary, metadata, appEnv }) =>
  writeAuditLog?.(
    prisma,
    {
      userId: req.user?.userId,
      organizationId: req.user?.organizationId,
      action,
      targetType: "faako_onboarding_submission",
      targetId: submission?.id || null,
      appKey: "faako",
      source: "api",
      category: "admin",
      severity: "info",
      status: "ok",
      summary,
      actorLabel: req.user?.fullName || req.user?.email || null,
      requestId: String(req.headers["x-request-id"] || ""),
      ipAddress: req.ip,
      metadata,
    },
    { environment: appEnv }
  );

export const registerFaakoOnboardingRoutes = (app, {
  faakoPool,
  prisma,
  authMiddleware,
  requireAdmin,
  writeAuditLog,
  appEnv = "development",
}) => {
  const router = express.Router();

  router.get("/", authMiddleware, requireAdmin, async (req, res) => {
    const table = await resolveSignupRequestTable(faakoPool);
    if (table.error) return res.status(table.errorStatus).json({ error: table.error });

    const limit = parseLimit(req.query.limit);
    const selectColumns = buildSelectColumns(table.columns);
    const queryParts = buildListQuery({ query: req.query, columns: table.columns });
    const offset = 0;
    const orderColumn = table.columns.has("createdAt") ? '"createdAt"' : '"id"';
    const result = await faakoPool.query(
      `
        SELECT ${selectColumns.join(", ")}
        FROM ${table.qualifiedName}
        ${queryParts.whereSql}
        ORDER BY ${orderColumn} DESC
        LIMIT $${queryParts.values.length + 1}
        OFFSET $${queryParts.values.length + 2}
      `,
      [...queryParts.values, limit, offset]
    );
    const [summary, filters, ownerOptions] = await Promise.all([
      loadSummary({ faakoPool, table, columns: table.columns }),
      loadFilterOptions({ faakoPool, table, columns: table.columns }),
      loadOwnerOptions(prisma),
    ]);

    return res.json({
      submissions: result.rows.map((row) => serializeFaakoOnboardingSubmission(row)),
      summary,
      filters,
      ownerOptions,
      capabilities: buildFaakoOnboardingCapabilities(table.columns),
    });
  });

  router.get("/:id", authMiddleware, requireAdmin, async (req, res) => {
    const table = await resolveSignupRequestTable(faakoPool);
    if (table.error) return res.status(table.errorStatus).json({ error: table.error });
    const row = await findSubmissionRow({
      faakoPool,
      table,
      columns: table.columns,
      id: normalizeText(req.params.id, 120),
    });
    if (!row) return res.status(404).json({ error: "Faako onboarding submission not found." });
    const ownerOptions = await loadOwnerOptions(prisma);
    return res.json({
      submission: serializeFaakoOnboardingSubmission(row, { includeDetail: true }),
      ownerOptions,
      statusOptions: FAAKO_ONBOARDING_STATUS_OPTIONS,
      capabilities: buildFaakoOnboardingCapabilities(table.columns),
    });
  });

  router.post("/:id/archive", authMiddleware, requireAdmin, async (req, res) => {
    const table = await resolveSignupRequestTable(faakoPool);
    if (table.error) return res.status(table.errorStatus).json({ error: table.error });
    const id = normalizeText(req.params.id, 120);
    const existingRow = await findSubmissionRow({ faakoPool, table, columns: table.columns, id });
    if (!existingRow) return res.status(404).json({ error: "Faako onboarding submission not found." });

    const patch = buildArchivePatch({
      existingRow,
      columns: table.columns,
      user: req.user,
    });
    if (patch.error) return res.status(patch.errorStatus).json({ error: patch.error });

    if (!patch.changedFields.length || !patch.updates.length) {
      return res.json({
        submission: serializeFaakoOnboardingSubmission(existingRow, { includeDetail: true }),
        changedFields: [],
        archived: true,
      });
    }

    patch.values.push(id);
    const selectColumns = buildSelectColumns(table.columns);
    const updateResult = await faakoPool.query(
      `
        UPDATE ${table.qualifiedName}
        SET ${patch.updates.join(", ")}
        WHERE "id" = $${patch.values.length}
        RETURNING ${selectColumns.join(", ")}
      `,
      patch.values
    );
    const submission = serializeFaakoOnboardingSubmission(updateResult.rows[0], { includeDetail: true });

    await recordFaakoOnboardingAudit({
      prisma,
      writeAuditLog,
      req,
      submission,
      action: "FAAKO_ONBOARDING_ARCHIVED",
      summary: `Archived Faako onboarding submission for ${submission.companyName}.`,
      metadata: {
        status: submission.status.value,
      },
      appEnv,
    });

    return res.json({ submission, changedFields: patch.changedFields, archived: true });
  });

  router.patch("/:id", authMiddleware, requireAdmin, async (req, res) => {
    const table = await resolveSignupRequestTable(faakoPool);
    if (table.error) return res.status(table.errorStatus).json({ error: table.error });
    const id = normalizeText(req.params.id, 120);
    const existingRow = await findSubmissionRow({ faakoPool, table, columns: table.columns, id });
    if (!existingRow) return res.status(404).json({ error: "Faako onboarding submission not found." });

    const body = req.body || {};
    const validationPatch = buildUpdatePatch({
      body,
      existingRow,
      columns: table.columns,
      user: req.user,
    });
    if (validationPatch.error) return res.status(validationPatch.errorStatus).json({ error: validationPatch.error });

    const statusRequested = Object.prototype.hasOwnProperty.call(body, "status");
    const requestedStatus = statusRequested ? normalizeStatus(body.status) : "";
    const currentStatus = buildStatusMeta(existingRow.status).value;
    let projectResult = null;
    let extraTimelineEntries = [];

    if (requestedStatus === CONVERTED_STATUS) {
      try {
        projectResult = await ensureProjectForConvertedSubmission({ prisma, row: existingRow, user: req.user });
      } catch (projectError) {
        projectResult = {
          created: false,
          error: projectError.message || "Converted project could not be created.",
        };
      }
      if (projectResult?.project && (projectResult.created || currentStatus !== CONVERTED_STATUS)) {
        extraTimelineEntries = [
          {
            type: projectResult.created ? "project_created" : "project_linked",
            label: projectResult.created ? "Project created" : "Project linked",
            note: `${projectResult.project.title} (#${projectResult.project.id})`,
          },
        ];
      }
    }

    const patch = extraTimelineEntries.length
      ? buildUpdatePatch({
          body,
          existingRow,
          columns: table.columns,
          user: req.user,
          extraTimelineEntries,
        })
      : validationPatch;
    if (patch.error) return res.status(patch.errorStatus).json({ error: patch.error });

    if (!patch.changedFields.length || !patch.updates.length) {
      return res.json({
        submission: serializeFaakoOnboardingSubmission(existingRow, { includeDetail: true }),
        changedFields: patch.changedFields,
        project: projectResult,
        projectCreated: Boolean(projectResult?.created),
      });
    }

    patch.values.push(id);
    const selectColumns = buildSelectColumns(table.columns);
    const updateResult = await faakoPool.query(
      `
        UPDATE ${table.qualifiedName}
        SET ${patch.updates.join(", ")}
        WHERE "id" = $${patch.values.length}
        RETURNING ${selectColumns.join(", ")}
      `,
      patch.values
    );
    const updatedRow = updateResult.rows[0];
    const submission = serializeFaakoOnboardingSubmission(updatedRow, { includeDetail: true });
    let project = null;
    if (patch.changedFields.includes("status") && submission.status.value === "CONVERTED") {
      try {
        project = await ensureProjectForConvertedSubmission({ prisma, req, submission });
      } catch (projectError) {
        project = {
          created: false,
          error: projectError.message || "Converted project could not be created.",
        };
      }
    }

    await recordFaakoOnboardingAudit({
      prisma,
      writeAuditLog,
      req,
      submission,
      action: "FAAKO_ONBOARDING_UPDATED",
      summary: `Updated Faako onboarding submission for ${submission.companyName}.`,
      metadata: {
        changedFields: patch.changedFields,
        status: submission.status.value,
        assignedOwner: submission.assignedOwner || null,
        convertedProject: projectResult,
      },
      appEnv,
    });

    return res.json({ submission, changedFields: patch.changedFields, project: projectResult });
  });

  app.use("/api/faako-onboarding", router);
};
