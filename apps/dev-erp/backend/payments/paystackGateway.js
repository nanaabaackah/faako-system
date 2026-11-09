import crypto from "node:crypto";

const PAYSTACK_ORIGIN = "https://api.paystack.co";
const REFERENCE_PATTERN = /^[A-Za-z0-9._=-]{8,120}$/;

export class PaystackGatewayError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "PaystackGatewayError";
    this.status = status;
  }
}

export const verifyPaystackSignature = (rawBody, signature, secret) => {
  if (!Buffer.isBuffer(rawBody) || !secret || typeof signature !== "string" || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
};

export const parseGhsPesewas = (amount) => {
  const text = String(amount ?? "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) throw new PaystackGatewayError("Invalid GHS amount", 400);
  const [whole, fraction = ""] = text.split(".");
  const pesewas = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (pesewas < 100n || pesewas > BigInt(Number.MAX_SAFE_INTEGER)) throw new PaystackGatewayError("Payment amount is outside supported limits", 400);
  return Number(pesewas);
};

export const createPaystackGateway = ({ secretKey, fetchImpl = fetch, timeoutMs = 10000 }) => {
  if (!secretKey || typeof secretKey !== "string") throw new PaystackGatewayError("Paystack server configuration missing", 503);
  const request = async (path, options = {}) => {
    const response = await fetchImpl(new URL(path, PAYSTACK_ORIGIN), {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status !== true) throw new PaystackGatewayError("Paystack request failed", 502);
    return payload.data;
  };
  return {
    async initialize({ reference, amountPesewas, email, callbackUrl, metadata = {} }) {
      if (!REFERENCE_PATTERN.test(reference) || !Number.isSafeInteger(amountPesewas) || amountPesewas < 100) throw new PaystackGatewayError("Invalid payment request", 400);
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PaystackGatewayError("Valid customer email required", 400);
      const callback = new URL(callbackUrl);
      if (callback.protocol !== "https:") throw new PaystackGatewayError("HTTPS callback required", 400);
      const data = await request("/transaction/initialize", { method: "POST", body: JSON.stringify({ reference, amount: amountPesewas, email, currency: "GHS", callback_url: callback.toString(), metadata }) });
      const checkout = new URL(data.authorization_url);
      if (checkout.protocol !== "https:" || !(checkout.hostname === "checkout.paystack.com" || checkout.hostname.endsWith(".checkout.paystack.com"))) throw new PaystackGatewayError("Untrusted checkout URL");
      if (data.reference !== reference) throw new PaystackGatewayError("Paystack reference mismatch");
      return { reference, authorizationUrl: checkout.toString(), accessCode: data.access_code };
    },
    async verify(reference) {
      if (!REFERENCE_PATTERN.test(reference)) throw new PaystackGatewayError("Invalid payment reference", 400);
      const data = await request(`/transaction/verify/${encodeURIComponent(reference)}`);
      if (data.reference !== reference) throw new PaystackGatewayError("Paystack reference mismatch");
      return { reference, status: data.status, amountPesewas: data.amount, currency: data.currency, paidAt: data.paid_at || null };
    },
  };
};
