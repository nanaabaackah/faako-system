export function readAccessConfig(env = process.env) {
  if (Object.entries(env).some(([key, value]) => key.startsWith("TWE_OIDC_") && value)) throw new Error("Legacy OIDC settings must be removed before configuring Access.");
  const names = ["TWE_ACCESS_TEAM_DOMAIN", "TWE_ACCESS_AUDIENCE", "TWE_PORTAL_ORIGIN"];
  if (!env.TWE_AUTH_MODE && !names.some(name => env[name])) return null;
  if (env.TWE_AUTH_MODE !== "cloudflare_access" || names.some(name => !env[name]?.trim())) throw new Error("Cloudflare Access configuration is incomplete.");
  const issuer = env.TWE_ACCESS_TEAM_DOMAIN;
  if (!/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(issuer)) throw new Error("Access requires an exact HTTPS team origin.");
  if (!/^[a-f0-9]{64}$/.test(env.TWE_ACCESS_AUDIENCE)) throw new Error("Access requires one application AUD tag.");
  const portal = new URL(env.TWE_PORTAL_ORIGIN);
  const local = ["development", "test"].includes(env.APP_ENV) && ["localhost", "127.0.0.1"].includes(portal.hostname);
  if (portal.origin !== env.TWE_PORTAL_ORIGIN || (portal.protocol !== "https:" && !(local && portal.protocol === "http:"))) throw new Error("Portal requires an exact HTTPS origin.");
  return Object.freeze({ mode: "cloudflare_access", issuer, audience: env.TWE_ACCESS_AUDIENCE,
    portalOrigin: portal.origin, secure: portal.protocol === "https:", jwksUrl: `${issuer}/cdn-cgi/access/certs` });
}
