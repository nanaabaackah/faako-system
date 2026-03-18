const parseOrganizationId = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const readOrganizationId = (event, body) => {
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

export const resolveOrganizationId = async (client, event, body, fallbackId = 1) => {
  const explicit = readOrganizationId(event, body);
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

  return fallbackId;
};
