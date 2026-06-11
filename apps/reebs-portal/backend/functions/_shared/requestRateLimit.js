const RATE_LIMIT_TABLE = "apiRateLimitWindow";

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "${RATE_LIMIT_TABLE}" (
    "scope" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "windowStart" TIMESTAMPTZ NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("scope", "identifier", "windowStart")
  )`,
  `CREATE INDEX IF NOT EXISTS "apiRateLimitWindow_updatedAt_idx"
   ON "${RATE_LIMIT_TABLE}" ("updatedAt")`,
];

let tableEnsured = false;

const stripControlCharacters = (value) =>
  Array.from(String(value || ""))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");

const cleanKeyPart = (value, maxLength = 240, fallback = "unknown") => {
  const normalized = stripControlCharacters(value)
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
  return normalized || fallback;
};

export const getRequestClientIp = (event) => {
  const candidates = [
    event?.headers?.["x-nf-client-connection-ip"],
    event?.headers?.["X-Nf-Client-Connection-Ip"],
    event?.headers?.["client-ip"],
    event?.headers?.["Client-Ip"],
    event?.headers?.["x-forwarded-for"],
    event?.headers?.["X-Forwarded-For"],
    event?.headers?.["x-real-ip"],
    event?.headers?.["X-Real-Ip"],
  ];

  for (const candidate of candidates) {
    const first = String(candidate || "")
      .split(",")[0]
      .trim();
    if (first) return cleanKeyPart(first, 120, "unknown");
  }

  return "unknown";
};

export const ensureRequestRateLimitTable = async (client) => {
  if (tableEnsured) return;
  for (const statement of tableStatements) {
    await client.query(statement);
  }
  tableEnsured = true;
};

export const applyWindowRateLimit = async (
  client,
  {
    scope = "default",
    identifier = "anonymous",
    limit = 60,
    windowMs = 60_000,
    purgeAfterMs = Math.max(windowMs * 20, 60 * 60 * 1000),
    now = Date.now(),
  } = {}
) => {
  const safeLimit = Math.max(1, Math.round(Number(limit) || 0));
  const safeWindowMs = Math.max(1_000, Math.round(Number(windowMs) || 0));
  const safeScope = cleanKeyPart(scope, 64, "default");
  const safeIdentifier = cleanKeyPart(identifier, 240, "anonymous");
  const windowStartMs = Math.floor(now / safeWindowMs) * safeWindowMs;
  const windowStart = new Date(windowStartMs).toISOString();
  const resetAtMs = windowStartMs + safeWindowMs;
  const purgeBefore = new Date(now - Math.max(safeWindowMs, purgeAfterMs)).toISOString();

  await ensureRequestRateLimitTable(client);
  await client.query(
    `DELETE FROM "${RATE_LIMIT_TABLE}"
     WHERE "scope" = $1
       AND "updatedAt" < $2`,
    [safeScope, purgeBefore]
  );

  const result = await client.query(
    `INSERT INTO "${RATE_LIMIT_TABLE}" (
      "scope",
      "identifier",
      "windowStart",
      "hitCount",
      "createdAt",
      "updatedAt"
    ) VALUES ($1, $2, $3, 1, NOW(), NOW())
    ON CONFLICT ("scope", "identifier", "windowStart")
    DO UPDATE
      SET "hitCount" = "${RATE_LIMIT_TABLE}"."hitCount" + 1,
          "updatedAt" = NOW()
    RETURNING "hitCount"`,
    [safeScope, safeIdentifier, windowStart]
  );

  const hitCount = Number(result.rows?.[0]?.hitCount) || 0;
  return {
    allowed: hitCount <= safeLimit,
    hitCount,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - hitCount),
    retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
    resetAt: new Date(resetAtMs).toISOString(),
  };
};
