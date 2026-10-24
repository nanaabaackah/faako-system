export function readAuthConfig(env = process.env) {
  const accountLinks = {};
  for (const [key, name] of [["recoveryUrl", "TWE_OIDC_RECOVERY_URL"], ["registrationUrl", "TWE_OIDC_REGISTRATION_URL"]]) {
    if (!env[name]) continue;
    let url;
    try { url = new URL(env[name]); } catch { throw new Error(`${name} is invalid.`); }
    if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error(`${name} requires an approved HTTPS URL.`);
    accountLinks[key] = url.href;
  }
  const names = ["TWE_OIDC_ISSUER", "TWE_OIDC_CLIENT_ID", "TWE_OIDC_CLIENT_SECRET", "TWE_OIDC_MFA_ACR", "TWE_API_ORIGIN", "TWE_PORTAL_ORIGIN"];
  if (!names.some((name) => env[name])) return null;
  if (names.some((name) => !env[name]?.trim())) throw new Error("OIDC configuration is incomplete.");
  const deployed = ["staging", "production"].includes(env.APP_ENV);
  for (const name of ["TWE_OIDC_ISSUER", "TWE_API_ORIGIN", "TWE_PORTAL_ORIGIN"]) {
    let url;
    try { url = new URL(env[name]); } catch { throw new Error(`${name} is invalid.`); }
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== "https:" && (name === "TWE_OIDC_ISSUER" || deployed || !local || url.protocol !== "http:"))) {
      throw new Error(`${name} requires a trusted HTTPS URL (loopback origins allowed locally).`);
    }
    if (name !== "TWE_OIDC_ISSUER" && url.origin !== env[name]) throw new Error(`${name} must be an exact origin.`);
  }
  return Object.freeze({
    ...accountLinks,
    issuer: env.TWE_OIDC_ISSUER, clientId: env.TWE_OIDC_CLIENT_ID, clientSecret: env.TWE_OIDC_CLIENT_SECRET,
    mfaAcr: env.TWE_OIDC_MFA_ACR, portalOrigin: env.TWE_PORTAL_ORIGIN,
    callbackUrl: `${env.TWE_API_ORIGIN}/api/auth/callback`,
    secure: new URL(env.TWE_API_ORIGIN).protocol === "https:",
  });
}
