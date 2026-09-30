import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PaymentGatewayError,
  normalizeGatewayPaymentRequest,
} from "./paymentGateway.js";

const DEFAULT_BASE_URL = "https://api.paystack.co";

const parseProviderResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true) {
    throw new PaymentGatewayError("The payment provider could not complete the request.", {
      code: "PAYSTACK_REQUEST_FAILED",
      statusCode: 502,
      retryable: response.status >= 500,
    });
  }
  return payload.data || {};
};

export const verifyPaystackSignature = ({ rawBody, signature, secretKey }) => {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ""), "utf8");
  const supplied = String(signature || "").trim().toLowerCase();
  const expected = createHmac("sha512", String(secretKey || "")).update(body).digest("hex");
  if (!/^[a-f0-9]{128}$/.test(supplied) || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"));
};

export const createPaystackGateway = ({
  secretKey,
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
} = {}) => {
  if (!String(secretKey || "").trim()) {
    throw new PaymentGatewayError("Paystack is not configured.", {
      code: "PAYSTACK_NOT_CONFIGURED",
      statusCode: 503,
    });
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required.");
  }

  const request = async (path, options = {}) => {
    const response = await fetchImpl(`${String(baseUrl).replace(/\/$/, "")}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    return parseProviderResponse(response);
  };

  return Object.freeze({
    provider: "paystack",
    async initialize(paymentRequest) {
      const normalized = normalizeGatewayPaymentRequest(paymentRequest);
      const data = await request("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: normalized.email,
          amount: normalized.amountCents,
          currency: normalized.currency,
          reference: normalized.reference,
          callback_url: normalized.callbackUrl,
          metadata: normalized.metadata,
        }),
      });
      return {
        provider: "paystack",
        reference: data.reference || normalized.reference,
        authorizationUrl: data.authorization_url,
        accessCode: data.access_code,
      };
    },
    async verify(reference) {
      const safeReference = normalizeGatewayPaymentRequest({
        amountCents: 1,
        currency: "GHS",
        email: "verification@invalid.local",
        reference,
      }).reference;
      const data = await request(`/transaction/verify/${encodeURIComponent(safeReference)}`, {
        method: "GET",
      });
      return {
        provider: "paystack",
        reference: data.reference,
        status: data.status,
        amountCents: Number(data.amount || 0),
        currency: data.currency,
        paidAt: data.paid_at || null,
        channel: data.channel || null,
        customerEmail: data.customer?.email || null,
      };
    },
  });
};
