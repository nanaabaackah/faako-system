import express from "express";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;
const N_A = "N/A";

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
  const status = normalizeStatus(query.status);
  const packageTier = normalizeText(query.package, 120);
  const company = normalizeText(query.company || query.q, 180);
  const modules = normalizeArray(query.modules || query.module);
  const dateFrom = parseDateBoundary(query.dateFrom);
  const dateTo = parseDateBoundary(query.dateTo, { endOfDay: true });

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
  const [packagesResult, modulesResult] = await Promise.all([
    columns.has("packageTier")
      ? faakoPool.query(
          `SELECT DISTINCT "packageTier" AS value FROM ${table.qualifiedName} WHERE "packageTier" IS NOT NULL AND trim("packageTier") <> '' ORDER BY "packageTier" LIMIT 80`
        )
      : Promise.resolve({ rows: [] }),
    columns.has("requestedModules")
      ? faakoPool.query(
          `SELECT DISTINCT unnest("requestedModules") AS value FROM ${table.qualifiedName} ORDER BY value LIMIT 120`
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
  const totalResult = await faakoPool.query(`SELECT COUNT(*)::int AS count FROM ${table.qualifiedName}`);
  const statusRows = columns.has("status")
    ? (
        await faakoPool.query(
          `SELECT "status"::text AS status, COUNT(*)::int AS count FROM ${table.qualifiedName} GROUP BY "status"`
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

const buildUpdatePatch = ({ body, existingRow, columns, user }) => {
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
    if (!columns.has("internalNotes")) {
      return { errorStatus: 409, error: "Internal notes are not available until the Faako migration is applied." };
    }
    const internalNotes = normalizeText(body.internalNotes, 12000);
    if (internalNotes !== normalizeText(existingRow.internalNotes, 12000)) {
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
    if (!columns.has("assignedOwner")) {
      return { errorStatus: 409, error: "Assigned owner is not available until the Faako migration is applied." };
    }
    const assignedOwner = normalizeText(body.assignedOwner, 160);
    if (assignedOwner !== normalizeText(existingRow.assignedOwner, 160)) {
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
      capabilities: {
        internalNotes: table.columns.has("internalNotes"),
        assignedOwner: table.columns.has("assignedOwner"),
        pdfSummary: table.columns.has("pdfSummary"),
        emailDelivery: table.columns.has("emailDelivery"),
        activityTimeline: table.columns.has("activityTimeline"),
      },
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
    });
  });

  router.patch("/:id", authMiddleware, requireAdmin, async (req, res) => {
    const table = await resolveSignupRequestTable(faakoPool);
    if (table.error) return res.status(table.errorStatus).json({ error: table.error });
    const id = normalizeText(req.params.id, 120);
    const existingRow = await findSubmissionRow({ faakoPool, table, columns: table.columns, id });
    if (!existingRow) return res.status(404).json({ error: "Faako onboarding submission not found." });

    const patch = buildUpdatePatch({
      body: req.body || {},
      existingRow,
      columns: table.columns,
      user: req.user,
    });
    if (patch.error) return res.status(patch.errorStatus).json({ error: patch.error });

    if (!patch.changedFields.length) {
      return res.json({
        submission: serializeFaakoOnboardingSubmission(existingRow, { includeDetail: true }),
        changedFields: [],
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
      },
      appEnv,
    });

    return res.json({ submission, changedFields: patch.changedFields });
  });

  app.use("/api/faako-onboarding", router);
};
