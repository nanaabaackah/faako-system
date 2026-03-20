const PERSONAL_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizePersonalEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const isValidPersonalEmail = (value) =>
  !value || PERSONAL_EMAIL_PATTERN.test(value);

export const ensureUserPersonalEmailColumn = async (client) => {
  try {
    await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "personalEmail" TEXT`);
  } catch (error) {
    console.warn("User personalEmail column check failed:", error?.message || error);
  }

  try {
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "user_organizationId_personalEmail_key"
       ON "user" ("organizationId", "personalEmail")`
    );
  } catch (error) {
    console.warn("User personalEmail index check failed:", error?.message || error);
  }
};
