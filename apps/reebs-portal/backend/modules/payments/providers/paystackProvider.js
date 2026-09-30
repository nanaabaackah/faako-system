import crypto from "node:crypto";

const PAYSTACK_API_BASE_URL = "https://api.paystack.co";

const safeText = (value, max = 240) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const requireSecret = (secretKey) => {
  const secret = safeText(secretKey, 300);
  if (!secret) {
    const error = new Error("Paystack is not configured.");
    error.statusCode = 503;
    error.code = "PAYMENT_PROVIDER_NOT_CONFIGURED";
    throw error;
  }
  return secret;
};

const parseProviderResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true) {
    const error = new Error("The payment provider could not process this request.");
    error.statusCode = response.status >= 500 ? 503 : 422;
    error.code = "PAYMENT_PROVIDER_FAILED";
    error.providerStatus = response.status;
    throw error;
  }
  return payload.data || {};
};

export const verifyPaystackSignature = ({ rawBody, signature, secretKey }) => {
  const secret = requireSecret(secretKey);
  const provided = safeText(signature, 256).toLowerCase();
  if (!provided || !/^[a-f0-9]{128}$/.test(provided)) return false;
  const expected = crypto
    .createHmac("sha512", secret)
    .update(String(rawBody || ""), "utf8")
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
};

export const normalizePaystackTransaction = (data = {}) => ({
  provider: "PAYSTACK",
  providerReference: safeText(data.reference, 160) || null,
  status: safeText(data.status, 40).toLowerCase() || "unknown",
  amountCents: Number.isFinite(Number(data.amount)) ? Math.round(Number(data.amount)) : null,
  currency: safeText(data.currency, 3).toUpperCase() || null,
  paidAt: data.paid_at || data.paidAt || null,
  channel: safeText(data.channel, 80) || null,
  customerEmail: safeText(data.customer?.email, 254).toLowerCase() || null,
});

export const createPaystackProvider = ({
  secretKey = process.env.PAYSTACK_SECRET_KEY,
  fetchImpl = globalThis.fetch,
  apiBaseUrl = PAYSTACK_API_BASE_URL,
  timeoutMs = Math.max(1_000, Number(process.env.PAYSTACK_TIMEOUT_MS) || 12_000),
} = {}) => {
  const secret = requireSecret(secretKey);
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required for Paystack.");
  }
  const request = async (path, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${apiBaseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
      return await parseProviderResponse(response);
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new Error("The payment provider timed out. No payment was recorded.");
        timeoutError.statusCode = 503;
        timeoutError.code = "PAYMENT_PROVIDER_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  const verifyPayment = async (reference) => {
    const safeReference = safeText(reference, 160);
    if (!safeReference) {
      const error = new Error("Payment reference is required.");
      error.statusCode = 400;
      error.code = "INVALID_PAYMENT_REFERENCE";
      throw error;
    }
    const data = await request(`/transaction/verify/${encodeURIComponent(safeReference)}`, {
      method: "GET",
    });
    return normalizePaystackTransaction(data);
  };

  return Object.freeze({
    name: "PAYSTACK",
    async initializePayment({ email, amountCents, currency, reference, callbackUrl, channels }) {
      const payload = {
        email: safeText(email, 254).toLowerCase(),
        amount: Math.round(Number(amountCents)),
        currency: safeText(currency, 3).toUpperCase(),
        reference: safeText(reference, 160),
        ...(safeText(callbackUrl, 500) ? { callback_url: safeText(callbackUrl, 500) } : {}),
        ...(Array.isArray(channels) && channels.length ? { channels } : {}),
      };
      if (!payload.email || payload.amount <= 0 || !payload.currency || !payload.reference) {
        const error = new Error("Trusted payment initialization details are incomplete.");
        error.statusCode = 400;
        error.code = "INVALID_PAYMENT_INITIALIZATION";
        throw error;
      }
      const data = await request("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return {
        provider: "PAYSTACK",
        authorizationUrl: safeText(data.authorization_url, 800),
        accessCode: safeText(data.access_code, 240),
        providerReference: safeText(data.reference, 160) || payload.reference,
      };
    },
    verifyPayment,
    getPaymentStatus: verifyPayment,
    processWebhook({ rawBody, signature }) {
      if (!verifyPaystackSignature({ rawBody, signature, secretKey: secret })) {
        const error = new Error("Invalid webhook signature.");
        error.statusCode = 401;
        error.code = "INVALID_WEBHOOK_SIGNATURE";
        throw error;
      }
      let payload;
      try {
        payload = JSON.parse(String(rawBody || ""));
      } catch {
        const error = new Error("Invalid webhook payload.");
        error.statusCode = 400;
        error.code = "INVALID_WEBHOOK_PAYLOAD";
        throw error;
      }
      const eventType = safeText(payload?.event, 120);
      return {
        eventType,
        supported: eventType === "charge.success",
        transaction: normalizePaystackTransaction(payload?.data || {}),
      };
    },
    verifyWebhookSignature(rawBody, signature) {
      return verifyPaystackSignature({ rawBody, signature, secretKey: secret });
    },
  });
};
