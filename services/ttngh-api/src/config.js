import { emailSchema } from "@faako/validation";
import { calendarUrl } from "./calendar/service.js";

export function loadConfig(env) {
  const calendarId = env.TTNGH_GOOGLE_CALENDAR_ID?.trim() || "";
  if (calendarId) calendarUrl(calendarId);
  const list = name => (env[name] || "").split(",").map(value => value.trim()).filter(Boolean);
  const origins = list("TTNGH_ALLOWED_ORIGINS");
  if (!origins.length || origins.some(value => {
    try { const url = new URL(value); return url.origin !== value || !(url.protocol === "https:" || url.protocol === "http:" && env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname)); } catch { return true; }
  })) throw new Error("Configure exact TTNGH_ALLOWED_ORIGINS");
  const enabled = env.TTNGH_CONTACT_ENABLED === "true";
  const secret = env.TURNSTILE_SECRET_KEY || "";
  const hostnames = list("TURNSTILE_HOSTNAMES");
  if (enabled && (!secret || !hostnames.length || !env.RESEND_API_KEY || !emailSchema.safeParse(env.TTNGH_MAIL_FROM).success || !emailSchema.safeParse(env.TTNGH_ENQUIRY_TO).success)) throw new Error("Contact delivery configuration is incomplete");
  if (enabled && env.NODE_ENV === "production" && /^[123]x0{6}/.test(secret)) throw new Error("Turnstile test keys cannot protect production");
  if (Number(env.RAILWAY_REPLICA_COUNT || 1) !== 1) throw new Error("Shared rate-limit and webhook stores required before scaling replicas");
  let buildHook = "";
  if (env.CLOUDFLARE_BUILD_HOOK_URL) {
    const url = new URL(env.CLOUDFLARE_BUILD_HOOK_URL);
    if (url.protocol !== "https:" || url.hostname !== "api.cloudflare.com" || !url.pathname.startsWith("/client/v4/pages/webhooks/deploy_hooks/") || url.username || url.password) throw new Error("Invalid Cloudflare build hook URL");
    buildHook = url.href;
  }
  return { calendarId, origins, enabled, secret, hostnames, resendKey: env.RESEND_API_KEY, from: env.TTNGH_MAIL_FROM, to: env.TTNGH_ENQUIRY_TO,
    acknowledgement: env.TTNGH_ACKNOWLEDGEMENT_APPROVED === "true", webhookSecret: env.SANITY_WEBHOOK_SECRET || "", buildHook,
    project: env.SANITY_PROJECT_ID, dataset: env.SANITY_DATASET,
    // Default: no proxy trust. Set explicit proxy addresses/subnets only after verifying Railway topology.
    trustedProxies: list("TTNGH_TRUSTED_PROXY_CIDRS"), limit: 5, windowMs: 15 * 60 * 1000 };
}
