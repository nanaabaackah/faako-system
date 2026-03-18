import { APP_ENV } from "../../runtimeEnv.js";
import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import {
  getNotificationCatchallEmail,
  sendNotificationEmail,
} from "./_shared/email.js";

const json = (event, statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...buildResponseHeaders(event, { methods: "POST,OPTIONS" }),
  },
  body: statusCode === 204 ? "" : JSON.stringify(body),
});

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return json(event, 204, {});
  }
  if (isCrossSiteBrowserRequest(event)) {
    return json(event, 403, { error: "Cross-site requests are not allowed." });
  }
  if (event.httpMethod !== "POST") {
    return json(event, 405, { error: "Method Not Allowed" });
  }
  if (APP_ENV !== "development") {
    return json(event, 403, { error: "Test email is only available in development." });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(event, 400, { error: "Invalid JSON body." });
  }

  const requestedTo = String(payload.to || getNotificationCatchallEmail()).trim();
  const subject = String(payload.subject || "REEBS local email test").trim();
  const message = String(
    payload.message ||
      "This is a local test email from the REEBS notifications pipeline."
  ).trim();

  if (!requestedTo || !subject || !message) {
    return json(event, 400, { error: "to, subject, and message are required." });
  }

  try {
    const result = await sendNotificationEmail({
      to: requestedTo,
      subject,
      text: [
        "REEBS notification test",
        "",
        `App environment: ${APP_ENV}`,
        `Requested recipient: ${requestedTo}`,
        "",
        message,
      ].join("\n"),
    });

    return json(event, 200, {
      message: "Test email sent.",
      result,
    });
  } catch (error) {
    return json(event, 500, {
      error: error?.message || "Failed to send test email.",
    });
  }
}

