import { z } from "zod";
import { validateEnvironment } from "../config.js";

const email = z.string().trim().email().max(254);
function readSender(value) {
  const sender = String(value).trim();
  if (/[\r\n]/.test(sender)) throw new Error("Invalid notification sender.");
  const named = sender.match(/^([^<>]{1,100}) <([^<>]+)>$/);
  email.parse(named ? named[2] : sender);
  return sender;
}
export function readNotificationConfig(env = process.env) {
  const names = ["TWE_RESEND_API_KEY", "TWE_EMAIL_FROM", "TWE_EMAIL_RECIPIENT", "TWE_PORTAL_ORIGIN"];
  if (!names.slice(0, 3).some((name) => env[name])) return null;
  if (names.some((name) => !env[name])) throw new Error("Notification configuration is incomplete.");
  const environment = validateEnvironment(env.APP_ENV || "development", env.NODE_ENV);
  const from = readSender(env.TWE_EMAIL_FROM);
  const to = email.parse(env.TWE_EMAIL_RECIPIENT);
  const requiredRecipient = environment === "production"
    ? "notifications@travelwitheasegh.com"
    : "testing@travelwitheasegh.com";
  if (to.toLowerCase() !== requiredRecipient) throw new Error("Notification recipient does not match the environment delivery policy.");
  const allowed = String(env.TWE_EMAIL_TEST_RECIPIENTS || "").split(",").filter(Boolean).map((value) => email.parse(value).toLowerCase());
  if (environment !== "production" && !allowed.includes(to.toLowerCase())) throw new Error("Non-production delivery requires an explicitly allowlisted test recipient.");
  const portal = new URL(env.TWE_PORTAL_ORIGIN);
  if (portal.origin !== env.TWE_PORTAL_ORIGIN || portal.protocol !== "https:") throw new Error("Notification portal origin must be exact HTTPS.");
  return Object.freeze({ environment, apiKey: env.TWE_RESEND_API_KEY, from, to, portalOrigin: portal.origin, testRecipients: allowed });
}

export class ResendSender {
  constructor(config, fetcher = fetch) { this.config = config; this.fetcher = fetcher; }
  payload() {
    return { from: this.config.from, to: [this.config.to], subject: "Travel With Ease — enquiry received", text: `An enquiry is available in the staff workspace. Sign in to review it: ${this.config.portalOrigin}` };
  }
  async send(job) {
    const payload = job.delivery_payload;
    // Recheck pinned recipients at delivery time, including after configuration changes.
    if (!payload || payload.from !== this.config.from || payload.to?.length !== 1 || payload.to[0] !== this.config.to ||
        (this.config.environment !== "production" && !this.config.testRecipients.includes(payload.to[0].toLowerCase()))) throw new Error("delivery_configuration_changed");
    const response = await this.fetcher("https://api.resend.com/emails", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `twe-${this.config.environment}-${job.id}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("provider_rejected");
    const result = await response.json();
    if (typeof result.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(result.id)) throw new Error("invalid_provider_response");
    return result.id;
  }
}
