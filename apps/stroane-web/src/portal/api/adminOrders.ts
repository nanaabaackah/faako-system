import { apiPath } from "../../api/config";
import type { AdminSession } from "./adminSession";

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

const authRequest = (_session: AdminSession): RequestInit => ({
  credentials: "include",
});

const jsonAuthRequest = (_session: AdminSession): RequestInit => ({
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
  },
});

const withQuery = (path: string, filters: object = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return apiPath(`${path}${query ? `?${query}` : ""}`);
};

export interface AdminOrderItem {
  productSlug: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  paymentStatus?: string;
  paymentReference?: string;
  paymentProvider?: string;
  fulfillmentStatus?: string;
  deliveryMethod?: string;
  deliveryLocation?: {
    placeId?: string;
    label?: string;
    address?: string;
    provider?: string;
    latitude?: number;
    longitude?: number;
    mapUrl?: string;
  };
  expectedDeliveryDate?: string;
  adminDeliveryNotes?: string;
  internalNotes?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  paidAt?: string;
  paymentInitializedAt?: string;
  paymentVerifiedAt?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    preferredContactMethod?: string;
    businessName?: string;
    deliveryAddress: string;
    deliveryNotes?: string;
  };
  items: AdminOrderItem[];
}

export interface AdminOrderSummary {
  totalOrders: number;
  totalValue: number;
  paidValue: number;
  outstandingValue: number;
  paidOrders: number;
  pendingPaymentOrders: number;
  failedPaymentOrders: number;
  completedOrders: number;
}

export interface AdminOrderFilters {
  search?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  limit?: number;
}

export interface AdminOrderCreatePayload {
  customer: {
    name: string;
    email: string;
    phone: string;
    preferredContactMethod?: string;
    businessName?: string;
    deliveryAddress: string;
    deliveryNotes?: string;
  };
  items: Array<{
    productSlug: string;
    quantity: number;
  }>;
  source?: string;
}

export interface AdminOrderUpdatePayload {
  status?: string;
  fulfillmentStatus?: string;
  deliveryMethod?: string;
  expectedDeliveryDate?: string;
  adminDeliveryNotes?: string;
  internalNotes?: string;
}

export const adminOrdersApi = {
  async listOrders(session: AdminSession, filters: AdminOrderFilters = {}) {
    const response = await fetch(withQuery("/api/admin/orders", filters), {
      ...authRequest(session),
    });
    return parseJsonResponse<{ orders: AdminOrder[]; summary: AdminOrderSummary }>(
      response,
      "Unable to load orders."
    );
  },

  async createOrder(session: AdminSession, payload: AdminOrderCreatePayload) {
    const response = await fetch(apiPath("/api/admin/orders"), {
      method: "POST",
      ...jsonAuthRequest(session),
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<{ order: AdminOrder }>(response, "Unable to create order.");
  },

  async updateOrder(session: AdminSession, orderId: string, payload: AdminOrderUpdatePayload) {
    const response = await fetch(apiPath(`/api/admin/orders/${encodeURIComponent(orderId)}`), {
      method: "PATCH",
      ...jsonAuthRequest(session),
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<{ order: AdminOrder }>(response, "Unable to update order.");
  },

  async initializePaystack(session: AdminSession, orderId: string) {
    const response = await fetch(
      apiPath(`/api/admin/orders/${encodeURIComponent(orderId)}/paystack/initialize`),
      {
        method: "POST",
        ...jsonAuthRequest(session),
        body: JSON.stringify({}),
      }
    );
    return parseJsonResponse<{
      order: AdminOrder;
      payment: {
        provider: "paystack";
        status: string;
        reference: string;
        authorizationUrl: string;
        testMode?: boolean;
      };
    }>(response, "Unable to initialize Paystack.");
  },

  async refreshPaystackStatus(session: AdminSession, orderId: string) {
    const response = await fetch(
      apiPath(`/api/admin/orders/${encodeURIComponent(orderId)}/paystack/verify`),
      {
        method: "POST",
        ...jsonAuthRequest(session),
        body: JSON.stringify({}),
      }
    );
    return parseJsonResponse<{
      order: AdminOrder;
      payment: {
        provider: "paystack";
        status: string;
        reference: string;
        amountMatches: boolean;
        currencyMatches: boolean;
      };
    }>(response, "Unable to refresh Paystack status.");
  },
};
