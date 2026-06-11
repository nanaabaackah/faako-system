const crypto = require("node:crypto");
const { Pool } = require("pg");
const { resolveDatabaseUrl } = require("./runtimeConfig.cjs");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS_PER_IP = 20;
const RATE_LIMIT_MAX_REQUESTS_PER_EMAIL = 5;

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Faako <faako@nanaabaackah.com>";
const INTAKE_ADMIN_EMAIL = process.env.INTAKE_ADMIN_EMAIL;

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

const normalizeEmail = (value) => {
  const email = normalizeText(value, 254)?.toLowerCase();
  return email && EMAIL_PATTERN.test(email) ? email : null;
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
    "access-control-allow-headers": "content-type",
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
    name: "Contact name",
    roleTitle: "Role/title",
    email: "Email",
    phoneWhatsapp: "Phone/WhatsApp",
    preferredContactMethod: "Preferred contact method",
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
};

const buildSubmissionRows = (submission, { includeAllFields = false } = {}) => {
  const rows = [
    ["Request ID", submission.requestId],
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
    rows.push([`--- ${sectionKey.toUpperCase()} ---`, ""]);

    Object.entries(fields).forEach(([fieldKey, label]) => {
      rows.push([label, intake?.[sectionKey]?.[fieldKey] ?? "N/A"]);
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

const buildEmailLayout = ({ title, intro, rows }) => `
  <div style="font-family:Arial,sans-serif;background:#f6f7f9;padding:24px;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#0f3d35;color:#ffffff;padding:24px;">
        <h1 style="margin:0;font-size:24px;">Faako</h1>
        <p style="margin:6px 0 0;color:#d1fae5;">Client onboarding intake</p>
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
  const lines = [
    "Faako Client Onboarding Intake",
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
  commands.push(`BT /F1 9 Tf 0.86 0.95 0.91 rg ${margin} 744 Td (Client onboarding intake summary) Tj ET`);

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
  filename: `${slugify(submission.companyName) || "faako"}-onboarding-summary.pdf`,
  content: createPdfBuffer(submission).toString("base64"),
});

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !to) return null;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to,
      subject,
      html,
      attachments,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error("Resend send failed:", text);
    throw new Error(text || "Resend email request failed");
  }

  return text;
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

  await dbClient.query(
    `
      INSERT INTO "SignupRequest" (${insertColumns.join(", ")})
      VALUES (${placeholders.join(", ")})
    `,
    insertValues
  );
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

  const dbClient = await getPool().connect();

  const requestId = crypto.randomUUID();
  let organizationId = null;
  let userId = null;

  const submission = {
    requestId,
    submittedAt: new Date().toISOString(),
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

    await insertSignupRequestCompat(dbClient, {
      ...submission,
      organizationId,
      userId,
    });

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

  try {
    if (INTAKE_ADMIN_EMAIL) {
      await sendEmail({
        to: INTAKE_ADMIN_EMAIL,
        subject: `[Faako] New onboarding intake - ${companyName}`,
        html: buildEmailLayout({
          title: "New client onboarding intake",
          intro: "A new onboarding form was submitted and saved to the Faako database.",
          rows: [["Request ID", requestId], ...rows],
        }),
        attachments: [pdfAttachment],
      });
    }

    await sendEmail({
      to: email,
      subject: "Faako onboarding intake received",
      html: buildEmailLayout({
        title: "We received your onboarding intake",
        intro:
          "Thanks for submitting your business details. Faako will review your setup requirements and follow up with next steps.",
        rows: [["Request ID", requestId], ...rows],
      }),
      attachments: [pdfAttachment],
    });
  } catch (emailError) {
    console.error("Signup email send failed:", {
      message: emailError?.message,
    });
  }

  return response(event, 202, {
    ok: true,
    message: "Signup received",
    requestId,
  });
};
