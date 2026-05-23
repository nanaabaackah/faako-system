const crypto = require("node:crypto");
const { Pool } = require("pg");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;

let pool = null;

const getPool = () => {
  if (pool) return pool;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  return pool;
};

const jsonHeaders = {
  "content-type": "application/json",
  "cache-control": "no-store",
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

const parsePayload = (event) => {
  const contentType = String(event.headers["content-type"] || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (contentType === "application/json") {
    return JSON.parse(event.body || "{}");
  }

  if (contentType === "application/x-www-form-urlencoded") {
    return parseUrlEncodedPayload(event.body || "");
  }

  throw Object.assign(new Error("Unsupported content type"), {
    statusCode: 415,
  });
};

const buildResponse = (statusCode, body) => ({
  statusCode,
  headers: jsonHeaders,
  body: JSON.stringify(body),
});

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return [];

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return normalizeStringArray(parsed);
      } catch {
        return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
      }
    }

    return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
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

const insertSignupRequest = async (dbClient, submission) => {
  const columns = await getPublicTableColumns(dbClient, "SignupRequest");

  if (!columns.has("id") || !columns.has("companyName") || !columns.has("email")) {
    throw new Error("SignupRequest table is missing required columns");
  }

  const id = crypto.randomUUID();

  const valuesByColumn = [
    ["id", id],
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

  return id;
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: jsonHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return buildResponse(405, {
      ok: false,
      error: "Method not allowed",
    });
  }

  const rawBody = typeof event.body === "string" ? event.body : "";

  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BODY_BYTES) {
    return buildResponse(413, {
      ok: false,
      error: "Request body is too large",
    });
  }

  let payload;

  try {
    payload = parsePayload(event);
  } catch (error) {
    return buildResponse(error.statusCode || 400, {
      ok: false,
      error: error.message || "Invalid request payload",
    });
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

  if (!companyName || !email) {
    return buildResponse(400, {
      ok: false,
      error: "companyName and email are required",
    });
  }

  if (requestedModules.length === 0) {
    return buildResponse(400, {
      ok: false,
      error: "Please select at least one module",
    });
  }

  const dbClient = await getPool().connect();

  try {
    await dbClient.query("BEGIN");

    const requestId = await insertSignupRequest(dbClient, {
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
      currentWorkflow:
        normalizeText(payload.currentWorkflow, 2500) ||
        normalizeText(intake?.operations?.workflowProblems, 2500) ||
        "Onboarding intake submitted",
      communicationChannels,
      timelinePreference: normalizeText(payload.timelinePreference, 80) || "exploring",
      projectDetails:
        normalizeText(payload.projectDetails, 2500) ||
        normalizeText(intake?.operations?.priorityGoals, 2500),
      painPoints:
        normalizeText(payload.painPoints, 2500) ||
        normalizeText(intake?.operations?.workflowProblems, 2500),
      additionalNotes:
        normalizeText(payload.additionalNotes, 5000) ||
        normalizeText(intake?.modules?.customNotes, 5000),
      onboardingIntake: intake,
      setupChecklist: normalizeStringArray(payload.setupChecklist),
    });

    await dbClient.query("COMMIT");

    return buildResponse(202, {
      ok: true,
      message: "Signup received",
      requestId,
    });
  } catch (error) {
    await dbClient.query("ROLLBACK").catch(() => {});

    console.error("Unable to save signup request:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
    });

    return buildResponse(500, {
      ok: false,
      error: "Unable to save signup request",
      ...(process.env.APP_ENV !== "production"
        ? {
            debug: {
              message: error.message,
              code: error.code,
              detail: error.detail,
              table: error.table,
              column: error.column,
              constraint: error.constraint,
            },
          }
        : {}),
    });
  } finally {
    dbClient.release();
  }
};