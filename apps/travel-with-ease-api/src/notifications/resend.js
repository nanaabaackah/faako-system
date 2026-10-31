import { z } from "zod";
import { validateEnvironment } from "../config.js";
import { enquiryTemplate } from "./enquiry-template.js";

const email = z.string().trim().email().max(254);
function readSender(value) {
  const sender = String(value).trim();
  if (/[\r\n]/.test(sender)) throw new Error("Invalid notification sender.");
  const named = sender.match(/^([^<>]{1,100}) <([^<>]+)>$/);
  email.parse(named ? named[2] : sender);
  return sender;
}
export function readNotificationConfig(env = process.env) {
  const names = ["TWE_RESEND_API_KEY", "TWE_EMAIL_FROM"];
  if (!names.some((name) => env[name])) return null;
  if (names.some((name) => !env[name]))
    throw new Error("Notification configuration is incomplete.");
  const environment = validateEnvironment(
    env.APP_ENV || "development",
    env.NODE_ENV,
  );
  const from = readSender(env.TWE_EMAIL_FROM);
  return Object.freeze({ environment, apiKey: env.TWE_RESEND_API_KEY, from });
}

export class ResendSender {
  constructor(config, fetcher = fetch, templateCopy) {
    this.config = config;
    this.fetcher = fetcher;
    this.templateCopy = templateCopy;
  }
  payload(contact = {}, { test = false } = {}) {
    const production = this.config.environment === "production";
    return {
      from: this.config.from,
      to: [
        production
          ? email.parse(contact.email)
          : "testing@travelwitheasegh.com",
      ],
      ...(production ? { cc: ["notifications@travelwitheasegh.com"] } : {}),
      ...enquiryTemplate({
        name: typeof contact.name === "string" ? contact.name : "",
        test,
        copy: this.templateCopy,
      }),
    };
  }
  async send(job) {
    const payload = job.delivery_payload;
    // Recheck pinned recipients at delivery time, including after configuration changes.
    const production = this.config.environment === "production";
    if (
      !payload ||
      payload.from !== this.config.from ||
      payload.to?.length !== 1 ||
      !email.safeParse(payload.to[0]).success ||
      Object.keys(payload).some(
        (key) => !["from", "to", "cc", "subject", "text", "html"].includes(key),
      ) ||
      typeof payload.html !== "string" ||
      typeof payload.text !== "string" ||
      (production
        ? payload.cc?.length !== 1 ||
          payload.cc[0] !== "notifications@travelwitheasegh.com"
        : payload.to[0] !== "testing@travelwitheasegh.com" ||
          payload.cc !== undefined)
    )
      throw new Error("delivery_configuration_changed");
    const response = await this.fetcher("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `twe-${this.config.environment}-${job.id}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("provider_rejected");
    const result = await response.json();
    if (
      typeof result.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(result.id)
    )
      throw new Error("invalid_provider_response");
    return result.id;
  }
}
