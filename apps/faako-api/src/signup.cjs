const crypto = require("node:crypto");
const { Pool } = require("pg");
const { resolveDatabaseUrl } = require("./runtimeConfig.cjs");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9_-]{16,120}$/;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS_PER_IP = 20;
const RATE_LIMIT_MAX_REQUESTS_PER_EMAIL = 5;
const LOCAL_EMAIL_FALLBACK = "dev@nanaabaackah.com";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  (process.env.FAAKO_ONBOARDING_FROM_EMAIL
    ? `${process.env.FAAKO_ONBOARDING_FROM_NAME || "Faako"} <${process.env.FAAKO_ONBOARDING_FROM_EMAIL}>`
    : "Faako <faako@nanaabaackah.com>");
const INTAKE_ADMIN_EMAIL =
  process.env.INTAKE_ADMIN_EMAIL || process.env.FAAKO_ONBOARDING_ADMIN_EMAIL;
const APP_ACTIVITY_WEBHOOK_PATH = "/api/webhooks/app-activity";

const DEFAULT_ALLOWED_ORIGIN = "https://faako.nanaabaackah.com";

let pool = global.__faakoSignupPool || null;
let rateLimitStore = global.__faakoSignupRateLimitStore || new Map();

if (!global.__faakoSignupRateLimitStore) {
  global.__faakoSignupRateLimitStore = rateLimitStore;
}

const getPool = () => {
  if (pool) return pool;

  const connectionString = resolveDatabaseUrl();

  if (!connectionString) {
    throw new Error("Database URL is missing");
  }

  pool = new Pool({
    connectionString,
  });

  global.__faakoSignupPool = pool;
  return pool;
};

const normalizeText = (value, maxLength = 2000) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const resolveAppActivityWebhookUrl = () => {
  const directUrl = normalizeText(
    process.env.DEV_ERP_ACTIVITY_WEBHOOK_URL || process.env.APP_ACTIVITY_WEBHOOK_URL,
    500
  );
  if (directUrl) return directUrl;

  const baseUrl = normalizeText(
    process.env.DEV_ERP_API_BASE_URL || process.env.DEV_API_BASE_URL,
    500
  );
  if (!baseUrl) return "";

  try {
    return new URL(APP_ACTIVITY_WEBHOOK_PATH, baseUrl).toString();
  } catch {
    return "";
  }
};

const getAppActivityWebhookSecret = () =>
  normalizeText(
    process.env.DEV_ERP_ACTIVITY_WEBHOOK_SECRET || process.env.APP_ACTIVITY_WEBHOOK_SECRET,
    500
  );

const emitAppActivityEvent = async ({
  action,
  category = "onboarding",
  severity = "info",
  status = "ok",
  targetType = "signup_request",
  targetId = "",
  summary = "",
  requestId = "",
  metadata = {},
} = {}) => {
  const webhookUrl = resolveAppActivityWebhookUrl();
  const webhookSecret = getAppActivityWebhookSecret();
  if (!webhookUrl || !webhookSecret || typeof fetch !== "function") return;

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify({
        appKey: "faako-api",
        eventId: requestId ? `faako-api:${action}:${requestId}` : undefined,
        action,
        category,
        severity,
        status,
        targetType,
        targetId,
        actorType: "system",
        actorLabel: "Faako API",
        requestId,
        summary,
        metadata: {
          environment: process.env.APP_ENV || process.env.NODE_ENV || "development",
          ...metadata,
        },
      }),
    });

    if (!webhookResponse.ok) {
      console.warn("Dev ERP activity webhook rejected Faako API event:", webhookResponse.status);
    }
  } catch (error) {
    console.warn("Dev ERP activity webhook failed for Faako API event:", error?.message || error);
  }
};

const normalizeEmail = (value) => {
  const email = normalizeText(value, 254)?.toLowerCase();
  return email && EMAIL_PATTERN.test(email) ? email : null;
};

const isProductionRuntime = () => {
  const appEnv = String(process.env.APP_ENV || process.env.NODE_ENV || "").trim().toLowerCase();
  return appEnv === "production" || appEnv === "prod";
};

const getLocalEmailRecipient = () =>
  normalizeEmail(process.env.EMAIL_FORCE_TO) || LOCAL_EMAIL_FALLBACK;

const resolveEmailDeliveryTarget = (to) => {
  const intendedRecipient = normalizeEmail(to);
  if (isProductionRuntime()) {
    return {
      intendedRecipient,
      deliveryRecipient: intendedRecipient,
      wasRerouted: false,
    };
  }

  const deliveryRecipient = getLocalEmailRecipient();
  return {
    intendedRecipient,
    deliveryRecipient,
    wasRerouted:
      Boolean(intendedRecipient) &&
      deliveryRecipient.toLowerCase() !== intendedRecipient.toLowerCase(),
  };
};

const normalizeStringArray = (value, maxItems = 40, maxLength = 160) => {
  let values = [];

  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        values = Array.isArray(parsed) ? parsed : trimmed.split(",");
      } catch {
        values = trimmed.split(",");
      }
    } else {
      values = trimmed.split(",");
    }
  }

  return [
    ...new Set(
      values
        .filter((item) => typeof item === "string")
        .map((item) => item.trim().slice(0, maxLength))
        .filter(Boolean)
    ),
  ].slice(0, maxItems);
};

const parseStructuredValue = (value) => {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const parseUrlEncodedPayload = (body) => {
  const payload = {};
  const params = new URLSearchParams(body || "");

  for (const [key, value] of params.entries()) {
    payload[key] = value;
  }

  return payload;
};

const getHeaderValue = (headers, name) => {
  if (!headers || typeof headers !== "object") return null;

  const direct = headers[name];
  if (typeof direct === "string") return direct;

  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower && typeof value === "string") {
      return value;
    }
  }

  return null;
};

const parseAllowedOrigins = () => {
  const configured = String(process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return new Set([
    DEFAULT_ALLOWED_ORIGIN,
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:8889",
    ...configured,
  ]);
};

const buildHeaders = (event) => {
  const origin = getHeaderValue(event.headers, "origin");
  const allowedOrigins = parseAllowedOrigins();

  const headers = {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-faako-idempotency-key",
    "x-content-type-options": "nosniff",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "Origin";
  } else {
    headers["access-control-allow-origin"] = process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;
  }

  return headers;
};

const response = (event, statusCode, body) => ({
  statusCode,
  headers: buildHeaders(event),
  body: JSON.stringify(body),
});

const getClientIp = (event) => {
  const forwarded =
    getHeaderValue(event.headers, "x-forwarded-for") ||
    getHeaderValue(event.headers, "x-real-ip") ||
    getHeaderValue(event.headers, "client-ip") ||
    "unknown";

  return String(forwarded).split(",")[0].trim();
};

const normalizeIdempotencyKey = (value) => {
  const normalized = normalizeText(value, 140);
  return normalized && IDEMPOTENCY_KEY_PATTERN.test(normalized) ? normalized : null;
};

const consumeRateLimit = (key, limit) => {
  const now = Date.now();

  for (const [bucketKey, entry] of rateLimitStore.entries()) {
    if (!entry || entry.resetAt <= now) {
      rateLimitStore.delete(bucketKey);
    }
  }

  const existing = rateLimitStore.get(key);
  const entry =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
      : existing;

  entry.count += 1;
  rateLimitStore.set(key, entry);

  return {
    limited: entry.count > limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
};

const getPublicTableColumns = async (dbClient, tableName) => {
  const result = await dbClient.query(
    `
      SELECT "column_name"
      FROM "information_schema"."columns"
      WHERE "table_schema" = 'public'
        AND "table_name" = $1
    `,
    [tableName]
  );

  return new Set(result.rows.map((row) => row.column_name));
};

const tableHasRequiredColumns = async (dbClient, tableName, requiredColumns) => {
  const columns = await getPublicTableColumns(dbClient, tableName);
  return requiredColumns.every((column) => columns.has(column));
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

const buildUniqueSlug = async (dbClient, companyName) => {
  const base = slugify(companyName) || `org-${Date.now().toString(36)}`;
  let candidate = base;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await dbClient.query(
      'SELECT 1 FROM "Organization" WHERE "slug" = $1 LIMIT 1',
      [candidate]
    );

    if (existing.rowCount === 0) return candidate;
    candidate = `${base}-${crypto.randomInt(1000, 9999)}`;
  }

  return `${base}-${Date.now().toString(36)}`;
};

const formatValue = (value) => {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "N/A";
  return String(value);
};

const hasMeaningfulValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return true;
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => hasMeaningfulValue(item));
  }
  return value !== null && value !== undefined && String(value).trim() !== "";
};

const buildSetupChecklist = (payload, intake, requestedModules) =>
  [
    payload?.payments?.acceptsOnlinePayments !== "No" ||
    intake?.payments?.acceptsOnlinePayments !== "No"
      ? "Payment provider setup review"
      : null,
    intake?.communications?.preferredSendingEmail ||
    intake?.communications?.mainBusinessEmail
      ? "Resend/email sending setup review"
      : null,
    intake?.communications?.whatsappNumber ? "WhatsApp Business setup review" : null,
    intake?.communications?.smsNeeded === "Yes" ? "SMS provider setup review" : null,
    intake?.domain?.hasDomain !== "No" ? "Domain/DNS setup review" : null,
    requestedModules.length ? "Module enablement planning" : null,
    "Security and privacy launch review",
  ].filter(Boolean);

const WIZARD_FIELD_SCHEMA = {
  company: {
    businessName: "Business name",
    legalBusinessName: "Legal business name",
    industry: "Business type / industry",
    country: "Country",
    city: "City",
    address: "Business address",
    mainPhone: "Main phone",
    mainEmail: "Main email",
    websiteDomain: "Website/domain",
    currency: "Currency",
    timezone: "Timezone",
    registrationNumber: "Business registration number",
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
    branchCount: "Branches/locations",
    currentTools: "Current tools used",
    workflowProblems: "Current workflow problems",
    launchTimeline: "Expected launch timeline",
    priorityGoals: "Priority goals",
  },
  modules: {
    selected: "Selected modules",
    customNotes: "Custom module notes",
  },
  payments: {
    acceptsOnlinePayments: "Accepts online payments",
    preferredProvider: "Preferred provider",
    methods: "Payment methods needed",
    paystackAccountStatus: "Paystack account status",
    providerBusinessEmail: "Business email for payment provider",
    settlementCountry: "Settlement country",
    defaultCurrency: "Default currency",
    paymentTypes: "Expected payment types",
    notificationPreference: "Payment notification preference",
  },
  communications: {
    mainBusinessEmail: "Main business email",
    preferredSendingEmail: "Preferred sending email",
    supportEmail: "Support email",
    existingEmailProvider: "Existing email provider",
    needsBusinessEmailSetup: "Needs business email setup",
    whatsappNumber: "WhatsApp business number",
    whatsappDisplayName: "WhatsApp display name",
    whatsappCategory: "WhatsApp business category",
    smsNeeded: "SMS needed",
    customerNotificationChannels: "Preferred customer notification channels",
    notificationTypes: "Notification types wanted",
  },
  domain: {
    hasDomain: "Has domain",
    domainName: "Domain name",
    domainProvider: "Domain provider",
    hasBusinessEmail: "Has business email",
    desiredEmailAddresses: "Desired email addresses",
    needsHostingSetup: "Needs hosting setup",
    currentWebsiteUrl: "Current website URL",
  },
  admins: {
    ownerName: "Owner/admin name",
    ownerEmail: "Owner/admin email",
    staffAccountsNeeded: "Number of staff accounts needed",
    rolesNeeded: "Roles needed",
  },
  security: {
    roleBasedAccess: "Needs role-based access",
    auditLogs: "Needs audit logs",
    handlesPersonalData: "Handles customer personal data",
    handlesOnlinePayments: "Handles online payments",
    backups: "Needs backups",
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

const buildSubmissionRows = (submission, { includeAllFields = false } = {}) => {
  const rows = [
    ["Request ID", submission.requestId],
    ["Form", submission.formLabel || "Client onboarding intake"],
    ["Company", submission.companyName],
    ["Contact", submission.contactName],
    ["Email", submission.email],
    ["Phone", submission.phone],
    ["Package", submission.packageTier],
    ["Currency", submission.currency],
    ["Modules", submission.requestedModules],
    ["Channels", submission.communicationChannels],
    ["Workflow", submission.currentWorkflow],
    ["Pain Points", submission.painPoints],
    ["Project Details", submission.projectDetails],
    ["Setup Checklist", submission.setupChecklist],
  ];

  const intake = submission.onboardingIntake || {};

  if (!includeAllFields) return rows;

  Object.entries(WIZARD_FIELD_SCHEMA).forEach(([sectionKey, fields]) => {
    const sectionValue = intake?.[sectionKey];
    if (!hasMeaningfulValue(sectionValue)) return;

    rows.push([`--- ${sectionKey.toUpperCase()} ---`, ""]);

    Object.entries(fields).forEach(([fieldKey, label]) => {
      rows.push([label, sectionValue?.[fieldKey] ?? "N/A"]);
    });
  });

  return rows;
};

const escapeHtml = (value) =>
  String(formatValue(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildRowsHtml = (rows) =>
  rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;">${escapeHtml(
          label
        )}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(
          Array.isArray(value) ? value.join(", ") : value
        )}</td></tr>`
    )
    .join("");

const buildEmailLayout = ({ title, intro, rows, kicker = "Client onboarding intake" }) => `
  <div style="font-family:Arial,sans-serif;background:#f6f7f9;padding:24px;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#0f3d35;color:#ffffff;padding:24px;">
        <h1 style="margin:0;font-size:24px;">Faako</h1>
        <p style="margin:6px 0 0;color:#d1fae5;">${escapeHtml(kicker)}</p>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 12px;color:#111827;">${escapeHtml(title)}</h2>
        <p style="color:#374151;line-height:1.6;">${escapeHtml(intro)}</p>
        <table style="border-collapse:collapse;width:100%;margin-top:18px;font-size:14px;">
          ${buildRowsHtml(rows)}
        </table>
        <p style="margin-top:24px;color:#6b7280;font-size:13px;">
          This email intentionally excludes API keys, passwords, tokens, and private banking credentials.
        </p>
      </div>
    </div>
  </div>
`;

const pdfSafeText = (value) =>
  formatValue(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapePdfText = (value) =>
  pdfSafeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const createPdfBuffer = (submission) => {
  const rows = buildSubmissionRows(submission);
  const formLabel = submission.formLabel || "Client onboarding intake";
  const lines = [
    `Faako ${formLabel}`,
    `Reference: ${submission.requestId}`,
    `Submitted: ${submission.submittedAt}`,
    "",
    ...rows.flatMap(([label, value]) => [`${label}:`, pdfSafeText(value), ""]),
    "Security note:",
    "This PDF intentionally excludes API keys, passwords, tokens, private banking credentials, and internal-only secrets.",
  ];

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const commands = [];
  let y = 742;

  commands.push("0.06 0.19 0.15 rg 0 738 612 54 re f");
  commands.push(`BT /F2 18 Tf 1 1 1 rg ${margin} 760 Td (Faako) Tj ET`);
  commands.push(`BT /F1 9 Tf 0.86 0.95 0.91 rg ${margin} 744 Td (${escapePdfText(`${formLabel} summary`)}) Tj ET`);

  const drawLine = (text, size = 10, font = "F1") => {
    if (y < 52) return;
    commands.push(`BT /${font} ${size} Tf 0.08 0.1 0.14 rg ${margin} ${y} Td (${escapePdfText(text)}) Tj ET`);
    y -= size + 8;
  };

  lines.forEach((line) => {
    const chunks = pdfSafeText(line).match(/.{1,86}(\s|$)/g) || [line];
    chunks.forEach((chunk, index) => {
      drawLine(chunk.trim(), index === 0 && line.endsWith(":") ? 11 : 9.5, line.endsWith(":") ? "F2" : "F1");
    });
  });

  const content = commands.join("\n");

  const objects = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [5 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`,
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = Buffer.byteLength(pdf, "utf8");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;

  for (let i = 1; i < objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
};

const createPdfAttachment = (submission) => ({
  filename: `${slugify(submission.companyName) || "faako"}-${slugify(submission.formLabel) || "client-intake"}-summary.pdf`,
  content: createPdfBuffer(submission).toString("base64"),
});

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  const delivery = resolveEmailDeliveryTarget(to);
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !delivery.deliveryRecipient) return null;

  const finalSubject = delivery.wasRerouted ? `[Local test] ${subject}` : subject;
  const redirectNotice = delivery.wasRerouted
    ? `
      <div style="margin:0 0 16px;padding:12px;border:1px solid #f59e0b;background:#fffbeb;color:#92400e;border-radius:12px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;">
        <strong>Local email redirect active.</strong><br />
        Original recipient: ${escapeHtml(delivery.intendedRecipient || "none")}<br />
        Delivered to: ${escapeHtml(delivery.deliveryRecipient)}
      </div>
    `
    : "";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: delivery.deliveryRecipient,
      subject: finalSubject,
      html: `${redirectNotice}${html || ""}`.trim(),
      attachments,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error("Resend send failed:", text);
    throw new Error(text || "Resend email request failed");
  }

  let providerResponse = null;
  try {
    providerResponse = text ? JSON.parse(text) : null;
  } catch {
    providerResponse = text || null;
  }

  return {
    intendedRecipient: delivery.intendedRecipient,
    deliveryRecipient: delivery.deliveryRecipient,
    wasRerouted: delivery.wasRerouted,
    providerId:
      providerResponse && typeof providerResponse === "object"
        ? providerResponse.id || providerResponse?.data?.id || null
        : null,
    providerResponse,
  };
};

const updateSignupRequestDeliveryMetadata = async (requestId, metadata) => {
  const dbClient = await getPool().connect();
  try {
    const columns = await getPublicTableColumns(dbClient, "SignupRequest");
    const updates = [];
    const values = [];

    if (columns.has("emailDelivery")) {
      values.push(JSON.stringify(metadata.emailDelivery || null));
      updates.push(`"emailDelivery" = $${values.length}`);
    }
    if (columns.has("pdfSummary")) {
      values.push(JSON.stringify(metadata.pdfSummary || null));
      updates.push(`"pdfSummary" = $${values.length}`);
    }
    if (columns.has("updatedAt")) {
      updates.push('"updatedAt" = NOW()');
    }

    if (!updates.length) return;

    values.push(requestId);
    await dbClient.query(
      `UPDATE "SignupRequest" SET ${updates.join(", ")} WHERE "id" = $${values.length}`,
      values
    );
  } catch (error) {
    console.warn("Unable to update signup delivery metadata:", error?.message || error);
  } finally {
    dbClient.release();
  }
};

const insertSignupRequestCompat = async (dbClient, submission) => {
  const columns = await getPublicTableColumns(dbClient, "SignupRequest");

  if (!columns.has("id") || !columns.has("companyName") || !columns.has("email")) {
    throw new Error("SignupRequest table is missing required columns");
  }

  const valuesByColumn = [
    ["id", submission.requestId],
    ["organizationId", submission.organizationId],
    ["userId", submission.userId],
    ["companyName", submission.companyName],
    ["email", submission.email],
    ["contactName", submission.contactName],
    ["phone", submission.phone],
    ["teamSize", submission.teamSize],
    ["currency", submission.currency],
    ["websiteUrl", submission.websiteUrl],
    ["packageTier", submission.packageTier],
    ["requestedModules", submission.requestedModules],
    ["businessType", submission.businessType],
    ["currentWorkflow", submission.currentWorkflow],
    ["communicationChannels", submission.communicationChannels],
    ["timelinePreference", submission.timelinePreference],
    ["projectDetails", submission.projectDetails],
    ["painPoints", submission.painPoints],
    ["additionalNotes", submission.additionalNotes],
    ["onboardingIntake", submission.onboardingIntake ? JSON.stringify(submission.onboardingIntake) : null],
    ["setupChecklist", JSON.stringify(submission.setupChecklist || [])],
    ["status", "NEW"],
    ["source", "website"],
  ];

  const insertColumns = [];
  const insertValues = [];
  const placeholders = [];

  for (const [column, value] of valuesByColumn) {
    if (!columns.has(column)) continue;
    insertColumns.push(`"${column}"`);
    insertValues.push(value);
    placeholders.push(`$${insertValues.length}`);
  }

  if (columns.has("createdAt")) {
    insertColumns.push('"createdAt"');
    placeholders.push("NOW()");
  }

  if (columns.has("updatedAt")) {
    insertColumns.push('"updatedAt"');
    placeholders.push("NOW()");
  }

  const insertResult = await dbClient.query(
    `
      INSERT INTO "SignupRequest" (${insertColumns.join(", ")})
      VALUES (${placeholders.join(", ")})
      ON CONFLICT ("id") DO NOTHING
      RETURNING "id"
    `,
    insertValues
  );

  return Boolean(insertResult.rows[0]?.id);
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: buildHeaders(event),
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return response(event, 405, { ok: false, error: "Method not allowed" });
  }

  const clientIp = getClientIp(event);
  const ipRateLimit = consumeRateLimit(`ip:${clientIp}`, RATE_LIMIT_MAX_REQUESTS_PER_IP);

  if (ipRateLimit.limited) {
    return {
      statusCode: 429,
      headers: {
        ...buildHeaders(event),
        "retry-after": String(ipRateLimit.retryAfterSeconds),
      },
      body: JSON.stringify({
        ok: false,
        error: "Too many signup attempts. Please try again later.",
      }),
    };
  }

  const rawBody = typeof event.body === "string" ? event.body : "";

  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BODY_BYTES) {
    return response(event, 413, { ok: false, error: "Request body is too large" });
  }

  const contentType = String(getHeaderValue(event.headers, "content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  let payload = {};

  try {
    if (contentType === "application/x-www-form-urlencoded") {
      payload = parseUrlEncodedPayload(rawBody);
    } else {
      payload = JSON.parse(rawBody || "{}");
    }
  } catch {
    return response(event, 400, { ok: false, error: "Invalid request payload" });
  }

  payload = {
    ...payload,
    intake: parseStructuredValue(payload.intake),
    setupChecklist: parseStructuredValue(payload.setupChecklist),
  };

  const intake = payload.intake && typeof payload.intake === "object" ? payload.intake : null;
  const formType =
    normalizeText(payload.formType, 80) ||
    normalizeText(intake?.meta?.formType, 80) ||
    "client-onboarding";
  const formLabel =
    normalizeText(payload.formLabel, 120) ||
    normalizeText(intake?.meta?.formLabel, 120) ||
    "Client onboarding intake";

  const companyName =
    normalizeText(payload.companyName, 180) ||
    normalizeText(intake?.company?.businessName, 180);

  const email =
    normalizeEmail(payload.email) ||
    normalizeEmail(intake?.contact?.email) ||
    normalizeEmail(intake?.company?.mainEmail);

  const contactName =
    normalizeText(payload.contactName, 120) ||
    normalizeText(intake?.contact?.name, 120);

  const phone =
    normalizeText(payload.phone, 80) ||
    normalizeText(intake?.contact?.phoneWhatsapp, 80) ||
    normalizeText(intake?.company?.mainPhone, 80);

  const requestedModules = normalizeStringArray(
    payload.requestedModules || intake?.modules?.selected
  );

  const communicationChannels = normalizeStringArray(
    payload.communicationChannels || intake?.communications?.customerNotificationChannels
  );

  const setupChecklist = normalizeStringArray(payload.setupChecklist);

  const currentWorkflow =
    normalizeText(payload.currentWorkflow, 2500) ||
    normalizeText(intake?.operations?.workflowProblems, 2500);

  if (!companyName || !email) {
    return response(event, 400, { ok: false, error: "companyName and email are required" });
  }

  if (!requestedModules.length) {
    return response(event, 400, { ok: false, error: "Please select at least one module" });
  }

  if (!currentWorkflow) {
    return response(event, 400, { ok: false, error: "Please describe your current workflow" });
  }

  const emailRateLimit = consumeRateLimit(`email:${email}`, RATE_LIMIT_MAX_REQUESTS_PER_EMAIL);
  if (emailRateLimit.limited) {
    return {
      statusCode: 429,
      headers: {
        ...buildHeaders(event),
        "retry-after": String(emailRateLimit.retryAfterSeconds),
      },
      body: JSON.stringify({
        ok: false,
        error: "Too many signup attempts. Please try again later.",
      }),
    };
  }

  const clientIdempotencyKey =
    normalizeIdempotencyKey(getHeaderValue(event.headers, "x-faako-idempotency-key")) ||
    normalizeIdempotencyKey(payload.idempotencyKey);
  const requestId = clientIdempotencyKey || crypto.randomUUID();
  const dbClient = await getPool().connect();

  let organizationId = null;
  let userId = null;

  const submission = {
    requestId,
    submittedAt: new Date().toISOString(),
    formType,
    formLabel,
    companyName,
    email,
    contactName,
    phone,
    teamSize: normalizeText(payload.teamSize, 80) || normalizeText(intake?.operations?.staffCount, 80),
    currency: normalizeText(payload.currency, 8) || normalizeText(intake?.company?.currency, 8) || "GHS",
    websiteUrl: normalizeText(payload.websiteUrl, 300) || normalizeText(intake?.company?.websiteDomain, 300),
    packageTier: normalizeText(payload.packageTier, 40) || "enterprise",
    requestedModules,
    businessType: normalizeText(payload.businessType, 80) || "both",
    currentWorkflow,
    communicationChannels,
    timelinePreference: normalizeText(payload.timelinePreference, 80) || "exploring",
    projectDetails:
      normalizeText(payload.projectDetails, 2500) ||
      normalizeText(intake?.operations?.priorityGoals, 2500),
    painPoints:
      normalizeText(payload.painPoints, 2500) ||
      normalizeText(intake?.operations?.workflowProblems, 2500),
    additionalNotes:
      normalizeText(payload.additionalNotes, 8000) ||
      normalizeText(intake?.modules?.customNotes, 8000),
    onboardingIntake: intake,
    setupChecklist: setupChecklist.length ? setupChecklist : buildSetupChecklist(payload, intake, requestedModules),
  };

  try {
    if (clientIdempotencyKey) {
      const existingRequest = await dbClient.query(
        `SELECT "id" FROM "SignupRequest" WHERE "id" = $1 LIMIT 1`,
        [requestId]
      );
      if (existingRequest.rows[0]) {
        return response(event, 202, {
          ok: true,
          message: "Signup received",
          requestId,
          duplicate: true,
        });
      }
    }

    await dbClient.query("BEGIN");

    const canPersistIdentityGraph =
      (await tableHasRequiredColumns(dbClient, "Organization", [
        "id",
        "name",
        "slug",
        "status",
        "primaryEmail",
        "teamSize",
        "currency",
      ])) &&
      (await tableHasRequiredColumns(dbClient, "User", [
        "id",
        "email",
        "fullName",
        "status",
      ])) &&
      (await tableHasRequiredColumns(dbClient, "Membership", [
        "id",
        "organizationId",
        "userId",
        "role",
      ]));

    if (canPersistIdentityGraph) {
      const slug = await buildUniqueSlug(dbClient, companyName);
      organizationId = crypto.randomUUID();

      const orgInsert = await dbClient.query(
        `
          INSERT INTO "Organization" (
            "id", "name", "slug", "status", "primaryEmail", "teamSize", "currency", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT ("slug")
          DO UPDATE SET "updatedAt" = NOW()
          RETURNING "id"
        `,
        [
          organizationId,
          companyName,
          slug,
          "PENDING",
          email,
          submission.teamSize,
          submission.currency,
        ]
      );

      organizationId = orgInsert.rows[0]?.id || organizationId;

      const userInsert = await dbClient.query(
        `
          INSERT INTO "User" (
            "id", "email", "fullName", "status", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT ("email")
          DO UPDATE SET "fullName" = COALESCE(EXCLUDED."fullName", "User"."fullName"), "updatedAt" = NOW()
          RETURNING "id"
        `,
        [crypto.randomUUID(), email, contactName, "PENDING"]
      );

      userId = userInsert.rows[0]?.id || null;

      if (organizationId && userId) {
        await dbClient.query(
          `
            INSERT INTO "Membership" ("id", "organizationId", "userId", "role", "createdAt")
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT ("organizationId", "userId") DO NOTHING
          `,
          [crypto.randomUUID(), organizationId, userId, "owner"]
        );
      }
    }

    const insertedSignupRequest = await insertSignupRequestCompat(dbClient, {
      ...submission,
      organizationId,
      userId,
    });

    if (!insertedSignupRequest) {
      await dbClient.query("COMMIT");
      return response(event, 202, {
        ok: true,
        message: "Signup received",
        requestId,
        duplicate: true,
      });
    }

    await dbClient.query("COMMIT");
  } catch (error) {
    await dbClient.query("ROLLBACK").catch(() => {});

    console.error("Unable to save signup request:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      table: error?.table,
      column: error?.column,
      constraint: error?.constraint,
    });

    return response(event, 500, {
      ok: false,
      error: "Unable to save signup request",
      ...(process.env.APP_ENV !== "production"
        ? {
            debug: {
              message: error?.message,
              code: error?.code,
              detail: error?.detail,
              table: error?.table,
              column: error?.column,
              constraint: error?.constraint,
            },
          }
        : {}),
    });
  } finally {
    dbClient.release();
  }

  const pdfAttachment = createPdfAttachment({
    ...submission,
    organizationId,
  });

  const rows = buildSubmissionRows(submission, { includeAllFields: true });
  const deliveryAttempts = [];

  try {
    if (INTAKE_ADMIN_EMAIL) {
      const adminDelivery = await sendEmail({
        to: INTAKE_ADMIN_EMAIL,
        subject: `[Faako] New ${submission.formLabel} - ${companyName}`,
        html: buildEmailLayout({
          title: `New ${submission.formLabel}`,
          intro: `A new ${submission.formLabel.toLowerCase()} was submitted and saved to the Faako database.`,
          rows: [["Request ID", requestId], ...rows],
          kicker: submission.formLabel,
        }),
        attachments: [pdfAttachment],
      });
      deliveryAttempts.push({
        type: "admin_copy",
        status: adminDelivery ? "sent" : "skipped",
        intendedRecipient: adminDelivery?.intendedRecipient || INTAKE_ADMIN_EMAIL,
        deliveryRecipient: adminDelivery?.deliveryRecipient || null,
        wasRerouted: Boolean(adminDelivery?.wasRerouted),
        providerId: adminDelivery?.providerId || null,
        attemptedAt: new Date().toISOString(),
      });
    }

    const clientDelivery = await sendEmail({
      to: email,
      subject: `Faako ${submission.formLabel.toLowerCase()} received`,
      html: buildEmailLayout({
        title: `We received your ${submission.formLabel.toLowerCase()}`,
        intro:
          "Thanks for submitting your business details. Faako will review your setup requirements and follow up with next steps.",
        rows: [["Request ID", requestId], ...rows],
        kicker: submission.formLabel,
      }),
      attachments: [pdfAttachment],
    });
    deliveryAttempts.push({
      type: "client_copy",
      status: clientDelivery ? "sent" : "skipped",
      intendedRecipient: clientDelivery?.intendedRecipient || email,
      deliveryRecipient: clientDelivery?.deliveryRecipient || null,
      wasRerouted: Boolean(clientDelivery?.wasRerouted),
      providerId: clientDelivery?.providerId || null,
      attemptedAt: new Date().toISOString(),
    });
  } catch (emailError) {
    deliveryAttempts.push({
      type: "email_delivery",
      status: "failed",
      error: emailError?.message || "Unable to send email copy.",
      attemptedAt: new Date().toISOString(),
    });
    console.error("Signup email send failed:", {
      message: emailError?.message,
    });
  }

  await updateSignupRequestDeliveryMetadata(requestId, {
    emailDelivery: {
      status: deliveryAttempts.some((attempt) => attempt.status === "failed")
        ? "failed"
        : deliveryAttempts.some((attempt) => attempt.status === "sent")
          ? "sent"
          : "not_configured",
      attempts: deliveryAttempts,
      updatedAt: new Date().toISOString(),
    },
    pdfSummary: {
      fileName: pdfAttachment.filename,
      generatedAt: submission.submittedAt,
      stored: false,
      downloadPath: null,
      note: "Generated as an email attachment; no stored PDF copy is available.",
    },
  });
  void emitAppActivityEvent({
    action: "signup_request_received",
    status: deliveryAttempts.some((attempt) => attempt.status === "failed") ? "warning" : "ok",
    severity: deliveryAttempts.some((attempt) => attempt.status === "failed") ? "warning" : "info",
    targetId: requestId,
    requestId,
    summary: `Faako ${submission.formLabel.toLowerCase()} was received.`,
    metadata: {
      formType: submission.formType,
      packageTier: submission.packageTier,
      requestedModuleCount: submission.requestedModules.length,
      emailDeliveryStatus: deliveryAttempts.some((attempt) => attempt.status === "failed")
        ? "failed"
        : deliveryAttempts.some((attempt) => attempt.status === "sent")
          ? "sent"
          : "not_configured",
    },
  });

  return response(event, 202, {
    ok: true,
    message: "Signup received",
    requestId,
  });
};
