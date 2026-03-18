import crypto from "crypto";

export const USER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const TOUCH_INTERVAL_SQL = "5 minutes";

export const ensureUserSessionsTable = async (client) => {
  await client.query(
    `CREATE TABLE IF NOT EXISTS "userSession" (
      "id" SERIAL PRIMARY KEY,
      "organizationId" INTEGER NOT NULL,
      "userId" INTEGER NOT NULL,
      "sessionTokenId" TEXT NOT NULL UNIQUE,
      "remember" BOOLEAN NOT NULL DEFAULT TRUE,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "revokedAt" TIMESTAMPTZ
    )`
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "userSession_user_idx"
     ON "userSession" ("userId", "organizationId")`
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "userSession_active_idx"
     ON "userSession" ("organizationId", "expiresAt", "revokedAt")`
  );
};

const getHeaderValue = (headers = {}, key) => {
  if (!headers || typeof headers !== "object") return "";
  return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()] || "";
};

const getClientIp = (event) => {
  const forwarded = String(
    getHeaderValue(event?.headers, "x-forwarded-for")
    || getHeaderValue(event?.headers, "client-ip")
    || getHeaderValue(event?.headers, "x-nf-client-connection-ip")
    || ""
  )
    .split(",")[0]
    .trim();
  return forwarded || null;
};

const getUserAgent = (event) => {
  const userAgent = String(getHeaderValue(event?.headers, "user-agent") || "").trim();
  return userAgent || null;
};

export const createUserSession = async (
  client,
  {
    organizationId,
    userId,
    event,
    remember = true,
    ttlMs = USER_SESSION_TTL_MS,
  }
) => {
  const sessionTokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const result = await client.query(
    `INSERT INTO "userSession" (
      "organizationId",
      "userId",
      "sessionTokenId",
      "remember",
      "ipAddress",
      "userAgent",
      "expiresAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, "sessionTokenId", "createdAt", "lastSeenAt", "expiresAt"`,
    [
      organizationId,
      userId,
      sessionTokenId,
      Boolean(remember),
      getClientIp(event),
      getUserAgent(event),
      expiresAt,
    ]
  );
  return result.rows[0];
};

export const touchUserSession = async (client, sessionTokenId) => {
  if (!sessionTokenId) return;
  await client.query(
    `UPDATE "userSession"
     SET "lastSeenAt" = NOW()
     WHERE "sessionTokenId" = $1
       AND "revokedAt" IS NULL
       AND "expiresAt" > NOW()
       AND "lastSeenAt" < NOW() - INTERVAL '${TOUCH_INTERVAL_SQL}'`,
    [sessionTokenId]
  );
};

export const revokeUserSession = async (client, sessionTokenId) => {
  if (!sessionTokenId) return false;
  const result = await client.query(
    `UPDATE "userSession"
     SET "revokedAt" = NOW()
     WHERE "sessionTokenId" = $1
       AND "revokedAt" IS NULL`,
    [sessionTokenId]
  );
  return result.rowCount > 0;
};
