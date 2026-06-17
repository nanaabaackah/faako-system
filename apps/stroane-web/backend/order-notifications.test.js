import assert from "node:assert/strict";
import test from "node:test";
import {
  ORDER_NOTIFICATION_STATUSES,
  sendCustomerOrderEmail,
} from "./src/orderNotifications.js";

test("reroutes local customer order emails to the shared dev inbox", async () => {
  const originalEnv = {
    APP_ENV: process.env.APP_ENV,
    NODE_ENV: process.env.NODE_ENV,
    EMAIL_FORCE_TO: process.env.EMAIL_FORCE_TO,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ORDER_NOTIFICATION_FROM: process.env.ORDER_NOTIFICATION_FROM,
    ORDER_NOTIFICATION_REPLY_TO: process.env.ORDER_NOTIFICATION_REPLY_TO,
  };
  const originalFetch = globalThis.fetch;
  let payload = null;

  process.env.APP_ENV = "development";
  process.env.NODE_ENV = "development";
  process.env.EMAIL_FORCE_TO = "dev@nanaabaackah.com";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.ORDER_NOTIFICATION_FROM = "Stroane Test <orders@example.com>";
  process.env.ORDER_NOTIFICATION_REPLY_TO = "support@example.com";
  globalThis.fetch = async (_url, options = {}) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ id: "email_test" }),
    };
  };

  try {
    const result = await sendCustomerOrderEmail({
      order: {
        orderNumber: "ST-1001",
        customerName: "Test Customer",
        customerEmail: "customer@example.com",
        currency: "GHS",
        total: 125,
        paymentStatus: "paid",
        status: "PAID",
        items: [
          {
            productName: "Shelf Unit",
            quantity: 1,
            unitPrice: 125,
            lineTotal: 125,
          },
        ],
      },
    });

    assert.equal(result.status, ORDER_NOTIFICATION_STATUSES.SENT);
    assert.deepEqual(payload.to, ["dev@nanaabaackah.com"]);
    assert.match(payload.subject, /^\[Local test\]/);
    assert.match(payload.text, /Original recipient: customer@example\.com/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
