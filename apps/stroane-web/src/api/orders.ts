import { formatCurrency } from "../data/products";
import { apiPath } from "./config";

const parseJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : fallbackMessage;
    throw new Error(message);
  }

  if (!body) throw new Error(fallbackMessage);
  return body as T;
};

export interface CheckoutCustomerPayload {
  name: string;
  email: string;
  phone: string;
  preferredContactMethod?: "email" | "phone" | "whatsapp";
  businessName?: string;
  deliveryAddress: string;
  deliveryNotes?: string;
}

export type CheckoutFulfillmentMethod = "delivery" | "pickup";

export interface CheckoutOrderItemPayload {
  productSlug: string;
  quantity: number;
}

export interface CheckoutOrderPayload {
  customer: CheckoutCustomerPayload;
  items: CheckoutOrderItemPayload[];
  source?: "checkout";
  website?: string;
  fulfillmentMethod?: CheckoutFulfillmentMethod;
  deliveryMethod?: CheckoutFulfillmentMethod;
  pickupLocationId?: string;
  pickupLocationName?: string;
  pickupDate?: string;
  pickupTime?: string;
  expectedDeliveryDate?: string;
}

export interface CheckoutOrderResponse {
  order: {
    id: string;
    orderNumber: string;
    status: "pending" | "payment_pending" | "paid" | "processing" | "completed" | "cancelled";
    preferredContactMethod?: string;
    deliveryMethod?: CheckoutFulfillmentMethod;
    expectedDeliveryDate?: string;
    paymentStatus?: "payment_pending" | "paid" | "failed" | "abandoned" | "not_started";
    paymentReference?: string;
    currency: "GHS";
    subtotal: number;
    total: number;
    createdAt: string;
    paidAt?: string;
    nextStep: string;
    items: Array<{
      productSlug: string;
      productName: string;
      sku?: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  };
  payment: {
    provider: "paystack";
    status: "not_started";
    reference: null;
    nextStep: string;
  };
}

export interface PaystackInitializeResponse {
  payment: {
    provider: "paystack";
    status: "payment_pending";
    reference: string;
    authorizationUrl: string;
    testMode: boolean;
  };
}

export interface PaystackVerifyResponse {
  order?: CheckoutOrderResponse["order"];
  payment: {
    provider: "paystack";
    status: "payment_pending" | "paid" | "failed" | "abandoned";
    reference?: string;
    confirmationSource?: "webhook" | "callback_status_check" | "existing_paid_order";
  };
}

export const orderApi = {
  async createOrder(payload: CheckoutOrderPayload): Promise<CheckoutOrderResponse> {
    const response = await fetch(apiPath("/api/orders"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<CheckoutOrderResponse>(
      response,
      "Unable to prepare your order right now."
    );
  },

  async initializePaystackPayment(orderId: string): Promise<PaystackInitializeResponse> {
    const response = await fetch(
      apiPath(`/api/orders/${encodeURIComponent(orderId)}/paystack/initialize`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );
    return parseJsonResponse<PaystackInitializeResponse>(
      response,
      "Unable to start Paystack payment."
    );
  },

  async verifyPaystackPayment(reference: string): Promise<PaystackVerifyResponse> {
    const response = await fetch(apiPath("/api/paystack/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    });
    return parseJsonResponse<PaystackVerifyResponse>(
      response,
      "Unable to verify Paystack payment."
    );
  },
};

export const formatOrderTotal = (value: number) => formatCurrency(value);
