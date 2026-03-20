import crypto from "crypto";

export const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;

const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

const getHeaderValue = (headers = {}, key) => {
  if (!headers || typeof headers !== "object") return "";
  return String(
    headers[key]
    || headers[key.toLowerCase()]
    || headers[key.toUpperCase()]
    || ""
  ).trim();
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
  const userAgent = getHeaderValue(event?.headers, "user-agent");
  return userAgent || null;
};

export const ensurePasswordResetTokensTable = async (client) => {
  await client.query(
    `CREATE TABLE IF NOT EXISTS "userPasswordResetToken" (
      "id" SERIAL PRIMARY KEY,
      "organizationId" INTEGER NOT NULL,
      "userId" INTEGER NOT NULL,
      "tokenHash" TEXT NOT NULL UNIQUE,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "usedAt" TIMESTAMPTZ
    )`
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "userPasswordResetToken_user_idx"
     ON "userPasswordResetToken" ("userId", "organizationId")`
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "userPasswordResetToken_active_idx"
     ON "userPasswordResetToken" ("organizationId", "expiresAt", "usedAt")`
  );
};

export const cleanupPasswordResetTokens = async (client) => {
  await client.query(
    `DELETE FROM "userPasswordResetToken"
     WHERE "usedAt" IS NOT NULL
        OR "expiresAt" <= NOW()`
  );
};

export const createPasswordResetToken = async (
  client,
  {
    organizationId,
    userId,
    event,
    ttlMs = PASSWORD_RESET_TTL_MS,
  }
) => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  await client.query(
    `UPDATE "userPasswordResetToken"
     SET "usedAt" = NOW()
     WHERE "organizationId" = $1
       AND "userId" = $2
       AND "usedAt" IS NULL`,
    [organizationId, userId]
  );

  await client.query(
    `INSERT INTO "userPasswordResetToken" (
      "organizationId",
      "userId",
      "tokenHash",
      "ipAddress",
      "userAgent",
      "expiresAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      organizationId,
      userId,
      tokenHash,
      getClientIp(event),
      getUserAgent(event),
      expiresAt,
    ]
  );

  return {
    token: rawToken,
    expiresAt,
  };
};

export const consumePasswordResetToken = async (client, rawToken) => {
  const normalizedToken = String(rawToken || "").trim();
  if (!normalizedToken) return null;

  const tokenHash = hashToken(normalizedToken);
  const result = await client.query(
    `UPDATE "userPasswordResetToken"
     SET "usedAt" = NOW()
     WHERE "tokenHash" = $1
       AND "usedAt" IS NULL
       AND "expiresAt" > NOW()
     RETURNING "userId", "organizationId", "expiresAt"`,
    [tokenHash]
  );

  return result.rowCount > 0 ? result.rows[0] : null;
};
