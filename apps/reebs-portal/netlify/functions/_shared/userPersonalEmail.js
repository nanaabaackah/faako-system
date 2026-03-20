const PERSONAL_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let hasEnsuredUserPersonalEmailColumn = false;
let hasEnsuredUserPersonalEmailIndex = false;
let ensureUserPersonalEmailPromise = null;

export const normalizePersonalEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const isValidPersonalEmail = (value) =>
  !value || PERSONAL_EMAIL_PATTERN.test(value);

export const ensureUserPersonalEmailColumn = async (client) => {
  if (hasEnsuredUserPersonalEmailColumn && hasEnsuredUserPersonalEmailIndex) {
    return;
  }

  if (!ensureUserPersonalEmailPromise) {
    ensureUserPersonalEmailPromise = (async () => {
      if (!hasEnsuredUserPersonalEmailColumn) {
        try {
          await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "personalEmail" TEXT`);
          hasEnsuredUserPersonalEmailColumn = true;
        } catch (error) {
          console.warn("User personalEmail column check failed:", error?.message || error);
        }
      }

      if (!hasEnsuredUserPersonalEmailIndex) {
        try {
          await client.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "user_organizationId_personalEmail_key"
             ON "user" ("organizationId", "personalEmail")`
          );
          hasEnsuredUserPersonalEmailIndex = true;
        } catch (error) {
          console.warn("User personalEmail index check failed:", error?.message || error);
        }
      }
    })().finally(() => {
      ensureUserPersonalEmailPromise = null;
    });
  }

  await ensureUserPersonalEmailPromise;
};
