const cleanText = (value, maxLength = 240) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export class PaymentGatewayError extends Error {
  constructor(message, { code = "PAYMENT_GATEWAY_ERROR", statusCode = 502, retryable = false } = {}) {
    super(message);
    this.name = "PaymentGatewayError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export const normalizeGatewayPaymentRequest = (request = {}) => {
  const amountCents = Math.round(Number(request.amountCents));
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new PaymentGatewayError("Payment amount must be a positive integer in minor units.", {
      code: "INVALID_PAYMENT_AMOUNT",
      statusCode: 400,
    });
  }
  const currency = cleanText(request.currency || "GHS", 3).toUpperCase();
  if (currency !== "GHS") {
    throw new PaymentGatewayError("REEBS online payments currently support GHS only.", {
      code: "UNSUPPORTED_PAYMENT_CURRENCY",
      statusCode: 400,
    });
  }
  const email = cleanText(request.email, 240).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PaymentGatewayError("A valid customer email is required.", {
      code: "INVALID_PAYMENT_EMAIL",
      statusCode: 400,
    });
  }
  const reference = cleanText(request.reference, 120);
  if (!/^[A-Za-z0-9._=-]{8,120}$/.test(reference)) {
    throw new PaymentGatewayError("A valid server-generated payment reference is required.", {
      code: "INVALID_PAYMENT_REFERENCE",
      statusCode: 400,
    });
  }
  return {
    amountCents,
    currency,
    email,
    reference,
    callbackUrl: cleanText(request.callbackUrl, 500) || undefined,
    metadata: request.metadata && typeof request.metadata === "object" ? request.metadata : {},
  };
};
