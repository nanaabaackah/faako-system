const BLOCKED_ORG_SETTINGS_KEYS = Object.freeze([
  "apikey",
  "secret",
  "token",
  "password",
  "privatekey",
  "webhooksecret",
  "signingkey",
  "encryptionkey",
  "stripekey",
  "paystackkey",
  "hubtelkey",
  "flutterwavekey",
  "clientsecret",
  "accesskey",
]);

export const isSafeOrgSettingsKey = (key) => {
  if (typeof key !== "string") return false;
  const lower = key.toLowerCase();
  return !BLOCKED_ORG_SETTINGS_KEYS.some((blocked) => lower.includes(blocked));
};

export const stripSensitiveOrgSettings = (settings) => {
  if (!settings || typeof settings !== "object") return {};
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => isSafeOrgSettingsKey(key)),
  );
};
