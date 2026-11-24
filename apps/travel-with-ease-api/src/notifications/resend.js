import { z } from "zod";
import { validateEnvironment } from "../config.js";
import { enquiryTemplate } from "./enquiry-template.js";

const email = z.string().trim().email().max(254);
const uuid = z.string().uuid();
const testMailbox = "testing@travelwitheasegh.com";
const staffMailbox = "notifications@travelwitheasegh.com";
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

// Internal notice contains only an enquiry reference, not contact details,
// itinerary answers, or the customer's private questionnaire capability.
function staffNotification(config, enquiryId) {
  const reference = uuid.parse(enquiryId).slice(0, 8).toUpperCase();
  const subject = "Travel With Ease — new enquiry " + reference;
  const message = "A new enquiry has been received. Reference: " + reference + ". Sign in to the Travel With Ease staff workspace and open Enquiries to review it.";
  return {
    from: config.from,
    to: [config.environment === "production" ? staffMailbox : testMailbox],
    subject, text: message,
    html: '<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;color:#010c33"><h1 style="font-size:22px">New enquiry</h1><p>' + message + '</p></body></html>',
  };
}

function validMessage(payload, from) {
  return payload && payload.from === from && Array.isArray(payload.to) &&
    payload.to.length === 1 && email.safeParse(payload.to[0]).success &&
    Object.keys(payload).length === 5 &&
    Object.keys(payload).every(key => ["from", "to", "subject", "text", "html"].includes(key)) &&
    ["subject", "text", "html"].every(key => typeof payload[key] === "string" && payload[key].length > 0);
}

export class ResendSender {
  constructor(config, fetcher = fetch, templateCopy, continuationLinks = null) {
    this.config = config;
    this.fetcher = fetcher;
    this.templateCopy = templateCopy;
    this.continuationLinks = continuationLinks;
  }
  payload(enquiry = {}, { test = false } = {}) {
    const production = this.config.environment === "production";
    const contact = enquiry.contact || enquiry;
    const continuation = !test && enquiry.id && enquiry.kind !== "legacy_estimator" && this.continuationLinks
      ? this.continuationLinks.issue(enquiry.id, enquiry.createdAt)
      : null;
    return {
      from: this.config.from,
      to: [production ? email.parse(contact.email) : testMailbox],
      ...enquiryTemplate({
        name: typeof contact.name === "string" ? contact.name : "",
        test,
        copy: this.templateCopy,
        continuation: Boolean(continuation),
        ...(continuation ? { ctaUrl: continuation.url } : {}),
      }),
      ...(!test && enquiry.id ? { staff: staffNotification(this.config, enquiry.id) } : {}),
    };
  }
  async sendMessage(payload, key) {
    const response = await this.fetcher("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
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
  async send(job) {
    const payload = job.delivery_payload;
    const production = this.config.environment === "production";
    // Never resend an old pinned CC payload under a modified provider request.
    // Such a request may already have been accepted before the rollout.
    if (payload && Object.hasOwn(payload, "cc")) throw new Error("legacy_cc_review_required");
    const { staff, ...customer } = payload || {};
    if (!validMessage(customer, this.config.from) ||
      (!production && customer.to[0] !== testMailbox) ||
      (production && job.enquiry_id && !staff))
      throw new Error("delivery_configuration_changed");
    if (staff) {
      if (!uuid.safeParse(job.enquiry_id).success || !validMessage(staff, this.config.from))
        throw new Error("delivery_configuration_changed");
      const expected = staffNotification(this.config, job.enquiry_id);
      if (staff.to[0] !== expected.to[0] || staff.subject !== expected.subject ||
        staff.text !== expected.text || staff.html !== expected.html)
        throw new Error("delivery_configuration_changed");
    }
    // Both messages are pinned in the existing durable outbox. Preserve the
    // customer idempotency key and use a distinct staff key; retries of a
    // partially accepted pair cannot duplicate the earlier accepted message.
    const key = `twe-${this.config.environment}-${job.id}`;
    // Explicit field order is stable even after a jsonb round trip.
    const message = ({ from, to, subject, text, html }) => ({ from, to, subject, text, html });
    const providerId = await this.sendMessage(message(customer), key);
    if (staff) await this.sendMessage(message(staff), key + "-staff");
    return providerId;
  }
}
