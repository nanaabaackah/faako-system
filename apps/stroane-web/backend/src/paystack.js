import crypto from "node:crypto";

const PAYSTACK_INITIALIZE_URL = "https://api.paystack.co/transaction/initialize";
const PAYSTACK_VERIFY_URL = "https://api.paystack.co/transaction/verify";

export const PAYMENT_STATUSES = {
  PAYMENT_PENDING: "payment_pending",
  PAID: "paid",
  FAILED: "failed",
  ABANDONED: "abandoned",
};

const sanitizeText = (value, maxLength = 240) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const toMoneyNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
};

const toMinorUnits = (value) => Math.round(toMoneyNumber(value) * 100);

const parsePaystackJson = async (response, fallbackMessage) => {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.status) {
    const error = new Error(body?.message || fallbackMessage);
    error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 503;
    error.providerResponse = body || null;
    throw error;
  }
  return body;
};

const getPaystackSecretKey = () => sanitizeText(process.env.PAYSTACK_SECRET_KEY, 300);

const getPaystackWebhookSecret = () =>
  sanitizeText(process.env.PAYSTACK_WEBHOOK_SECRET, 300) || getPaystackSecretKey();

export const isPaystackConfigured = () => Boolean(getPaystackSecretKey());

export const isPaystackTestMode = () => getPaystackSecretKey().startsWith("sk_test_");

export const getPaystackCurrency = (fallbackCurrency = "GHS") =>
  sanitizeText(process.env.PAYSTACK_CURRENCY, 12) || fallbackCurrency || "GHS";

export const getPaystackCallbackUrl = () =>
  sanitizeText(process.env.PAYSTACK_CALLBACK_URL, 500) ||
  "http://localhost:5175/checkout/return";

export const buildPaystackReference = (order) =>
  `${order.orderNumber}-${Date.now()}`.replace(/[^a-zA-Z0-9._=-]/g, "-").slice(0, 100);

export const assertPaystackConfigured = () => {
  const secretKey = getPaystackSecretKey();
  if (!secretKey) {
    const error = new Error("Paystack is not configured for this environment.");
    error.statusCode = 503;
    throw error;
  }

  if (
    secretKey.startsWith("sk_live_") &&
    String(process.env.PAYSTACK_ALLOW_LIVE || "").toLowerCase() !== "true"
  ) {
    const error = new Error("Live Paystack keys are disabled for this environment.");
    error.statusCode = 503;
    throw error;
  }

  return secretKey;
};

export const assertPaystackWebhookConfigured = () => {
  const webhookSecret = getPaystackWebhookSecret();
  if (!webhookSecret) {
    const error = new Error("Paystack webhook verification is not configured.");
    error.statusCode = 503;
    throw error;
  }

  if (
    webhookSecret.startsWith("sk_live_") &&
    String(process.env.PAYSTACK_ALLOW_LIVE || "").toLowerCase() !== "true"
  ) {
    const error = new Error("Live Paystack webhook keys are disabled for this environment.");
    error.statusCode = 503;
    throw error;
  }

  return webhookSecret;
};

export const verifyPaystackWebhookSignature = ({ rawBody, signature } = {}) => {
  const webhookSecret = assertPaystackWebhookConfigured();
  const safeSignature = sanitizeText(signature, 256);
  if (!rawBody || !safeSignature) return false;

  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(String(rawBody || ""), "utf8");
  const expected = crypto.createHmac("sha512", webhookSecret).update(bodyBuffer).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(safeSignature, "utf8");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
};

export const buildOrderPaymentAmount = (order) => {
  const itemTotal = (order.items || []).reduce(
    (sum, item) => sum + toMoneyNumber(item.lineTotal),
    0
  );
  const orderTotal = toMoneyNumber(order.total);

  if (!itemTotal || !orderTotal || itemTotal !== orderTotal) {
    const error = new Error("Order total could not be verified for payment.");
    error.statusCode = 409;
    throw error;
  }

  return {
    amountMajor: orderTotal,
    amountMinor: toMinorUnits(orderTotal),
    currency: order.currency || "GHS",
  };
};

export const initializePaystackTransaction = async ({ order, reference }) => {
  const secretKey = assertPaystackConfigured();
  const { amountMinor, currency } = buildOrderPaymentAmount(order);
  const expectedCurrency = getPaystackCurrency(currency);

  if (expectedCurrency !== currency) {
    const error = new Error("Order currency does not match Paystack configuration.");
    error.statusCode = 409;
    throw error;
  }

  const response = await fetch(PAYSTACK_INITIALIZE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: order.customerEmail,
      amount: amountMinor,
      currency,
      reference,
      callback_url: getPaystackCallbackUrl(),
      metadata: {
        orderNumber: order.orderNumber,
        source: "stroane_checkout",
        custom_fields: [
          {
            display_name: "Order number",
            variable_name: "order_number",
            value: order.orderNumber,
          },
        ],
      },
    }),
  });

  const body = await parsePaystackJson(response, "Unable to initialize Paystack payment.");
  return {
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code,
    reference: body.data.reference,
    providerMessage: body.message,
    testMode: isPaystackTestMode(),
    amountMinor,
    currency,
  };
};

export const verifyPaystackTransaction = async (reference) => {
  const secretKey = assertPaystackConfigured();
  const safeReference = encodeURIComponent(sanitizeText(reference, 120));

  const response = await fetch(`${PAYSTACK_VERIFY_URL}/${safeReference}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  const body = await parsePaystackJson(response, "Unable to verify Paystack payment.");
  return body.data;
};

export const mapPaystackStatus = (providerStatus = "") => {
  const status = String(providerStatus || "").trim().toLowerCase();
  if (status === "success") return PAYMENT_STATUSES.PAID;
  if (status === "failed") return PAYMENT_STATUSES.FAILED;
  if (status === "abandoned") return PAYMENT_STATUSES.ABANDONED;
  return PAYMENT_STATUSES.PAYMENT_PENDING;
};

export const mapPaystackWebhookPaymentStatus = (event = "", data = {}) => {
  const normalizedEvent = sanitizeText(event, 80).toLowerCase();
  const mappedStatus = mapPaystackStatus(data?.status);
  if (normalizedEvent === "charge.success") return mappedStatus;
  if (mappedStatus !== PAYMENT_STATUSES.PAYMENT_PENDING) return mappedStatus;
  if (normalizedEvent.includes("failed")) return PAYMENT_STATUSES.FAILED;
  if (normalizedEvent.includes("abandoned")) return PAYMENT_STATUSES.ABANDONED;
  return PAYMENT_STATUSES.PAYMENT_PENDING;
};

export const toSafePaystackMetadata = (data = {}) => ({
  provider: "paystack",
  reference: sanitizeText(data.reference, 120),
  status: sanitizeText(data.status, 40),
  gatewayResponse: sanitizeText(data.gateway_response, 160),
  channel: sanitizeText(data.channel, 60) || null,
  currency: sanitizeText(data.currency, 12),
  amount: Number(data.amount) || 0,
  paidAt: data.paid_at || null,
  transactionDate: data.transaction_date || null,
  verifiedAt: new Date().toISOString(),
  testMode: isPaystackTestMode(),
});

export const toSafePaystackWebhookMetadata = ({ event, data } = {}) => ({
  ...toSafePaystackMetadata(data || {}),
  confirmationSource: "webhook",
  webhookEvent: sanitizeText(event, 80),
  webhookReceivedAt: new Date().toISOString(),
});
