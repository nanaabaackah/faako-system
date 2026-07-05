import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  PAYMENT_STATUSES,
  assertPaystackWebhookConfigured,
  getPaystackCallbackUrl,
  initializePaystackTransaction,
  mapPaystackStatus,
  verifyPaystackWebhookSignature,
} from "./src/paystack.js";

test("Paystack webhook signature verification accepts signed raw payloads", () => {
  const previousSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  process.env.PAYSTACK_WEBHOOK_SECRET = "sk_test_webhook_signature";

  try {
    const rawBody = Buffer.from(
      JSON.stringify({
        event: "charge.success",
        data: { reference: "STR-TEST-001", amount: 12000, currency: "GHS" },
      })
    );
    const signature = crypto
      .createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    assert.equal(verifyPaystackWebhookSignature({ rawBody, signature }), true);
    assert.equal(verifyPaystackWebhookSignature({ rawBody, signature: "bad-signature" }), false);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.PAYSTACK_WEBHOOK_SECRET;
    } else {
      process.env.PAYSTACK_WEBHOOK_SECRET = previousSecret;
    }
  }
});

test("Paystack transaction statuses map to internal payment states", () => {
  assert.equal(mapPaystackStatus("success"), PAYMENT_STATUSES.PAID);
  assert.equal(mapPaystackStatus("failed"), PAYMENT_STATUSES.FAILED);
  assert.equal(mapPaystackStatus("abandoned"), PAYMENT_STATUSES.ABANDONED);
  assert.equal(mapPaystackStatus("pending"), PAYMENT_STATUSES.PAYMENT_PENDING);
});

test("Paystack callback URL defaults to the local checkout return page", () => {
  const previousCallbackUrl = process.env.PAYSTACK_CALLBACK_URL;
  const previousAppEnv = process.env.APP_ENV;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousStorefrontBaseUrl = process.env.STROANE_STOREFRONT_BASE_URL;
  const previousPublicWebsiteUrl = process.env.VITE_PUBLIC_WEBSITE_URL;

  try {
    delete process.env.APP_ENV;
    process.env.NODE_ENV = "development";
    delete process.env.STROANE_STOREFRONT_BASE_URL;
    delete process.env.VITE_PUBLIC_WEBSITE_URL;
    delete process.env.PAYSTACK_CALLBACK_URL;
    assert.equal(getPaystackCallbackUrl(), "http://localhost:5175/checkout/return");

    process.env.PAYSTACK_CALLBACK_URL = "https://shop.example.com/checkout/return";
    assert.equal(getPaystackCallbackUrl(), "https://shop.example.com/checkout/return");
  } finally {
    if (previousCallbackUrl === undefined) {
      delete process.env.PAYSTACK_CALLBACK_URL;
    } else {
      process.env.PAYSTACK_CALLBACK_URL = previousCallbackUrl;
    }

    if (previousAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = previousAppEnv;
    }

    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    if (previousStorefrontBaseUrl === undefined) {
      delete process.env.STROANE_STOREFRONT_BASE_URL;
    } else {
      process.env.STROANE_STOREFRONT_BASE_URL = previousStorefrontBaseUrl;
    }

    if (previousPublicWebsiteUrl === undefined) {
      delete process.env.VITE_PUBLIC_WEBSITE_URL;
    } else {
      process.env.VITE_PUBLIC_WEBSITE_URL = previousPublicWebsiteUrl;
    }
  }
});

test("Paystack callback URL stays on staging when APP_ENV is staging", () => {
  const previousCallbackUrl = process.env.PAYSTACK_CALLBACK_URL;
  const previousAppEnv = process.env.APP_ENV;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousStorefrontBaseUrl = process.env.STROANE_STOREFRONT_BASE_URL;
  const previousPublicWebsiteUrl = process.env.VITE_PUBLIC_WEBSITE_URL;

  try {
    process.env.APP_ENV = "staging";
    process.env.NODE_ENV = "production";
    delete process.env.STROANE_STOREFRONT_BASE_URL;
    process.env.VITE_PUBLIC_WEBSITE_URL = "https://stage.stroanesolutions.com";

    process.env.PAYSTACK_CALLBACK_URL = "https://stroanesolutions.com/checkout/return";
    assert.equal(getPaystackCallbackUrl(), "https://stage.stroanesolutions.com/checkout/return");

    process.env.PAYSTACK_CALLBACK_URL = "https://stage.stroanesolutions.com/checkout/return";
    assert.equal(getPaystackCallbackUrl(), "https://stage.stroanesolutions.com/checkout/return");

    delete process.env.PAYSTACK_CALLBACK_URL;
    assert.equal(getPaystackCallbackUrl(), "https://stage.stroanesolutions.com/checkout/return");
  } finally {
    if (previousCallbackUrl === undefined) {
      delete process.env.PAYSTACK_CALLBACK_URL;
    } else {
      process.env.PAYSTACK_CALLBACK_URL = previousCallbackUrl;
    }

    if (previousAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = previousAppEnv;
    }

    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    if (previousStorefrontBaseUrl === undefined) {
      delete process.env.STROANE_STOREFRONT_BASE_URL;
    } else {
      process.env.STROANE_STOREFRONT_BASE_URL = previousStorefrontBaseUrl;
    }

    if (previousPublicWebsiteUrl === undefined) {
      delete process.env.VITE_PUBLIC_WEBSITE_URL;
    } else {
      process.env.VITE_PUBLIC_WEBSITE_URL = previousPublicWebsiteUrl;
    }
  }
});

test("Paystack webhook verification falls back to the backend secret key", () => {
  const previousWebhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  const previousSecretKey = process.env.PAYSTACK_SECRET_KEY;

  try {
    delete process.env.PAYSTACK_WEBHOOK_SECRET;
    process.env.PAYSTACK_SECRET_KEY = "sk_test_backend_secret";

    assert.equal(assertPaystackWebhookConfigured(), "sk_test_backend_secret");
  } finally {
    if (previousWebhookSecret === undefined) {
      delete process.env.PAYSTACK_WEBHOOK_SECRET;
    } else {
      process.env.PAYSTACK_WEBHOOK_SECRET = previousWebhookSecret;
    }

    if (previousSecretKey === undefined) {
      delete process.env.PAYSTACK_SECRET_KEY;
    } else {
      process.env.PAYSTACK_SECRET_KEY = previousSecretKey;
    }
  }
});

test("Paystack initialization sends amount, currency, reference, and callback URL", async () => {
  const previousSecretKey = process.env.PAYSTACK_SECRET_KEY;
  const previousCallbackUrl = process.env.PAYSTACK_CALLBACK_URL;
  const previousCurrency = process.env.PAYSTACK_CURRENCY;
  const previousFetch = globalThis.fetch;

  try {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_backend_secret";
    process.env.PAYSTACK_CALLBACK_URL = "http://localhost:5175/checkout/return";
    process.env.PAYSTACK_CURRENCY = "GHS";

    globalThis.fetch = async (url, options = {}) => {
      assert.equal(url, "https://api.paystack.co/transaction/initialize");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer sk_test_backend_secret");
      assert.equal(options.headers["Content-Type"], "application/json");

      const payload = JSON.parse(options.body);
      assert.equal(payload.email, "customer@example.com");
      assert.equal(payload.amount, 12500);
      assert.equal(payload.currency, "GHS");
      assert.equal(payload.reference, "STR-TEST-REF");
      assert.equal(payload.callback_url, "http://localhost:5175/checkout/return");
      assert.equal(payload.metadata.orderNumber, "STR-TEST-001");

      return new Response(
        JSON.stringify({
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: "https://checkout.paystack.com/test-access-code",
            access_code: "test-access-code",
            reference: payload.reference,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    };

    const payment = await initializePaystackTransaction({
      order: {
        orderNumber: "STR-TEST-001",
        customerEmail: "customer@example.com",
        total: 125,
        currency: "GHS",
        items: [{ lineTotal: 100 }, { lineTotal: 25 }],
      },
      reference: "STR-TEST-REF",
    });

    assert.equal(payment.authorizationUrl, "https://checkout.paystack.com/test-access-code");
    assert.equal(payment.reference, "STR-TEST-REF");
    assert.equal(payment.amountMinor, 12500);
    assert.equal(payment.testMode, true);
  } finally {
    globalThis.fetch = previousFetch;

    if (previousSecretKey === undefined) {
      delete process.env.PAYSTACK_SECRET_KEY;
    } else {
      process.env.PAYSTACK_SECRET_KEY = previousSecretKey;
    }

    if (previousCallbackUrl === undefined) {
      delete process.env.PAYSTACK_CALLBACK_URL;
    } else {
      process.env.PAYSTACK_CALLBACK_URL = previousCallbackUrl;
    }

    if (previousCurrency === undefined) {
      delete process.env.PAYSTACK_CURRENCY;
    } else {
      process.env.PAYSTACK_CURRENCY = previousCurrency;
    }
  }
});
