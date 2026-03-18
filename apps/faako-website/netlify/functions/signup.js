const crypto = require("node:crypto");
const { Pool } = require("pg");

const BASE_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

const DEV_ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://localhost:8888",
  "http://127.0.0.1:8888",
  "https://faako.nanaabaackah.com",
]);

const pool =
  global.__faakoPgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL
  });

if (!global.__faakoPgPool) {
  global.__faakoPgPool = pool;
}

const PACKAGE_RULES = {
  starter: {
    label: "Starter",
    maxModules: 3
  },
  professional: {
    label: "Professional",
    maxModules: 8
  },
  enterprise: {
    label: "Enterprise",
    maxModules: null
  }
};

const TIER_RANK = {
  starter: 1,
  professional: 2,
  enterprise: 3
};

const MODULE_CATALOG = {
  website: { minTier: "starter" },
  payments: { minTier: "starter" },
  bookings: { minTier: "starter" },
  inventory: { minTier: "professional" },
  orders: { minTier: "professional" },
  crm: { minTier: "professional" },
  dashboard: { minTier: "professional" },
  reports: { minTier: "professional" },
  delivery: { minTier: "professional" },
  scheduler: { minTier: "professional" },
  hr: { minTier: "enterprise" },
  integrations: { minTier: "enterprise" },
  analytics: { minTier: "enterprise" },
  support: { minTier: "enterprise" }
};

const ALLOWED_COMMUNICATION_CHANNELS = new Set([
  "whatsapp",
  "phone-calls",
  "email",
  "instagram",
  "facebook",
  "walk-in",
  "website-chat",
  "sms",
  "other"
]);

const ALLOWED_CURRENCIES = new Set(["GHS", "USD", "NGN"]);
const ALLOWED_BUSINESS_TYPES = new Set(["sell", "rent", "both"]);
const ALLOWED_TEAM_SIZES = new Set(["1-10", "11-50", "51-200", "201+"]);
const ALLOWED_TIMELINES = new Set(["immediately", "soon", "exploring"]);
const BOT_FIELD_NAME = "companyFax";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//;
const MAX_REQUEST_BODY_BYTES = 24 * 1024;
const ACCEPTED_RESPONSE_BODY = JSON.stringify({
  ok: true,
  message: "Thanks. We have received your form."
});
const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";

const createId = () => crypto.randomUUID();

const publicTableColumnsCache = new Map();

const getPublicTableColumns = async (dbClient, tableName) => {
  if (publicTableColumnsCache.has(tableName)) {
    return publicTableColumnsCache.get(tableName);
  }

  const result = await dbClient.query(
    `
      SELECT "column_name"
      FROM "information_schema"."columns"
      WHERE "table_schema" = 'public'
        AND "table_name" = $1
    `,
    [tableName]
  );

  const columns = new Set(result.rows.map((row) => row.column_name));
  publicTableColumnsCache.set(tableName, columns);
  return columns;
};

const tableHasRequiredColumns = async (dbClient, tableName, requiredColumns) => {
  const columns = await getPublicTableColumns(dbClient, tableName);
  return requiredColumns.every((column) => columns.has(column));
};

const insertSignupRequestCompat = async (dbClient, submission) => {
  const signupRequestId = createId();
  const columns = await getPublicTableColumns(dbClient, "SignupRequest");

  if (!columns.has("id") || !columns.has("companyName") || !columns.has("email")) {
    throw new Error('SignupRequest table is missing required columns');
  }

  const valuesByColumn = [
    ["id", signupRequestId],
    ["organizationId", submission.organizationId || null],
    ["userId", submission.userId || null],
    ["companyName", submission.companyName],
    ["email", submission.normalizedEmail],
    ["contactName", submission.contactName],
    ["phone", submission.phone],
    ["teamSize", submission.teamSize],
    ["currency", submission.selectedCurrency],
    ["websiteUrl", submission.websiteUrl],
    ["logoUrl", submission.logoUrl],
    ["brandPrimaryColor", submission.brandPrimaryColor],
    ["brandSecondaryColor", submission.brandSecondaryColor],
    ["packageTier", submission.packageTier],
    ["requestedModules", submission.requestedModules],
    ["businessType", submission.businessType],
    ["currentWorkflow", submission.currentWorkflow],
    ["communicationChannels", submission.communicationChannels],
    ["timelinePreference", submission.timelinePreference],
    ["projectDetails", submission.projectDetails],
    ["painPoints", submission.painPoints],
    ["additionalNotes", submission.additionalNotes],
    ["status", "NEW"],
    ["source", "website"]
  ];

  const insertColumns = [];
  const insertValues = [];
  const placeholders = [];

  for (const [column, value] of valuesByColumn) {
    if (!columns.has(column)) {
      continue;
    }

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

  return signupRequestId;
};

const buildDebugErrorPayload = (error) => ({
  code: typeof error?.code === "string" ? error.code : null,
  message: typeof error?.message === "string" ? error.message : String(error || ""),
  detail: typeof error?.detail === "string" ? error.detail : null,
  table: typeof error?.table === "string" ? error.table : null,
  column: typeof error?.column === "string" ? error.column : null,
  constraint: typeof error?.constraint === "string" ? error.constraint : null
});

const normalizeOptionalText = (value, maxLength = 2000) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
};

const normalizeEmail = (value) => {
  const normalized = normalizeOptionalText(
    typeof value === "string" ? value.toLowerCase() : value,
    254
  );

  return normalized && EMAIL_PATTERN.test(normalized) ? normalized : null;
};

const normalizeOption = (value, allowedValues, maxLength = 80) => {
  const normalized = normalizeOptionalText(value, maxLength);
  if (!normalized) {
    return null;
  }

  return allowedValues.has(normalized) ? normalized : null;
};

const normalizeHexColor = (value) => {
  const normalized = normalizeOptionalText(value, 7);
  if (!normalized) {
    return null;
  }

  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(normalized) ? normalized : null;
};

const normalizePackageTier = (value) => {
  const normalized = normalizeOptionalText(value, 32);
  if (!normalized) {
    return null;
  }

  const key = normalized.toLowerCase();
  return Object.prototype.hasOwnProperty.call(PACKAGE_RULES, key) ? key : null;
};

const normalizeModuleSelection = (value) => {
  let rawItems = [];

  if (Array.isArray(value)) {
    rawItems = value.filter((item) => typeof item === "string");
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          rawItems = parsed;
        }
      } catch (error) {
        rawItems = trimmed.split(",");
      }
    } else {
      rawItems = trimmed.split(",");
    }
  }

  return rawItems
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const normalizeHttpUrl = (value, maxLength = 300) => {
  const normalized = normalizeOptionalText(value, maxLength);
  if (!normalized) {
    return null;
  }

  const candidate = URL_SCHEME_PATTERN.test(normalized)
    ? normalized
    : `https://${normalized.replace(/^\/+/, "")}`;

  try {
    const parsed = new URL(candidate);

    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
};

const parseEnvOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      try {
        return new URL(item).origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

const ALLOWED_ORIGINS = new Set([
  ...parseEnvOrigins(process.env.ALLOWED_ORIGIN),
  ...parseEnvOrigins(process.env.URL),
  ...parseEnvOrigins(process.env.DEPLOY_PRIME_URL),
  ...parseEnvOrigins(process.env.DEPLOY_URL),
  ...parseEnvOrigins(process.env.SITE_URL),
  ...(process.env.NODE_ENV === "production" ? [] : [...DEV_ALLOWED_ORIGINS])
]);

const getHeaderValue = (headers, name) => {
  if (!headers || typeof headers !== "object") {
    return null;
  }

  const directValue = headers[name];
  if (typeof directValue === "string") {
    return directValue;
  }

  const lowerCaseName = name.toLowerCase();
  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (headerName.toLowerCase() === lowerCaseName && typeof headerValue === "string") {
      return headerValue;
    }
  }

  return null;
};

const normalizeOrigin = (value) => {
  const normalized = normalizeOptionalText(value, 255);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
};

const getPublicRequestOrigin = (event) => {
  const forwardedHost =
    getHeaderValue(event.headers, "x-forwarded-host") ||
    getHeaderValue(event.headers, "host");
  const host = normalizeOptionalText(forwardedHost, 255);

  if (!host) {
    return null;
  }

  const forwardedProto = normalizeOptionalText(
    getHeaderValue(event.headers, "x-forwarded-proto"),
    16
  );
  const protocol =
    forwardedProto ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
};

const isAllowedOrigin = (origin, event) => {
  if (!origin) {
    return true;
  }

  const requestOrigin = getPublicRequestOrigin(event);
  return origin === requestOrigin || ALLOWED_ORIGINS.has(origin);
};

const buildResponseHeaders = (origin, event) => {
  const responseHeaders = { ...BASE_HEADERS };
  const normalizedOrigin = normalizeOrigin(origin);

  if (normalizedOrigin && isAllowedOrigin(normalizedOrigin, event)) {
    responseHeaders["access-control-allow-origin"] = normalizedOrigin;
    responseHeaders.vary = "Origin";
  }

  return responseHeaders;
};

const isModuleAvailableForPackage = (moduleId, packageTier) => {
  const moduleConfig = MODULE_CATALOG[moduleId];
  if (!moduleConfig) {
    return false;
  }

  const moduleRank = TIER_RANK[moduleConfig.minTier] || 0;
  const packageRank = TIER_RANK[packageTier] || 0;

  return packageRank >= moduleRank;
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

const buildUniqueSlug = async (dbClient, companyName) => {
  const base = slugify(companyName);
  if (!base) {
    return `org-${Date.now().toString(36)}`;
  }

  let candidate = base;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const existing = await dbClient.query(
      'SELECT 1 FROM "Organization" WHERE "slug" = $1 LIMIT 1',
      [candidate]
    );

    if (existing.rowCount === 0) {
      return candidate;
    }

    candidate = `${base}-${Math.floor(Math.random() * 9000) + 1000}`;
  }

  return `${base}-${Date.now().toString(36)}`;
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatPreviewValue = (value) => {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "N/A";
  }
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }
  return String(value);
};

const buildPreviewTableHtml = (entries) =>
  entries
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 10px;border:1px solid #e3e3e3;background:#fafafa;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtml(
            label
          )}</td>
          <td style="padding:8px 10px;border:1px solid #e3e3e3;vertical-align:top;">${escapeHtml(
            formatPreviewValue(value)
          )}</td>
        </tr>
      `
    )
    .join("");

const buildSubmissionDetailRows = (submission) => [
  ["Company Name", submission.companyName],
  ["Contact Name", submission.contactName],
  ["Email", submission.normalizedEmail],
  ["Phone", submission.phone],
  ["Business Type", submission.businessType],
  ["Team Size", submission.teamSize],
  ["Preferred Currency", submission.selectedCurrency],
  ["Timeline Preference", submission.timelinePreference],
  ["Package Tier", submission.packageTier],
  ["Requested Modules", submission.requestedModules],
  ["Communication Channels", submission.communicationChannels],
  ["Current Workflow", submission.currentWorkflow],
  ["Pain Points", submission.painPoints],
  ["Project Details", submission.projectDetails],
  ["Additional Notes", submission.additionalNotes],
  ["Website URL", submission.websiteUrl],
  ["Logo URL", submission.logoUrl],
  ["Primary Color", submission.brandPrimaryColor],
  ["Secondary Color", submission.brandSecondaryColor]
];

const buildAdminPreviewHtml = (submission) => {
  const previewRows = [
    ["Request ID", submission.signupRequestId],
    ["Submitted At", submission.submittedAtIso],
    ...buildSubmissionDetailRows(submission),
    ["Organization ID", submission.organizationId]
  ];

  return `
    <div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.45;">
      <h2 style="margin:0 0 12px;">New Faako Client Intake</h2>
      <p style="margin:0 0 16px;">A new signup form was submitted and saved to the database.</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:900px;">
        ${buildPreviewTableHtml(previewRows)}
      </table>
    </div>
  `;
};

const buildClientConfirmationHtml = (submission) => {
  const submissionRows = buildSubmissionDetailRows(submission);

  return `
    <div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.45;">
      <h2 style="margin:0 0 12px;">We received your Faako intake</h2>
      <p style="margin:0 0 16px;">Hi ${escapeHtml(
        submission.contactName || "there"
      )}, thanks for sharing your business details with Faako.</p>
      <p style="margin:0 0 16px;">Our team will review your request and reply with next steps within one business day.</p>
      <p style="margin:0 0 16px;">Here is a copy of the full information you submitted.</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:680px;">
        ${buildPreviewTableHtml(submissionRows)}
      </table>
      <p style="margin:16px 0 0;">Reference: <strong>${escapeHtml(
        submission.signupRequestId
      )}</strong></p>
    </div>
  `;
};

const parseResponseJson = async (response) => {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return { message: responseText };
  }
};

const formatResendFrom = (email, name) => {
  if (!email) {
    return null;
  }

  if (!name || email.includes("<")) {
    return email;
  }

  return `${name} <${email}>`;
};

const sendResendEmail = async ({
  apiKey,
  from,
  to,
  subject,
  html,
  idempotencyKey
}) => {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);

  if (!apiKey || !from || recipients.length === 0 || !subject || !html) {
    return null;
  }

  const response = await fetch(RESEND_EMAILS_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      html
    })
  });

  const result = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(result?.message || result?.error || "Resend email request failed");
  }

  return result;
};

const sendSignupPreviewEmails = async (submission) => {
  const resendApiKey = normalizeOptionalText(process.env.RESEND_API_KEY, 255);
  const resendFromEmail =
    normalizeOptionalText(process.env.RESEND_FROM_EMAIL, 255) ||
    normalizeOptionalText(process.env.RESEND_FROM, 255) ||
    "no-reply@faako.app";
  const resendFromName =
    normalizeOptionalText(process.env.RESEND_FROM_NAME, 120) || "Faako";
  const adminEmail =
    normalizeOptionalText(process.env.INTAKE_ADMIN_EMAIL, 255) ||
    normalizeOptionalText(process.env.ADMIN_EMAIL, 255);

  if (!resendApiKey || !resendFromEmail) {
    return;
  }

  const resendFrom = formatResendFrom(resendFromEmail, resendFromName);

  const sendJobs = [];

  if (adminEmail) {
    sendJobs.push(
      sendResendEmail({
        apiKey: resendApiKey,
        from: resendFrom,
        to: adminEmail,
        subject: `[Faako] New Intake - ${submission.companyName}`,
        html: buildAdminPreviewHtml(submission),
        idempotencyKey: `${submission.signupRequestId}-admin`
      })
    );
  }

  if (submission.normalizedEmail) {
    sendJobs.push(
      sendResendEmail({
        apiKey: resendApiKey,
        from: resendFrom,
        to: submission.normalizedEmail,
        subject: "Faako intake received",
        html: buildClientConfirmationHtml(submission),
        idempotencyKey: `${submission.signupRequestId}-client`
      })
    );
  }

  if (sendJobs.length === 0) {
    return;
  }

  const results = await Promise.allSettled(sendJobs);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Signup email send failed:", result.reason);
    }
  });
};

const parseUrlEncodedPayload = (body) => {
  const payload = Object.create(null);
  const params = new URLSearchParams(body || "");

  for (const [key, value] of params.entries()) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const currentValue = payload[key];
      payload[key] = Array.isArray(currentValue)
        ? [...currentValue, value]
        : [currentValue, value];
    } else {
      payload[key] = value;
    }
  }

  return payload;
};

exports.handler = async (event) => {
  const requestOrigin = normalizeOrigin(getHeaderValue(event.headers, "origin"));
  const headers = buildResponseHeaders(requestOrigin, event);

  if (requestOrigin && !isAllowedOrigin(requestOrigin, event)) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: "Origin not allowed" })
    };
  }

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const rawBody = typeof event.body === "string" ? event.body : "";
  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BODY_BYTES) {
    return {
      statusCode: 413,
      headers,
      body: JSON.stringify({ error: "Request body is too large" })
    };
  }

  const contentTypeHeader = getHeaderValue(event.headers, "content-type") || "";
  const contentType = contentTypeHeader.split(";")[0].trim().toLowerCase();

  if (
    contentType !== "application/json" &&
    contentType !== "application/x-www-form-urlencoded"
  ) {
    return {
      statusCode: 415,
      headers,
      body: JSON.stringify({ error: "Unsupported content type" })
    };
  }

  let payload = {};
  try {
    payload =
      contentType === "application/x-www-form-urlencoded"
        ? parseUrlEncodedPayload(rawBody)
        : JSON.parse(rawBody || "{}");
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid request payload" })
    };
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid request payload" })
    };
  }

  const honeypotValue = normalizeOptionalText(payload[BOT_FIELD_NAME], 255);
  if (honeypotValue) {
    return {
      statusCode: 202,
      headers,
      body: ACCEPTED_RESPONSE_BODY
    };
  }

  const companyName = normalizeOptionalText(payload.companyName, 180);
  const normalizedEmail = normalizeEmail(payload.email);
  const selectedCurrency = normalizeOption(payload.currency, ALLOWED_CURRENCIES, 8) || "USD";

  if (!companyName || !normalizedEmail) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "companyName and email are required" })
    };
  }

  const packageTier = normalizePackageTier(payload.packageTier);
  if (!packageTier) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "packageTier is required and must be starter, professional, or enterprise"
      })
    };
  }

  const requestedModules = [
    ...new Set(normalizeModuleSelection(payload.requestedModules))
  ];

  if (requestedModules.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Please select at least one module" })
    };
  }

  const unknownModules = requestedModules.filter(
    (moduleId) => !Object.prototype.hasOwnProperty.call(MODULE_CATALOG, moduleId)
  );

  if (unknownModules.length > 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "One or more selected modules are invalid",
        modules: unknownModules
      })
    };
  }

  const unavailableModules = requestedModules.filter(
    (moduleId) => !isModuleAvailableForPackage(moduleId, packageTier)
  );

  if (unavailableModules.length > 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: `Selected package does not include ${unavailableModules.join(", ")}`,
        modules: unavailableModules
      })
    };
  }

  const packageRule = PACKAGE_RULES[packageTier];
  if (
    packageRule.maxModules !== null &&
    requestedModules.length > packageRule.maxModules
  ) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: `${packageRule.label} allows up to ${packageRule.maxModules} modules`
      })
    };
  }

  const teamSize = normalizeOption(payload.teamSize, ALLOWED_TEAM_SIZES, 32);
  const contactName = normalizeOptionalText(payload.contactName || payload.fullName, 120);
  const fullName = contactName;
  const phone = normalizeOptionalText(payload.phone, 60);
  const businessType = normalizeOption(payload.businessType, ALLOWED_BUSINESS_TYPES, 80);
  const currentWorkflow = normalizeOptionalText(payload.currentWorkflow, 2500);
  const communicationChannels = [
    ...new Set(normalizeModuleSelection(payload.communicationChannels))
  ];
  const rawWebsiteUrl = normalizeOptionalText(payload.websiteUrl, 300);
  const websiteUrl = rawWebsiteUrl ? normalizeHttpUrl(rawWebsiteUrl, 300) : null;
  const rawLogoUrl = normalizeOptionalText(payload.logoUrl, 300);
  const logoUrl = rawLogoUrl ? normalizeHttpUrl(rawLogoUrl, 300) : null;
  const brandPrimaryColor = normalizeHexColor(payload.brandPrimaryColor);
  const brandSecondaryColor = normalizeHexColor(payload.brandSecondaryColor);
  const timelinePreference = normalizeOption(
    payload.timelinePreference,
    ALLOWED_TIMELINES,
    80
  );
  const painPoints = normalizeOptionalText(payload.painPoints, 2500);
  const projectDetails = normalizeOptionalText(payload.projectDetails, 2500);
  const additionalNotes = normalizeOptionalText(payload.additionalNotes, 2500);

  if (!currentWorkflow) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Please describe your current workflow"
      })
    };
  }

  if (payload.currency && !selectedCurrency) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Currency selection is invalid" })
    };
  }

  if (payload.teamSize && !teamSize) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Team size selection is invalid" })
    };
  }

  if (payload.businessType && !businessType) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Business type selection is invalid" })
    };
  }

  if (payload.timelinePreference && !timelinePreference) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Timeline selection is invalid" })
    };
  }

  if (communicationChannels.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Please choose at least one current communication channel"
      })
    };
  }

  const unknownChannels = communicationChannels.filter(
    (channel) => !ALLOWED_COMMUNICATION_CHANNELS.has(channel)
  );
  if (unknownChannels.length > 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "One or more communication channels are invalid",
        channels: unknownChannels
      })
    };
  }

  if (rawWebsiteUrl && !websiteUrl) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Website URL must use http or https" })
    };
  }

  if (rawLogoUrl && !logoUrl) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Logo URL must use http or https" })
    };
  }

  if (!normalizeOptionalText(process.env.DATABASE_URL, 4096)) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: "Signup service is not configured",
        ...(process.env.NODE_ENV === "production"
          ? {}
          : { debug: { message: "DATABASE_URL is missing" } })
      })
    };
  }

  const dbClient = await pool.connect();

  try {
    const recentDuplicate = await dbClient.query(
      `
        SELECT "id"
        FROM "SignupRequest"
        WHERE "email" = $1
          AND "companyName" = $2
          AND "createdAt" >= NOW() - INTERVAL '5 minutes'
        LIMIT 1
      `,
      [normalizedEmail, companyName]
    );

    if (recentDuplicate.rowCount > 0) {
      return {
        statusCode: 202,
        headers,
        body: ACCEPTED_RESPONSE_BODY
      };
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
        "currency"
      ])) &&
      (await tableHasRequiredColumns(dbClient, "User", [
        "id",
        "email",
        "fullName",
        "status"
      ])) &&
      (await tableHasRequiredColumns(dbClient, "Membership", [
        "id",
        "organizationId",
        "userId",
        "role"
      ]));

    let organization = null;
    let user = null;

    if (canPersistIdentityGraph) {
      const baseSlug = slugify(companyName);

      if (baseSlug.length > 0) {
        const organizationResult = await dbClient.query(
          'SELECT "id", "slug", "primaryEmail", "teamSize", "currency" FROM "Organization" WHERE "slug" = $1 LIMIT 1',
          [baseSlug]
        );
        organization = organizationResult.rows[0] || null;
      }

      if (!organization) {
        const slug = await buildUniqueSlug(dbClient, companyName);
        const organizationId = createId();
        const insertOrganization = await dbClient.query(
          `
            INSERT INTO "Organization" (
              "id",
              "name",
              "slug",
              "status",
              "primaryEmail",
              "teamSize",
              "currency",
              "createdAt",
              "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING "id", "slug", "primaryEmail", "teamSize", "currency"
          `,
          [
            organizationId,
            companyName,
            slug,
            "PENDING",
            normalizedEmail,
            teamSize,
            selectedCurrency
          ]
        );

        organization = insertOrganization.rows[0];
      } else {
        const updates = [];
        const values = [];

        if (!organization.primaryEmail && normalizedEmail) {
          values.push(normalizedEmail);
          updates.push(`"primaryEmail" = $${values.length}`);
        }

        if (!organization.teamSize && teamSize) {
          values.push(teamSize);
          updates.push(`"teamSize" = $${values.length}`);
        }

        if (!organization.currency && selectedCurrency) {
          values.push(selectedCurrency);
          updates.push(`"currency" = $${values.length}`);
        }

        if (updates.length > 0) {
          values.push(organization.id);

          const updatedOrganization = await dbClient.query(
            `
              UPDATE "Organization"
              SET ${updates.join(", ")}, "updatedAt" = NOW()
              WHERE "id" = $${values.length}
              RETURNING "id", "slug", "primaryEmail", "teamSize", "currency"
            `,
            values
          );

          organization = updatedOrganization.rows[0];
        }
      }

      const userInsert = await dbClient.query(
        `
          INSERT INTO "User" (
            "id",
            "email",
            "fullName",
            "status",
            "createdAt",
            "updatedAt"
          )
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT ("email")
          DO UPDATE
          SET
            "fullName" = COALESCE(EXCLUDED."fullName", "User"."fullName"),
            "updatedAt" = NOW()
          RETURNING "id"
        `,
        [createId(), normalizedEmail, fullName, "PENDING"]
      );

      user = userInsert.rows[0];

      await dbClient.query(
        `
          INSERT INTO "Membership" (
            "id",
            "organizationId",
            "userId",
            "role",
            "createdAt"
          )
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT ("organizationId", "userId")
          DO NOTHING
        `,
        [createId(), organization.id, user.id, "owner"]
      );
    }

    const signupRequestId = await insertSignupRequestCompat(dbClient, {
      organizationId: organization?.id || null,
      userId: user?.id || null,
      companyName,
      normalizedEmail,
      contactName,
      phone,
      teamSize,
      selectedCurrency,
      websiteUrl,
      logoUrl,
      brandPrimaryColor,
      brandSecondaryColor,
      packageTier,
      requestedModules,
      businessType,
      currentWorkflow,
      communicationChannels,
      timelinePreference,
      projectDetails,
      painPoints,
      additionalNotes
    });

    await dbClient.query("COMMIT");

    await sendSignupPreviewEmails({
      signupRequestId,
      submittedAtIso: new Date().toISOString(),
      organizationId: organization.id,
      companyName,
      contactName,
      normalizedEmail,
      phone,
      businessType,
      teamSize,
      selectedCurrency,
      timelinePreference,
      packageTier,
      requestedModules,
      communicationChannels,
      currentWorkflow,
      painPoints,
      projectDetails,
      additionalNotes,
      websiteUrl,
      logoUrl,
      brandPrimaryColor,
      brandSecondaryColor
    });

    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({
        ok: true,
        message: "Signup received",
        requestId: signupRequestId
      })
    };
  } catch (error) {
    await dbClient.query("ROLLBACK").catch(() => {});

    const debugError = buildDebugErrorPayload(error);
    console.error("Unable to save signup request:", debugError);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Unable to save signup request",
        ...(process.env.NODE_ENV === "production" ? {} : { debug: debugError })
      })
    };
  } finally {
    dbClient.release();
  }
};
