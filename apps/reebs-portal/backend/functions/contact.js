/* eslint-disable no-undef */
import { json, isCrossSiteBrowserRequest } from "./_shared/http.js";
import {
  getNotificationCatchallEmail,
  sendNotificationEmail,
} from "./_shared/email.js";

const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 120;
const MAX_PHONE_LENGTH = 25;
const MAX_TOPIC_LENGTH = 80;
const MAX_LOCATION_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 1500;

const cleanText = (value, maxLength = 240) =>
  String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const cleanMessage = (value) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const parseBody = (event = {}) => {
  const contentType = String(
    event.headers?.["content-type"]
      || event.headers?.["Content-Type"]
      || ""
  ).toLowerCase();

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(event.body || ""));
  }

  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return {};
  }
};

const respond = (event, statusCode, payload = {}) =>
  json(event, statusCode, payload, {
    methods: "POST, OPTIONS",
    allowHeaders: "Content-Type",
  });

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204);
  }

  if (event.httpMethod !== "POST") {
    return respond(event, 405, { error: "Method not allowed." });
  }

  if (isCrossSiteBrowserRequest(event)) {
    return respond(event, 403, { error: "Cross-site requests are not allowed." });
  }

  const body = parseBody(event);
  const botField = cleanText(body["bot-field"] || body.botField, 200);
  if (botField) {
    return respond(event, 200, {
      ok: true,
      message: "Thanks. We will review your message shortly.",
    });
  }

  const name = cleanText(body.name, MAX_NAME_LENGTH);
  const email = cleanText(body.email, MAX_EMAIL_LENGTH).toLowerCase();
  const phone = cleanText(body.phone, MAX_PHONE_LENGTH);
  const topic = cleanText(body.topic, MAX_TOPIC_LENGTH);
  const eventDate = cleanText(body.eventDate, 20);
  const location = cleanText(body.location, MAX_LOCATION_LENGTH);
  const message = cleanMessage(body.message);

  if (name.length < 2 || !isValidEmail(email) || phone.length < 7 || message.length < 10) {
    return respond(event, 400, {
      error: "Name, email, phone, and message are required.",
    });
  }

  const subjectName = name || "Website visitor";
  const text = [
    "New REEBS planning brief",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Topic: ${topic || "Not specified"}`,
    `Event date: ${eventDate || "Not specified"}`,
    `Location: ${location || "Not specified"}`,
    "",
    "Message:",
    message,
  ].join("\n");

  try {
    const result = await sendNotificationEmail({
      to: getNotificationCatchallEmail(),
      subject: `REEBS planning brief from ${subjectName}`,
      text,
      replyTo: email,
    });

    if (result?.skipped) {
      return respond(event, 503, {
        error: "Message delivery is not configured.",
      });
    }

    return respond(event, 200, {
      ok: true,
      message: "Your planning brief was sent. We will reply within one business day.",
    });
  } catch (error) {
    console.error("Contact form email failed", {
      message: error?.message || String(error),
    });
    return respond(event, 500, {
      error: "We could not send your planning brief right now.",
    });
  }
}
