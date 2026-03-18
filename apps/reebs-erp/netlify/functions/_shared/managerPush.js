const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const chunk = (list, size) => {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
};

export const ensureManagerDeviceTable = async (client) => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "managerDevice" (
      "id" SERIAL PRIMARY KEY,
      "token" TEXT NOT NULL UNIQUE,
      "platform" TEXT,
      "deviceId" TEXT,
      "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "token" TEXT NOT NULL`,
    `ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "platform" TEXT`,
    `ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "deviceId" TEXT`,
    `ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "managerDevice_token_key" ON "managerDevice" ("token")`,
  ];

  for (const statement of statements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Manager device table check failed:", err?.message || err);
    }
  }
};

export const fetchManagerTokens = async (client) => {
  const result = await client.query(
    `SELECT token
     FROM "managerDevice"
     WHERE token IS NOT NULL`
  );
  return result.rows.map((row) => row.token).filter(Boolean);
};

export const sendManagerPush = async (tokens, message) => {
  if (!tokens?.length) return;
  if (typeof fetch !== "function") return;

  const batches = chunk(tokens, 100);
  for (const batch of batches) {
    const payload = batch.map((token) => ({
      to: token,
      sound: "default",
      title: message.title,
      body: message.body,
      data: message.data || {},
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.warn("Expo push failed:", response.status, errorText);
    }
  }
};

export const notifyManager = async (client, message) => {
  await ensureManagerDeviceTable(client);
  const tokens = await fetchManagerTokens(client);
  await sendManagerPush(tokens, message);
};
