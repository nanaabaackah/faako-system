const crypto = require("node:crypto");
const { Pool } = require("pg");
const { canExposeDebugDetails, resolveDatabaseUrl } = require("../../src/runtimeConfig");
const {
  EMAIL_THEMES,
  renderEmailLayout,
  renderKeyValueTable,
  renderNotice,
  renderPanel,
  renderParagraphs
} = require("../../../../packages/email-kit/src/index.cjs");

const BASE_HEADERS = {
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "content-type": "application/json",
  "permissions-policy": "camera=(), geolocation=(), microphone=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

const DEV_ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:5177",
  "http://localhost:8888",
  "http://127.0.0.1:8888",
  "http://localhost:8889",
  "http://127.0.0.1:8889",
  "https://faako.nanaabaackah.com",
]);

let pool = global.__faakoPgPool || null;
let rateLimitStore = global.__faakoSignupRateLimitStore || null;
let lastPersistentRateLimitPruneAt = global.__faakoPersistentRateLimitPruneAt || 0;

const getPool = () => {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: resolveDatabaseUrl()
  });

  if (!global.__faakoPgPool) {
    global.__faakoPgPool = pool;
  }

  return pool;
};

const getRateLimitStore = () => {
  if (rateLimitStore) {
    return rateLimitStore;
  }

  rateLimitStore = new Map();

  if (!global.__faakoSignupRateLimitStore) {
    global.__faakoSignupRateLimitStore = rateLimitStore;
  }

  return rateLimitStore;
};

const setLastPersistentRateLimitPruneAt = (value) => {
  lastPersistentRateLimitPruneAt = value;
  global.__faakoPersistentRateLimitPruneAt = value;
};

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
  "shop-storefront": { minTier: "starter" },
  payments: { minTier: "starter" },
  bookings: { minTier: "starter" },
  inventory: { minTier: "professional" },
  orders: { minTier: "professional" },
  receipts: { minTier: "professional" },
  crm: { minTier: "professional" },
  "crm-customers": { minTier: "professional" },
  "accounting-finance": { minTier: "professional" },
  dashboard: { minTier: "professional" },
  reports: { minTier: "professional" },
  "reports-analytics": { minTier: "professional" },
  delivery: { minTier: "professional" },
  "delivery-fulfillment": { minTier: "professional" },
  scheduler: { minTier: "professional" },
  "directory-team": { minTier: "professional" },
  "proposal-generator": { minTier: "enterprise" },
  notifications: { minTier: "enterprise" },
  documents: { minTier: "enterprise" },
  "maintenance-support": { minTier: "enterprise" },
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
  "in-app-admin",
  "other"
]);

const ALLOWED_CURRENCIES = new Set(["GHS", "USD", "NGN", "EUR", "GBP", "CAD", "AUD", "ZAR"]);
const ALLOWED_BUSINESS_TYPES = new Set(["sell", "rent", "both"]);
const ALLOWED_TEAM_SIZES = new Set(["1-10", "11-50", "51-200", "201+", "custom"]);
const ALLOWED_TIMELINES = new Set(["immediately", "soon", "exploring"]);
const BOT_FIELD_NAME = "companyFax";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS_PER_IP = 20;
const RATE_LIMIT_MAX_REQUESTS_PER_EMAIL = 5;
const RATE_LIMIT_STORE_MAX_ENTRIES = 5000;
const PERSISTENT_RATE_LIMIT_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const ACCEPTED_RESPONSE_BODY = JSON.stringify({
  ok: true,
  message: "Thanks. We have received your form."
});
const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_TEST_EMAIL_FORWARD_TO = "faako@nanaabaackah.com";
const NON_PRODUCTION_APP_ENVS = new Set([
  "development",
  "dev",
  "local",
  "test",
  "staging",
  "preview"
]);
const NON_PRODUCTION_NODE_ENVS = new Set(["development", "test"]);
const FAAKO_EMAIL_THEME = EMAIL_THEMES.faako;

const createId = () => crypto.randomUUID();
const createRandomSuffix = () => crypto.randomInt(1000, 10000);

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

const normalizeTeamSize = (value) => {
  const normalized = normalizeOptionalText(value, 60);
  if (!normalized) {
    return null;
  }

  return ALLOWED_TEAM_SIZES.has(normalized) ? normalized : normalized;
};

const FORBIDDEN_CREDENTIAL_KEY_PATTERN =
  /(?:api[_-]?key|secret|token|password|private[_-]?key|bank[_-]?(?:login|password|pin))/i;
const FORBIDDEN_CREDENTIAL_VALUE_PATTERN =
  /\b(?:sk_live|sk_test|rk_live|rk_test|whsec_|xox[baprs]-|SG\.|api[_ -]?key\s*[:=]|secret[_ -]?key\s*[:=]|access[_ -]?token\s*[:=]|password\s*[:=])/i;

const findCredentialLikeField = (value, path = []) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findCredentialLikeField(value[index], [...path, String(index)]);
      if (match) {
        return match;
      }
    }
    return null;
  }

  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
        return [...path, key].join(".");
      }

      const match = findCredentialLikeField(nestedValue, [...path, key]);
      if (match) {
        return match;
      }
    }
    return null;
  }

  if (typeof value === "string" && FORBIDDEN_CREDENTIAL_VALUE_PATTERN.test(value)) {
    return path.join(".") || "payload";
  }

  return null;
};

const normalizeStringList = (value, maxItems = 30, maxLength = 120) => {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? value.split(",")
      : [];

  return [
    ...new Set(
      values
        .filter((item) => typeof item === "string")
        .map((item) => normalizeOptionalText(item, maxLength))
        .filter(Boolean)
    )
  ].slice(0, maxItems);
};

const normalizeIntakeSection = (section, fieldLimits = {}) => {
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return {};
  }

  const normalized = {};

  for (const [key, value] of Object.entries(section)) {
    if (Array.isArray(value)) {
      normalized[key] = normalizeStringList(value, 40, 160);
    } else if (typeof value === "boolean") {
      normalized[key] = value;
    } else if (typeof value === "string") {
      normalized[key] = normalizeOptionalText(value, fieldLimits[key] || 1200) || "";
    }
  }

  return normalized;
};

const normalizeOnboardingIntake = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    company: normalizeIntakeSection(value.company, {
      address: 1600
    }),
    contact: normalizeIntakeSection(value.contact),
    operations: normalizeIntakeSection(value.operations, {
      offerings: 2200,
      currentTools: 1600,
      workflowProblems: 2200,
      priorityGoals: 1600
    }),
    modules: normalizeIntakeSection(value.modules, {
      customNotes: 2200
    }),
    payments: normalizeIntakeSection(value.payments),
    communications: normalizeIntakeSection(value.communications),
    domain: normalizeIntakeSection(value.domain),
    admins: normalizeIntakeSection(value.admins),
    security: normalizeIntakeSection(value.security, {
      privacyConcerns: 2200
    })
  };
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

const SHOULD_ALLOW_DEV_ORIGINS =
  process.env.NODE_ENV !== "production" ||
  NON_PRODUCTION_APP_ENVS.has(
    String(process.env.APP_ENV || process.env.CONTEXT || "").trim().toLowerCase()
  );

const ALLOWED_ORIGINS = new Set([
  ...parseEnvOrigins(process.env.ALLOWED_ORIGIN),
  ...parseEnvOrigins(process.env.URL),
  ...parseEnvOrigins(process.env.DEPLOY_PRIME_URL),
  ...parseEnvOrigins(process.env.DEPLOY_URL),
  ...parseEnvOrigins(process.env.SITE_URL),
  ...(SHOULD_ALLOW_DEV_ORIGINS ? [...DEV_ALLOWED_ORIGINS] : [])
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

const normalizeIpAddress = (value) => {
  const normalized = normalizeOptionalText(value, 256);
  if (!normalized) {
    return null;
  }

  const candidate = normalized.split(",")[0].trim().replace(/^\[(.*)\]$/, "$1");
  return candidate || null;
};

const getClientIp = (event) =>
  normalizeIpAddress(
    getHeaderValue(event.headers, "x-nf-client-connection-ip") ||
      getHeaderValue(event.headers, "x-forwarded-for") ||
      getHeaderValue(event.headers, "client-ip") ||
      getHeaderValue(event.headers, "x-real-ip")
  );

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

const pruneRateLimitStore = (store, now) => {
  for (const [key, entry] of store.entries()) {
    if (!entry || entry.resetAt <= now) {
      store.delete(key);
    }
  }

  if (store.size <= RATE_LIMIT_STORE_MAX_ENTRIES) {
    return;
  }

  const overflowCount = store.size - RATE_LIMIT_STORE_MAX_ENTRIES;
  const oldestKeys = [...store.entries()]
    .sort((left, right) => left[1].resetAt - right[1].resetAt)
    .slice(0, overflowCount)
    .map(([key]) => key);

  oldestKeys.forEach((key) => {
    store.delete(key);
  });
};

const consumeRateLimit = (bucketKey, limit, now = Date.now()) => {
  const store = getRateLimitStore();
  pruneRateLimitStore(store, now);

  const existing = store.get(bucketKey);
  const entry =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
      : existing;

  entry.count += 1;
  store.set(bucketKey, entry);

  return {
    limited: entry.count > limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
};

const buildRateLimitResponse = (headers, retryAfterSeconds) => ({
  statusCode: 429,
  headers: {
    ...headers,
    "retry-after": String(retryAfterSeconds),
  },
  body: JSON.stringify({
    error: "Too many signup attempts. Please try again later.",
  }),
});

const getRateLimitSecret = () => normalizeOptionalText(process.env.RATE_LIMIT_SECRET, 512);

const buildRateLimitBucketKey = (scope, identifier) => {
  const normalizedScope = normalizeOptionalText(scope, 64);
  const normalizedIdentifier = normalizeOptionalText(identifier, 512);

  if (!normalizedScope || !normalizedIdentifier) {
    return null;
  }

  const secret = getRateLimitSecret();
  const payload = `${normalizedScope}:${normalizedIdentifier}`;
  const digest = secret
    ? crypto.createHmac("sha256", secret).update(payload).digest("hex")
    : crypto.createHash("sha256").update(payload).digest("hex");

  return `${normalizedScope}:${digest}`;
};

const maybePrunePersistentRateLimits = async (dbClient, now = Date.now()) => {
  if (
    lastPersistentRateLimitPruneAt &&
    now - lastPersistentRateLimitPruneAt < PERSISTENT_RATE_LIMIT_PRUNE_INTERVAL_MS
  ) {
    return;
  }

  setLastPersistentRateLimitPruneAt(now);
  await dbClient.query('DELETE FROM "RequestThrottle" WHERE "expiresAt" <= CURRENT_TIMESTAMP');
};

const consumePersistentRateLimit = async (
  dbClient,
  { scope, identifier, limit, windowMs = RATE_LIMIT_WINDOW_MS },
) => {
  const bucketKey = buildRateLimitBucketKey(scope, identifier);
  if (!bucketKey) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const result = await dbClient.query(
    `
      INSERT INTO "RequestThrottle" (
        "bucketKey",
        "scope",
        "hitCount",
        "windowStart",
        "expiresAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + ($3::integer * INTERVAL '1 second'),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("bucketKey")
      DO UPDATE
      SET
        "scope" = EXCLUDED."scope",
        "hitCount" = CASE
          WHEN "RequestThrottle"."expiresAt" <= CURRENT_TIMESTAMP THEN 1
          ELSE "RequestThrottle"."hitCount" + 1
        END,
        "windowStart" = CASE
          WHEN "RequestThrottle"."expiresAt" <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP
          ELSE "RequestThrottle"."windowStart"
        END,
        "expiresAt" = CASE
          WHEN "RequestThrottle"."expiresAt" <= CURRENT_TIMESTAMP
            THEN CURRENT_TIMESTAMP + ($3::integer * INTERVAL '1 second')
          ELSE "RequestThrottle"."expiresAt"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING
        "hitCount",
        GREATEST(
          1,
          CEIL(EXTRACT(EPOCH FROM ("expiresAt" - CURRENT_TIMESTAMP)))
        )::integer AS "retryAfterSeconds"
    `,
    [bucketKey, scope, windowSeconds],
  );

  const row = result.rows[0] || {};
  const hitCount = Number(row.hitCount) || 0;
  const retryAfterSeconds = Math.max(1, Number(row.retryAfterSeconds) || windowSeconds);

  return {
    limited: hitCount > limit,
    retryAfterSeconds,
  };
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

    candidate = `${base}-${createRandomSuffix()}`;
  }

  return `${base}-${Date.now().toString(36)}`;
};

const formatPreviewValue = (value) => {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "N/A";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }
  return String(value);
};

const SECTION_TITLES = {
  company: "Company Details",
  contact: "Primary Contact",
  operations: "Business Operations",
  modules: "Required Apps / Modules",
  payments: "Payment Preferences",
  communications: "Communication Preferences",
  domain: "Domain & Email Details",
  admins: "Admin Users",
  security: "Security & Compliance"
};

const FIELD_LABELS = {
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
    logoStatus: "Logo"
  },
  contact: {
    name: "Contact name",
    roleTitle: "Role/title",
    email: "Email",
    phoneWhatsapp: "Phone/WhatsApp",
    preferredContactMethod: "Preferred contact method"
  },
  operations: {
    offerings: "What the business sells/provides",
    staffCount: "Number of staff/users",
    branchCount: "Branches/locations",
    currentTools: "Current tools used",
    workflowProblems: "Current workflow problems",
    launchTimeline: "Expected launch timeline",
    priorityGoals: "Priority goals"
  },
  modules: {
    selected: "Selected modules",
    customNotes: "Custom module notes"
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
    notificationPreference: "Payment notification preference"
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
    notificationTypes: "Notification types wanted"
  },
  domain: {
    hasDomain: "Has domain",
    domainName: "Domain name",
    domainProvider: "Domain provider",
    hasBusinessEmail: "Has business email",
    desiredEmailAddresses: "Desired email addresses",
    needsHostingSetup: "Needs hosting setup",
    currentWebsiteUrl: "Current website URL"
  },
  admins: {
    ownerName: "Owner/admin name",
    ownerEmail: "Owner/admin email",
    staffAccountsNeeded: "Number of staff accounts needed",
    rolesNeeded: "Roles needed"
  },
  security: {
    roleBasedAccess: "Needs role-based access",
    auditLogs: "Needs audit logs",
    handlesPersonalData: "Handles customer personal data",
    handlesOnlinePayments: "Handles online payments",
    backups: "Needs backups",
    privacyConcerns: "Data/privacy concerns",
    consent: "Setup review consent"
  }
};

const humanizeKey = (key) =>
  String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (match) => match.toUpperCase());

const buildOnboardingSections = (intake) => {
  if (!intake) {
    return [];
  }

  return Object.entries(SECTION_TITLES)
    .map(([sectionKey, title]) => {
      const section = intake[sectionKey];
      if (!section || typeof section !== "object") {
        return null;
      }

      const rows = Object.entries(section)
        .map(([fieldKey, value]) => [
          FIELD_LABELS[sectionKey]?.[fieldKey] || humanizeKey(fieldKey),
          value
        ])
        .filter(([, value]) => formatPreviewValue(value) !== "N/A");

      return rows.length ? { key: sectionKey, title, rows } : null;
    })
    .filter(Boolean);
};

const buildSubmissionDetailRows = (submission) => {
  if (submission.onboardingSections?.length) {
    return [
      ["Company Name", submission.companyName],
      ["Contact Name", submission.contactName],
      ["Email", submission.normalizedEmail],
      ["Phone", submission.phone],
      ["Selected Modules", submission.requestedModules],
      ["Payment Provider", submission.onboardingIntake?.payments?.preferredProvider],
      ["Payment Methods", submission.onboardingIntake?.payments?.methods],
      ["Customer Notification Channels", submission.communicationChannels],
      ["Launch Timeline", submission.onboardingIntake?.operations?.launchTimeline],
      ["Setup Checklist", submission.setupChecklist]
    ];
  }

  return [
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
};

const buildCompactIntakeNotes = (onboardingSections, setupChecklist, fallbackNotes) => {
  if (!onboardingSections?.length) {
    return normalizeOptionalText(fallbackNotes, 5000);
  }

  const lines = [
    "Client onboarding intake summary:",
    "",
    ...onboardingSections.flatMap((section) => [
      section.title,
      ...section.rows.map(([label, value]) => `- ${label}: ${formatPreviewValue(value)}`),
      ""
    ]),
    "Internal setup checklist:",
    ...(setupChecklist?.length ? setupChecklist : ["Manual Faako setup review"]).map(
      (item) => `- ${item}`
    )
  ];

  return lines.join("\n").slice(0, 8000);
};

const buildForwardingNoticeHtml = (intendedRecipient) =>
  intendedRecipient
    ? renderNotice({
        theme: FAAKO_EMAIL_THEME,
        title: "Test email forwarding active",
        tone: "warning",
        lines: [`Original recipient: ${intendedRecipient}`]
      })
    : "";

const buildAdminPreviewHtml = (submission, { intendedRecipient = "" } = {}) => {
  const previewRows = [
    ["Request ID", submission.signupRequestId],
    ["Submitted At", submission.submittedAtIso],
    ...buildSubmissionDetailRows(submission),
    ["Organization ID", submission.organizationId]
  ];

  return renderEmailLayout({
    theme: FAAKO_EMAIL_THEME,
    preheader: `New Faako intake from ${submission.companyName}.`,
    brandName: "Faako",
    brandTagline: "Client intake pipeline",
    eyebrow: "New intake",
    title: "New client intake",
    subtitle: "A new signup form was submitted and saved to the database.",
    introHtml: [
      buildForwardingNoticeHtml(intendedRecipient),
      renderParagraphs(
        "A new client inquiry has been received. Review the submission details below and follow up with the business contact.",
        { theme: FAAKO_EMAIL_THEME }
      )
    ].join(""),
    bodyHtml: renderPanel({
      theme: FAAKO_EMAIL_THEME,
      eyebrow: "Request overview",
      title: submission.companyName || "Faako intake",
      bodyHtml: renderKeyValueTable(
        previewRows.map(([label, value]) => [label, formatPreviewValue(value)]),
        { theme: FAAKO_EMAIL_THEME, labelWidth: "34%" }
      )
    }),
    footerHtml: `<p style="margin:0;color:${FAAKO_EMAIL_THEME.muted};font:400 13px/1.65 Arial,sans-serif;">Sent from the Faako intake workflow.</p>`
  });
};

const buildClientConfirmationHtml = (submission, { intendedRecipient = "" } = {}) => {
  const submissionRows = buildSubmissionDetailRows(submission);

  return renderEmailLayout({
    theme: FAAKO_EMAIL_THEME,
    preheader: `Faako received your intake for ${submission.companyName}.`,
    brandName: "Faako",
    brandTagline: "Business systems built around your workflow",
    eyebrow: "Submission received",
    title: "We received your intake",
    subtitle: "Thanks for sharing your business details with Faako.",
    introHtml: [
      buildForwardingNoticeHtml(intendedRecipient),
      renderParagraphs(
        [
          `Hi ${submission.contactName || "there"},`,
          "Our team will review your request and reply with next steps within one business day.",
          "Here is a copy of the information you submitted for our review."
        ],
        { theme: FAAKO_EMAIL_THEME }
      )
    ].join(""),
    bodyHtml: [
      renderPanel({
        theme: FAAKO_EMAIL_THEME,
        eyebrow: "Reference",
        title: submission.companyName || "Your submission",
        bodyHtml: renderKeyValueTable(
          [
            ["Reference ID", formatPreviewValue(submission.signupRequestId)],
            ["Submitted at", formatPreviewValue(submission.submittedAtIso)],
            ["Package tier", formatPreviewValue(submission.packageTier)],
            ["Requested modules", formatPreviewValue(submission.requestedModules)]
          ],
          { theme: FAAKO_EMAIL_THEME, labelWidth: "34%" }
        )
      }),
      renderPanel({
        theme: FAAKO_EMAIL_THEME,
        title: "Submission details",
        bodyHtml: renderKeyValueTable(
          submissionRows.map(([label, value]) => [label, formatPreviewValue(value)]),
          { theme: FAAKO_EMAIL_THEME, labelWidth: "34%" }
        )
      })
    ].join(""),
    footerHtml: `<p style="margin:0;color:${FAAKO_EMAIL_THEME.muted};font:400 13px/1.65 Arial,sans-serif;">Keep this email for your records while we review the request.</p>`
  });
};

const normalizePdfText = (value, maxLength = 1800) =>
  formatPreviewValue(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const escapePdfText = (value) =>
  normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapPdfText = (value, maxChars = 86) => {
  const words = normalizePdfText(value).split(" ").filter(Boolean);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > maxChars && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : ["N/A"];
};

const createOnboardingPdfBuffer = (submission) => {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const pages = [];
  let page = null;
  let y = 0;

  const drawText = (text, x, lineY, size = 10, font = "F1", color = "0.08 0.1 0.14") => {
    page.commands.push(
      `BT /${font} ${size} Tf ${color} rg ${x} ${lineY} Td (${escapePdfText(text)}) Tj ET`
    );
  };

  const addPage = () => {
    page = { commands: [] };
    pages.push(page);
    page.commands.push("0.06 0.19 0.15 rg 0 738 612 54 re f");
    drawText("Faako", margin, 760, 18, "F2", "1 1 1");
    drawText("Client onboarding intake summary", margin, 743, 9, "F1", "0.86 0.95 0.91");
    y = 710;
  };

  const ensureSpace = (needed = 36) => {
    if (!page || y - needed < margin) {
      addPage();
    }
  };

  const addHeading = (text) => {
    ensureSpace(48);
    y -= 12;
    drawText(text, margin, y, 14, "F2", "0.08 0.1 0.14");
    y -= 16;
  };

  const addRow = (label, value) => {
    const cleanLabel = normalizePdfText(label, 120);
    const valueLines = wrapPdfText(value, 78);
    ensureSpace(22 + valueLines.length * 12);
    drawText(cleanLabel, margin, y, 8, "F2", "0.3 0.35 0.42");
    y -= 11;
    for (const line of valueLines) {
      drawText(line, margin + 14, y, 9.5, "F1", "0.08 0.1 0.14");
      y -= 12;
    }
    y -= 2;
  };

  addPage();
  drawText(submission.companyName || "Faako onboarding intake", margin, y, 20, "F2");
  y -= 24;
  drawText(`Submission date: ${submission.submittedAtIso || new Date().toISOString()}`, margin, y, 9);
  y -= 14;
  drawText(`Reference: ${submission.signupRequestId || "Pending"}`, margin, y, 9);
  y -= 18;

  const sections = submission.onboardingSections?.length
    ? submission.onboardingSections
    : [{ title: "Submission Details", rows: buildSubmissionDetailRows(submission) }];

  for (const section of sections) {
    addHeading(section.title);
    for (const [label, value] of section.rows) {
      addRow(label, value);
    }
  }

  addHeading("Next Steps");
  const checklist = submission.setupChecklist?.length
    ? submission.setupChecklist
    : ["Faako will review the intake and follow up with secure setup steps."];
  checklist.forEach((item) => addRow("Setup item", item));
  addRow(
    "Security note",
    "This PDF intentionally excludes API keys, passwords, tokens, private banking credentials, and internal-only secrets."
  );

  pages.forEach((pdfPage, index) => {
    const currentPage = page;
    page = pdfPage;
    drawText(`Page ${index + 1} of ${pages.length}`, pageWidth - 112, 28, 8, "F1", "0.42 0.47 0.54");
    page = currentPage;
  });

  const objects = [];
  objects[1] = "";
  objects[2] = "";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  const pageObjectIds = [];
  for (const pdfPage of pages) {
    const content = pdfPage.commands.join("\n");
    const contentId = objects.length;
    objects[contentId] = `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`;
    const pageId = objects.length;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageObjectIds.push(pageId);
  }

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, "utf8");
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
};

const buildOnboardingPdfAttachment = (submission) => {
  const safeCompanySlug = slugify(submission.companyName || "faako-onboarding") || "faako-onboarding";
  return {
    filename: `${safeCompanySlug}-onboarding-summary.pdf`,
    content: createOnboardingPdfBuffer(submission).toString("base64")
  };
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

const normalizeRuntimeValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const resolveEmailForwardingRecipient = () => {
  const explicitRecipient = normalizeEmail(process.env.EMAIL_FORCE_TO);
  if (explicitRecipient) {
    return explicitRecipient;
  }

  const deployContext = normalizeRuntimeValue(process.env.CONTEXT);
  if (deployContext && deployContext !== "production") {
    return DEFAULT_TEST_EMAIL_FORWARD_TO;
  }

  const appEnv = normalizeRuntimeValue(process.env.APP_ENV);
  if (NON_PRODUCTION_APP_ENVS.has(appEnv)) {
    return DEFAULT_TEST_EMAIL_FORWARD_TO;
  }

  const nodeEnv = normalizeRuntimeValue(process.env.NODE_ENV);
  if (NON_PRODUCTION_NODE_ENVS.has(nodeEnv)) {
    return DEFAULT_TEST_EMAIL_FORWARD_TO;
  }

  return null;
};

const sendResendEmail = async ({
  apiKey,
  from,
  to,
  subject,
  html,
  attachments = [],
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
      html,
      ...(attachments.length ? { attachments } : {})
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
    normalizeOptionalText(process.env.FAAKO_ONBOARDING_FROM_EMAIL, 255) ||
    normalizeOptionalText(process.env.RESEND_FROM_EMAIL, 255) ||
    normalizeOptionalText(process.env.RESEND_FROM, 255) ||
    "no-reply@faako.app";
  const resendFromName =
    normalizeOptionalText(process.env.FAAKO_ONBOARDING_FROM_NAME, 120) ||
    normalizeOptionalText(process.env.RESEND_FROM_NAME, 120) ||
    "Faako";
  const adminEmail =
    normalizeOptionalText(process.env.FAAKO_ONBOARDING_ADMIN_EMAIL, 255) ||
    normalizeOptionalText(process.env.INTAKE_ADMIN_EMAIL, 255) ||
    normalizeOptionalText(process.env.ADMIN_EMAIL, 255);
  const forwardedRecipient = resolveEmailForwardingRecipient();

  if (!resendApiKey || !resendFromEmail) {
    return;
  }

  const resendFrom = formatResendFrom(resendFromEmail, resendFromName);
  const pdfAttachment = buildOnboardingPdfAttachment(submission);

  const sendJobs = [];

  if (adminEmail) {
    sendJobs.push(
      sendResendEmail({
        apiKey: resendApiKey,
        from: resendFrom,
        to: forwardedRecipient || adminEmail,
        subject: `${forwardedRecipient ? "[Test Forward] " : ""}[Faako] New Intake - ${submission.companyName}`,
        html: buildAdminPreviewHtml(submission, {
          intendedRecipient: forwardedRecipient ? adminEmail : ""
        }),
        attachments: [pdfAttachment],
        idempotencyKey: `${submission.signupRequestId}-admin`
      })
    );
  }

  if (submission.normalizedEmail) {
    sendJobs.push(
      sendResendEmail({
        apiKey: resendApiKey,
        from: resendFrom,
        to: forwardedRecipient || submission.normalizedEmail,
        subject: `${forwardedRecipient ? "[Test Forward] " : ""}Faako intake received`,
        html: buildClientConfirmationHtml(submission, {
          intendedRecipient: forwardedRecipient ? submission.normalizedEmail : ""
        }),
        attachments: [pdfAttachment],
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
      console.error("Signup email send failed:", buildDebugErrorPayload(result.reason));
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

const parseStructuredFormValue = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

exports.handler = async (event) => {
  const requestOrigin = normalizeOrigin(getHeaderValue(event.headers, "origin"));
  const headers = buildResponseHeaders(requestOrigin, event);
  const debugDetailsAllowed = canExposeDebugDetails();

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

  const clientIp = getClientIp(event) || "unknown";
  const ipRateLimit = consumeRateLimit(`ip:${clientIp}`, RATE_LIMIT_MAX_REQUESTS_PER_IP);
  if (ipRateLimit.limited) {
    return buildRateLimitResponse(headers, ipRateLimit.retryAfterSeconds);
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

  const structuredPayload = {
    ...payload,
    intake: parseStructuredFormValue(payload.intake),
    setupChecklist: parseStructuredFormValue(payload.setupChecklist)
  };

  const credentialLikeField = findCredentialLikeField(structuredPayload);
  if (credentialLikeField) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error:
          "Please remove API keys, passwords, tokens, private banking credentials, or other setup secrets from the intake form.",
        field: credentialLikeField
      })
    };
  }

  const onboardingIntake = normalizeOnboardingIntake(structuredPayload.intake);
  const onboardingSections = buildOnboardingSections(onboardingIntake);
  const setupChecklist = normalizeStringList(structuredPayload.setupChecklist, 30, 160);

  if (onboardingIntake && onboardingIntake.security?.consent !== true) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Please confirm that Faako will review setup and security before launch."
      })
    };
  }

  const companyName = normalizeOptionalText(payload.companyName, 180);
  const normalizedEmail = normalizeEmail(payload.email);
  const requestedCurrency = normalizeOptionalText(payload.currency, 8);
  const selectedCurrency = requestedCurrency
    ? normalizeOption(requestedCurrency.toUpperCase(), ALLOWED_CURRENCIES, 8)
    : "USD";

  if (!companyName || !normalizedEmail) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "companyName and email are required" })
    };
  }

  const emailRateLimit = consumeRateLimit(
    `email:${normalizedEmail}`,
    RATE_LIMIT_MAX_REQUESTS_PER_EMAIL
  );
  if (emailRateLimit.limited) {
    return buildRateLimitResponse(headers, emailRateLimit.retryAfterSeconds);
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

  const teamSize = normalizeTeamSize(payload.teamSize);
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
  const additionalNotes = buildCompactIntakeNotes(
    onboardingSections,
    setupChecklist,
    payload.additionalNotes
  );

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

  let databaseUrl = "";

  try {
    databaseUrl = resolveDatabaseUrl();
  } catch (error) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: "Signup service is not configured",
        ...(debugDetailsAllowed
          ? {
              debug: {
                message: error instanceof Error ? error.message : "Database configuration is invalid"
              }
            }
          : {})
      })
    };
  }

  if (!normalizeOptionalText(databaseUrl, 4096)) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: "Signup service is not configured",
        ...(debugDetailsAllowed
          ? { debug: { message: "Resolved database URL is missing" } }
          : {})
      })
    };
  }

  const dbClient = await getPool().connect();

  try {
    const canPersistRequestThrottle = await tableHasRequiredColumns(
      dbClient,
      "RequestThrottle",
      ["bucketKey", "scope", "hitCount", "windowStart", "expiresAt"]
    );

    if (canPersistRequestThrottle) {
      await maybePrunePersistentRateLimits(dbClient);

      const persistentIpRateLimit = await consumePersistentRateLimit(dbClient, {
        scope: "signup-ip",
        identifier: clientIp,
        limit: RATE_LIMIT_MAX_REQUESTS_PER_IP,
      });
      if (persistentIpRateLimit.limited) {
        return buildRateLimitResponse(headers, persistentIpRateLimit.retryAfterSeconds);
      }

      const persistentEmailRateLimit = await consumePersistentRateLimit(dbClient, {
        scope: "signup-email",
        identifier: normalizedEmail,
        limit: RATE_LIMIT_MAX_REQUESTS_PER_EMAIL,
      });
      if (persistentEmailRateLimit.limited) {
        return buildRateLimitResponse(headers, persistentEmailRateLimit.retryAfterSeconds);
      }
    }

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
      additionalNotes,
      onboardingIntake,
      onboardingSections,
      setupChecklist
    });

    await dbClient.query("COMMIT");

    await sendSignupPreviewEmails({
      signupRequestId,
      submittedAtIso: new Date().toISOString(),
      organizationId: organization?.id || null,
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
      brandSecondaryColor,
      onboardingVersion: normalizeOptionalText(payload.onboardingVersion, 80),
      onboardingIntake,
      onboardingSections,
      setupChecklist
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
        ...(debugDetailsAllowed ? { debug: debugError } : {})
      })
    };
  } finally {
    dbClient.release();
  }
};
