import { createPaystackProvider } from "./providers/paystackProvider.js";

export const PAYMENT_PROVIDERS = Object.freeze({
  PAYSTACK: "PAYSTACK",
  MANUAL: "MANUAL",
});

export const getOnlinePaymentProvider = (name = "PAYSTACK", options = {}) => {
  const normalized = String(name || "").trim().toUpperCase();
  if (normalized === PAYMENT_PROVIDERS.PAYSTACK) {
    return createPaystackProvider(options);
  }
  const error = new Error("Unsupported online payment provider.");
  error.statusCode = 400;
  error.code = "UNSUPPORTED_PAYMENT_PROVIDER";
  throw error;
};
