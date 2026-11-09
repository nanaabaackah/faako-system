import { PaystackGatewayError } from "./paystackGateway.js";

const isIntegerAmount = (value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/**
 * Validate an independently verified Paystack transaction against the immutable
 * payment intent snapshot. Never settle based on a redirect or webhook payload.
 */
export const validateVerifiedPaystackPayment = ({ intent, transaction }) => {
  if (!intent || !transaction) throw new PaystackGatewayError("Missing payment verification context", 400);
  if (intent.provider !== "PAYSTACK") throw new PaystackGatewayError("Unexpected payment provider", 409);
  if (intent.status === "CANCELLED" || intent.status === "EXPIRED") throw new PaystackGatewayError("Payment request is no longer collectible", 409);
  if (typeof intent.reference !== "string" || intent.reference !== transaction.reference) throw new PaystackGatewayError("Payment reference mismatch", 409);
  if (transaction.status !== "success") return { settled: false, providerStatus: transaction.status || "unknown" };
  if (intent.currency !== "GHS" || transaction.currency !== "GHS") throw new PaystackGatewayError("Payment currency mismatch", 409);
  if (!isIntegerAmount(intent.amountPesewas) || !isIntegerAmount(transaction.amountPesewas) || intent.amountPesewas !== transaction.amountPesewas) {
    throw new PaystackGatewayError("Payment amount mismatch", 409);
  }
  if (!["INVOICE", "STANDALONE"].includes(intent.type)) throw new PaystackGatewayError("Unsupported payment request type", 409);
  if (intent.type === "INVOICE" && !intent.invoiceId) throw new PaystackGatewayError("Invoice payment missing invoice association", 409);
  if (intent.type === "STANDALONE" && !intent.standalonePaymentId) throw new PaystackGatewayError("Standalone payment missing association", 409);
  if (!intent.organizationId) throw new PaystackGatewayError("Payment request missing organization scope", 409);
  return {
    settled: true,
    reference: transaction.reference,
    amountPesewas: transaction.amountPesewas,
    currency: transaction.currency,
    organizationId: intent.organizationId,
    type: intent.type,
    invoiceId: intent.type === "INVOICE" ? intent.invoiceId : null,
    standalonePaymentId: intent.type === "STANDALONE" ? intent.standalonePaymentId : null,
  };
};
