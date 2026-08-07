import type { AdminSession } from "./adminSession";
import { stroaneApiClient } from "../../api/client";

const withQuery = (path: string, filters: object = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
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
    void session;
    return stroaneApiClient.get<{ orders: AdminOrder[]; summary: AdminOrderSummary }>(
      withQuery("/api/admin/orders", filters),
      { fallbackMessage: "Unable to load orders." },
    );
  },

  async createOrder(session: AdminSession, payload: AdminOrderCreatePayload) {
    void session;
    return stroaneApiClient.post<{ order: AdminOrder }>("/api/admin/orders", {
      json: payload,
      fallbackMessage: "Unable to create order.",
    });
  },

  async updateOrder(session: AdminSession, orderId: string, payload: AdminOrderUpdatePayload) {
    void session;
    return stroaneApiClient.patch<{ order: AdminOrder }>(
      `/api/admin/orders/${encodeURIComponent(orderId)}`,
      { json: payload, fallbackMessage: "Unable to update order." },
    );
  },

  async initializePaystack(session: AdminSession, orderId: string) {
    void session;
    return stroaneApiClient.post<{
      order: AdminOrder;
      payment: {
        provider: "paystack";
        status: string;
        reference: string;
        authorizationUrl: string;
        testMode?: boolean;
      };
    }>(`/api/admin/orders/${encodeURIComponent(orderId)}/paystack/initialize`, {
      json: {},
      fallbackMessage: "Unable to initialize Paystack.",
    });
  },

  async refreshPaystackStatus(session: AdminSession, orderId: string) {
    void session;
    return stroaneApiClient.post<{
      order: AdminOrder;
      payment: {
        provider: "paystack";
        status: string;
        reference: string;
        amountMatches: boolean;
        currencyMatches: boolean;
      };
    }>(`/api/admin/orders/${encodeURIComponent(orderId)}/paystack/verify`, {
      json: {},
      fallbackMessage: "Unable to refresh Paystack status.",
    });
  },
};
