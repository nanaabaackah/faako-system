/* eslint-disable no-undef */
import { isOrganisationAssignmentAllowed } from "@faako/security";
const parseOrganizationId = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

export const readRequestedOrganizationId = (event, body) => {
  const headerValue =
    event?.headers?.["x-organization-id"] ||
    event?.headers?.["X-Organization-Id"] ||
    event?.headers?.["x-organizationid"] ||
    event?.headers?.["X-OrganizationId"] ||
    null;
  return (
    parseOrganizationId(body?.organizationId) ||
    parseOrganizationId(event?.queryStringParameters?.organizationId) ||
    parseOrganizationId(headerValue)
  );
};

const publicOrganizationEnvCandidates = [
  "PUBLIC_ORGANIZATION_ID",
  "REEBS_PUBLIC_ORGANIZATION_ID",
];

const readConfiguredPublicOrganizationId = () => {
  for (const key of publicOrganizationEnvCandidates) {
    const parsed = parseOrganizationId(process.env[key]);
    if (parsed) return parsed;
  }
  return null;
};

const assertOrganizationExists = async (client, organizationId) => {
  const result = await client.query(
    `SELECT id
     FROM "organization"
     WHERE id = $1
     LIMIT 1`,
    [organizationId]
  );
  return result.rowCount > 0;
};

export const resolveConfiguredPublicOrganizationId = async (
  client,
  { requireExisting = true } = {}
) => {
  const organizationId = readConfiguredPublicOrganizationId();
  if (!organizationId) {
    const error = new Error(
      "Public organization is not configured. Set PUBLIC_ORGANIZATION_ID or REEBS_PUBLIC_ORGANIZATION_ID."
    );
    error.statusCode = 503;
    throw error;
  }
  if (requireExisting && !(await assertOrganizationExists(client, organizationId))) {
    const error = new Error("Configured public organization could not be found.");
    error.statusCode = 503;
    throw error;
  }
  return organizationId;
};

export const resolveCheckoutOrganizationId = async (client, event, body) => {
  const allowedOrgIds = String(process.env.ALLOWED_CHECKOUT_ORG_IDS || "")
    .split(",")
    .map((value) => parseOrganizationId(value))
    .filter(Boolean);
  if (allowedOrgIds.length === 0) {
    const error = new Error("Checkout is not configured for any organization.");
    error.statusCode = 503;
    throw error;
  }

  const requested = readRequestedOrganizationId(event, body);
  if (requested && allowedOrgIds.includes(requested)) {
    return requested;
  }
  if (requested && !allowedOrgIds.includes(requested)) {
    const error = new Error("Checkout is not enabled for this organization.");
    error.statusCode = 403;
    throw error;
  }
  if (allowedOrgIds.length === 1) {
    return allowedOrgIds[0];
  }

  const error = new Error("organizationId is required for checkout.");
  error.statusCode = 400;
  throw error;
};

export const applyRequestOrganizationContext = async (client, organizationId) => {
  const normalizedOrganizationId = parseOrganizationId(organizationId);
  if (!normalizedOrganizationId) return;
  try {
    await client.query(`SELECT set_org_context($1)`, [normalizedOrganizationId]);
  } catch (error) {
    if (!["42883", "42501"].includes(String(error?.code || ""))) {
      throw error;
    }
  }
};

export const resolveAuthorizedOrganizationId = async (
  client,
  {
    authUser,
    event,
    body = null,
    allowCrossOrgForRoles = [],
    systemAdminEmail = String(process.env.SYSTEM_ADMIN_EMAIL || "system_admin@reebs.com")
      .trim()
      .toLowerCase(),
  } = {}
) => {
  const authenticatedOrganizationId = parseOrganizationId(authUser?.organizationId);
  if (!authenticatedOrganizationId) {
    const error = new Error("Organization access required.");
    error.statusCode = 403;
    throw error;
  }

  const requestedOrganizationId = readRequestedOrganizationId(event, body);
  if (!requestedOrganizationId || requestedOrganizationId === authenticatedOrganizationId) {
    return authenticatedOrganizationId;
  }

  const normalizedRole = String(authUser?.role || "").trim().toLowerCase();
  const isSystemAdmin =
    String(authUser?.email || "").trim().toLowerCase() === systemAdminEmail;
  const roleCanUseAssignments = allowCrossOrgForRoles.some(
    (role) => normalizedRole === String(role || "").trim().toLowerCase()
  );
  const canCrossOrganizations = isOrganisationAssignmentAllowed({
    authenticatedOrganisationId: authenticatedOrganizationId,
    requestedOrganisationId: requestedOrganizationId,
    assignedOrganisationIds: roleCanUseAssignments
      ? authUser?.organizationIds || authUser?.organisationIds || []
      : [],
    unrestricted: isSystemAdmin,
  });

  if (!canCrossOrganizations) {
    const error = new Error("Cross-organization access is not allowed.");
    error.statusCode = 403;
    throw error;
  }

  if (!(await assertOrganizationExists(client, requestedOrganizationId))) {
    const error = new Error("Requested organization was not found.");
    error.statusCode = 404;
    throw error;
  }

  return requestedOrganizationId;
};

export const resolveOrganizationId = async (client, event, body, fallbackId = null) => {
  const explicit = readRequestedOrganizationId(event, body);
  if (explicit) return explicit;

  const userId = parseOrganizationId(body?.userId);
  if (userId) {
    const result = await client.query(
      `SELECT "organizationId" FROM "user" WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const orgId = parseOrganizationId(result.rows[0]?.organizationId);
    if (orgId) return orgId;
  }

  return parseOrganizationId(fallbackId);
};
