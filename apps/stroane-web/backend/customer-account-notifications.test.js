import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_ACCOUNT_EMAIL_STATUSES,
  sendCustomerPasswordResetEmail,
} from "./src/customerAccountNotifications.js";

test("customer password reset email renders the reset action body", async () => {
  const originalEnv = {
    APP_ENV: process.env.APP_ENV,
    NODE_ENV: process.env.NODE_ENV,
    EMAIL_FORCE_TO: process.env.EMAIL_FORCE_TO,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CUSTOMER_ACCOUNT_EMAIL_FROM: process.env.CUSTOMER_ACCOUNT_EMAIL_FROM,
    CUSTOMER_ACCOUNT_EMAIL_REPLY_TO: process.env.CUSTOMER_ACCOUNT_EMAIL_REPLY_TO,
  };
  const originalFetch = globalThis.fetch;
  let payload = null;

  process.env.APP_ENV = "development";
  process.env.NODE_ENV = "development";
  process.env.EMAIL_FORCE_TO = "dev@nanaabaackah.com";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.CUSTOMER_ACCOUNT_EMAIL_FROM = "Stroane Test <accounts@example.com>";
  process.env.CUSTOMER_ACCOUNT_EMAIL_REPLY_TO = "support@example.com";

  globalThis.fetch = async (_url, options = {}) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ id: "email_test" }),
    };
  };

  try {
    const resetUrl = "https://stroanesolutions.com/reset-password?token=test-token";
    const result = await sendCustomerPasswordResetEmail({
      customer: {
        email: "customer@example.com",
        name: "Baaba Ackah",
      },
      resetUrl,
      expiresInMinutes: 60,
    });

    assert.equal(result.status, CUSTOMER_ACCOUNT_EMAIL_STATUSES.SENT);
    assert.deepEqual(payload.to, ["dev@nanaabaackah.com"]);
    assert.match(payload.subject, /^\[Local test\]/);
    assert.equal(payload.html.trim().startsWith("<!DOCTYPE html>"), true);
    assert.match(payload.html, /Local email redirect active/);
    assert.match(payload.html, /reset-email-card/);
    assert.match(payload.html, /Hello Baaba Ackah/);
    assert.match(payload.html, /Choose a new password/);
    assert.match(payload.html, /Reset password/);
    assert.match(payload.html, /copy and paste this link/);
    assert.match(payload.html, /This link expires in 60 minutes/);
    assert.match(payload.html, /request another reset link, this one will stop working/);
    assert.match(payload.html, /href="https:\/\/stroanesolutions\.com\/reset-password\?token=test-token"/);
    assert.doesNotMatch(payload.html, /email-hero/);
    assert.match(payload.text, /Original recipient: customer@example\.com/);
    assert.match(payload.text, /https:\/\/stroanesolutions\.com\/reset-password\?token=test-token/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
