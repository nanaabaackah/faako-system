/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { normalizeRole } from "./_shared/accessControl.js";
import { getEventHeader, getEventIpAddress, writeAuditLog } from "./_shared/auditLog.js";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import { createLogger } from "./_shared/logger.js";
import { requireUser } from "./_shared/userAuth.js";

const logger = createLogger("portal-settings");
const METHODS = "GET,PUT,OPTIONS";

export const DEFAULT_PORTAL_PREFERENCES = Object.freeze({
  theme: "system",
  fontSize: "default",
});

export const DEFAULT_DOCUMENT_IDENTITY = Object.freeze({
  storeName: "REEBS Party Themes",
  storeEmail: "info@reebspartythemes.com",
  storePhone: "+233 24 478 1819",
  storeAddress: "Sakumono Broadway, Tema, Ghana",
});

export const PORTAL_DOCUMENT_IDENTITY_CONFIG_KEY = "portal.documentIdentity";
export const PORTAL_PREFERENCES_CONFIG_KEY_PREFIX = "portal.preferences.user.";

const VALID_THEMES = new Set(["system", "light", "dark"]);
const VALID_FONT_SIZES = new Set(["compact", "default", "large"]);
const DOCUMENT_IDENTITY_LIMITS = Object.freeze({
  storeName: 160,
  storeEmail: 254,
  storePhone: 80,
  storeAddress: 500,
});
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class PortalSettingsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PortalSettingsValidationError";
    this.statusCode = 400;
  }
}

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cleanText = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const normalizeSettingOption = (value) => cleanText(value).toLowerCase();

const validIdentityValue = (field, value) => {
  if (!value || value.length > DOCUMENT_IDENTITY_LIMITS[field]) return false;
  return field !== "storeEmail" || EMAIL_PATTERN.test(value);
};

export const sanitizePortalPreferences = (value, { strict = false } = {}) => {
  if (strict && !isPlainObject(value)) {
    throw new PortalSettingsValidationError("Preferences must be an object.");
  }

  const source = isPlainObject(value) ? value : {};
  const theme = normalizeSettingOption(source.theme);
  const fontSize = normalizeSettingOption(source.fontSize);

  if (strict && !VALID_THEMES.has(theme)) {
    throw new PortalSettingsValidationError("Theme must be system, light, or dark.");
  }
  if (strict && !VALID_FONT_SIZES.has(fontSize)) {
    throw new PortalSettingsValidationError(
      "Font size must be compact, default, or large."
    );
  }

  return {
    theme: VALID_THEMES.has(theme) ? theme : DEFAULT_PORTAL_PREFERENCES.theme,
    fontSize: VALID_FONT_SIZES.has(fontSize)
      ? fontSize
      : DEFAULT_PORTAL_PREFERENCES.fontSize,
  };
};

export const sanitizeDocumentIdentity = (value, { strict = false } = {}) => {
  if (strict && !isPlainObject(value)) {
    throw new PortalSettingsValidationError("Document identity must be an object.");
  }

  const source = isPlainObject(value) ? value : {};
  const normalized = {
    storeName: cleanText(source.storeName),
    storeEmail: cleanText(source.storeEmail).toLowerCase(),
    storePhone: cleanText(source.storePhone),
    storeAddress: cleanText(source.storeAddress),
  };

  for (const field of Object.keys(DEFAULT_DOCUMENT_IDENTITY)) {
    if (strict && !validIdentityValue(field, normalized[field])) {
      const label = field.replace(/^store/, "").toLowerCase();
      throw new PortalSettingsValidationError(
        field === "storeEmail"
          ? "Document identity email must be a valid email address."
          : `Document identity ${label} is required and is too long or invalid.`
      );
    }
    if (!validIdentityValue(field, normalized[field])) {
      normalized[field] = DEFAULT_DOCUMENT_IDENTITY[field];
    }
  }

  return normalized;
};

export const canManageDocumentIdentity = (user) =>
  ["owner", "admin"].includes(normalizeRole(user?.role));

export const getPortalPreferencesConfigKey = (userId) => {
  const normalizedUserId = Number(userId);
  if (!Number.isSafeInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new PortalSettingsValidationError("A valid user id is required.");
  }
  return `${PORTAL_PREFERENCES_CONFIG_KEY_PREFIX}${normalizedUserId}`;
};

const parseStoredJson = (rawValue) => {
  if (typeof rawValue !== "string" || !rawValue.trim()) return {};
  try {
    const parsed = JSON.parse(rawValue);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const assertScope = ({ organizationId, userId }) => {
  const normalizedOrganizationId = Number(organizationId);
  const normalizedUserId = Number(userId);
  if (!Number.isSafeInteger(normalizedOrganizationId) || normalizedOrganizationId <= 0) {
    throw new Error("Invalid authenticated organization scope.");
  }
  if (!Number.isSafeInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error("Invalid authenticated user scope.");
  }
  return { organizationId: normalizedOrganizationId, userId: normalizedUserId };
};

export const readPortalSettings = async (
  client,
  { organizationId: organizationIdInput, user }
) => {
  const { organizationId, userId } = assertScope({
    organizationId: organizationIdInput,
    userId: user?.id,
  });
  const preferencesKey = getPortalPreferencesConfigKey(userId);
  const result = await client.query(
    `SELECT key, value
     FROM "systemConfig"
     WHERE "organizationId" = $1
       AND key = ANY($2::text[])`,
    [organizationId, [preferencesKey, PORTAL_DOCUMENT_IDENTITY_CONFIG_KEY]]
  );
  const valuesByKey = new Map(
    (result.rows || []).map((row) => [String(row.key), row.value])
  );

  return {
    preferences: sanitizePortalPreferences(
      parseStoredJson(valuesByKey.get(preferencesKey))
    ),
    documentIdentity: sanitizeDocumentIdentity(
      parseStoredJson(valuesByKey.get(PORTAL_DOCUMENT_IDENTITY_CONFIG_KEY))
    ),
    capabilities: {
      canManageDocumentIdentity: canManageDocumentIdentity(user),
    },
  };
};

export const upsertPortalSetting = async (
  client,
  { organizationId, key, value, description }
) => {
  const normalizedOrganizationId = Number(organizationId);
  if (!Number.isSafeInteger(normalizedOrganizationId) || normalizedOrganizationId <= 0) {
    throw new Error("Invalid authenticated organization scope.");
  }

  await client.query(
    `INSERT INTO "systemConfig"
       ("organizationId", key, value, description, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT ("organizationId", key) DO UPDATE SET
       value = EXCLUDED.value,
       description = EXCLUDED.description,
       "updatedAt" = NOW()`,
    [normalizedOrganizationId, key, JSON.stringify(value), description]
  );
};

export const getChangedDocumentIdentityFields = (previous, next) =>
  Object.keys(DEFAULT_DOCUMENT_IDENTITY).filter(
    (field) => previous?.[field] !== next?.[field]
  );

export const buildDocumentIdentityAuditEvent = ({
  event,
  organizationId,
  authUser,
  previous,
  next,
}) => ({
  organizationId: Number(organizationId),
  userId: Number(authUser?.id),
  action: "PORTAL_DOCUMENT_IDENTITY_UPDATED",
  targetType: "systemConfig",
  targetId: PORTAL_DOCUMENT_IDENTITY_CONFIG_KEY,
  category: "admin",
  severity: "info",
  status: "ok",
  summary: "Updated the portal document identity.",
  actorLabel: authUser?.fullName || authUser?.email || null,
  requestId: getEventHeader(event, "x-request-id"),
  ipAddress: getEventIpAddress(event),
  metadata: {
    changedFields: getChangedDocumentIdentityFields(previous, next),
  },
});

const respond = (event, statusCode, body = {}) =>
  json(event, statusCode, body, { methods: METHODS });

const parsePutBody = (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    throw new PortalSettingsValidationError("Invalid JSON body.");
  }
  if (!isPlainObject(payload)) {
    throw new PortalSettingsValidationError("Request body must be an object.");
  }
  if (!["preferences", "documentIdentity"].includes(payload.section)) {
    throw new PortalSettingsValidationError(
      "Section must be preferences or documentIdentity."
    );
  }
  return payload;
};

export async function handler(event = {}) {
  const method = String(event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return respond(event, 204);
  if (!["GET", "PUT"].includes(method)) {
    return respond(event, 405, { error: "Method not allowed." });
  }
  if (isCrossSiteBrowserRequest(event)) {
    return respond(event, 403, { error: "Cross-site requests are not allowed." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });
  let transactionStarted = false;

  try {
    await client.connect();
    const authUser = await requireUser(client, event);
    if (!authUser) return respond(event, 401, { error: "Unauthorized" });

    const organizationId = Number(authUser.organizationId);
    assertScope({ organizationId, userId: authUser.id });

    if (method === "GET") {
      return respond(
        event,
        200,
        await readPortalSettings(client, { organizationId, user: authUser })
      );
    }

    const payload = parsePutBody(event);
    if (payload.section === "preferences") {
      const preferences = sanitizePortalPreferences(payload.value, { strict: true });
      await upsertPortalSetting(client, {
        organizationId,
        key: getPortalPreferencesConfigKey(authUser.id),
        value: preferences,
        description: "REEBS Portal appearance preferences for one user.",
      });
    } else {
      if (!canManageDocumentIdentity(authUser)) {
        return respond(event, 403, {
          error: "Only owners and admins can update document identity.",
        });
      }

      const documentIdentity = sanitizeDocumentIdentity(payload.value, {
        strict: true,
      });
      const previous = await readPortalSettings(client, {
        organizationId,
        user: authUser,
      });

      await client.query("BEGIN");
      transactionStarted = true;
      await upsertPortalSetting(client, {
        organizationId,
        key: PORTAL_DOCUMENT_IDENTITY_CONFIG_KEY,
        value: documentIdentity,
        description: "Shared REEBS document business identity.",
      });
      await writeAuditLog(
        client,
        buildDocumentIdentityAuditEvent({
          event,
          organizationId,
          authUser,
          previous: previous.documentIdentity,
          next: documentIdentity,
        })
      );
      await client.query("COMMIT");
      transactionStarted = false;
    }

    return respond(
      event,
      200,
      await readPortalSettings(client, { organizationId, user: authUser })
    );
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }
    if (error instanceof PortalSettingsValidationError) {
      return respond(event, 400, { error: error.message });
    }
    logger.error(
      {
        err: error,
        eventName: "portal.settings.failed",
        requestId: event?.requestId,
      },
      "Portal settings request failed"
    );
    return respond(event, 500, {
      error: "Failed to load or update portal settings.",
    });
  } finally {
    await client.end().catch(() => {});
  }
}
