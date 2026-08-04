import test from "node:test";
import assert from "node:assert/strict";
import { createAlertDelivery } from "./alert.delivery.js";

const incident = { id: 9, organizationId: 2, severity: "CRITICAL", status: "OPEN", title: "API down", summary: "Safe summary", service: { name: "API" } };
const event = { id: 4, eventType: "TRIGGERED", safeSummary: "API unavailable", attemptCount: 0 };

test("in-app delivery persists a linked notification and marks the event sent", async () => {
  const notifications = []; const updates = [];
  const prisma = { monitoringNotification: { create: async ({ data }) => { notifications.push(data); } }, alertEvent: { update: async ({ data }) => { updates.push(data); return data; } } };
  const delivery = createAlertDelivery({ prisma, options: { maxRetries: 3, retryDelayMs: 1000 } });
  await delivery.deliverEvent(event, { id: 1, type: "IN_APP", enabled: true }, incident);
  assert.equal(notifications[0].link, "/system-health?incident=9");
  assert.equal(updates[0].deliveryStatus, "SENT");
});

test("email failures retain sanitized delivery state without leaking provider secrets", async () => {
  let update;
  const prisma = { alertEvent: { update: async ({ data }) => { update = data; return data; } } };
  const channelCrypto = { decrypt: () => JSON.stringify({ recipients: ["ops@example.com"] }) };
  const delivery = createAlertDelivery({ prisma, channelCrypto, sendEmail: async () => { throw new Error("token=super-secret provider unavailable"); }, options: { maxRetries: 1, retryDelayMs: 1000 } });
  await delivery.deliverEvent(event, { id: 2, type: "EMAIL", enabled: true, encryptedConfig: "encrypted" }, incident);
  assert.equal(update.deliveryStatus, "FAILED");
  assert.equal(update.errorSummary.includes("super-secret"), false);
});

test("email delivery sends the branded monitoring template", async () => {
  let message;
  const prisma = { alertEvent: { update: async ({ data }) => data } };
  const channelCrypto = { decrypt: () => JSON.stringify({ recipients: ["ops@example.com"] }) };
  const delivery = createAlertDelivery({
    prisma,
    channelCrypto,
    sendEmail: async (payload) => { message = payload; },
    options: { maxRetries: 3, retryDelayMs: 1000, appBaseUrl: "https://dev.example.com" },
  });

  await delivery.deliverEvent(event, { id: 2, type: "EMAIL", enabled: true, encryptedConfig: "encrypted" }, incident);

  assert.equal(message.subject, "[CRITICAL] API down");
  assert.match(message.html, /Dev ERP Monitoring/);
  assert.match(message.html, /Open incident in Dev ERP/);
  assert.match(message.text, /system-health\?incident=9/);
});
