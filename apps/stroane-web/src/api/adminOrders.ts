import { apiPath } from "./config";

const ADMIN_SESSION_KEY = "stroane_admin_session_v1";

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

export interface AdminSession {
  token: string;
  username: string;
  role: "ADMIN" | "VIEWER";
}

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  businessName?: string | null;
  createdAt: string;
  updatedAt: string;
  currency: string;
  total: number;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  itemCount: number;
  paymentReferenceSafe?: string | null;
  paidAt?: string | null;
  expectedDeliveryDate?: string | null;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  customer: {
    name: string;
    email: string;
    phone: string;
    businessName?: string | null;
    preferredContactMethod: string;
  };
  delivery: {
    address: string;
    customerNotes?: string | null;
    method?: string | null;
    adminNotes?: string | null;
    expectedDeliveryDate?: string | null;
  };
  payment: {
    provider: string;
    status: string;
    reference?: string | null;
    confirmationSource?: string | null;
    initializedAt?: string | null;
    verifiedAt?: string | null;
    failedAt?: string | null;
    paidAt?: string | null;
  };
  internalNotes?: string | null;
  statusUpdatedAt?: string | null;
  statusUpdatedById?: string | null;
  items: Array<{
    id: string;
    productSlug: string;
    productName: string;
    sku?: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    currency: string;
  }>;
}

export interface AdminOrderFilters {
  search?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
}

export interface AdminOrderUpdatePayload {
  status?: string;
  deliveryMethod?: string;
  expectedDeliveryDate?: string | null;
  adminDeliveryNotes?: string;
  internalNotes?: string;
}

export const getStoredAdminSession = (): AdminSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(ADMIN_SESSION_KEY) || "null");
    if (
      !parsed?.token ||
      !parsed?.username ||
      !["ADMIN", "VIEWER"].includes(parsed?.role)
    ) {
      return null;
    }
    return parsed as AdminSession;
  } catch {
    return null;
  }
};

export const storeAdminSession = (session: AdminSession) => {
  window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
};

export const clearAdminSession = () => {
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
};

const authHeaders = (session: AdminSession) => ({
  Authorization: `Bearer ${session.token}`,
});

export const adminOrderApi = {
  async login(username: string, password: string): Promise<AdminSession> {
    const response = await fetch(apiPath("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await parseJsonResponse<{
      ok: boolean;
      token: string;
      username: string;
      role: "ADMIN" | "VIEWER";
    }>(response, "Unable to sign in.");
    return { token: data.token, username: data.username, role: data.role };
  },

  async listOrders(
    session: AdminSession,
    filters: AdminOrderFilters = {}
  ): Promise<AdminOrderSummary[]> {
    const searchParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) searchParams.set(key, value);
    });
    const query = searchParams.toString();
    const response = await fetch(apiPath(`/api/admin/orders${query ? `?${query}` : ""}`), {
      headers: authHeaders(session),
    });
    const data = await parseJsonResponse<{ orders: AdminOrderSummary[] }>(
      response,
      "Unable to load orders."
    );
    return data.orders;
  },

  async getOrder(session: AdminSession, orderId: string): Promise<AdminOrderDetail> {
    const response = await fetch(apiPath(`/api/admin/orders/${encodeURIComponent(orderId)}`), {
      headers: authHeaders(session),
    });
    const data = await parseJsonResponse<{ order: AdminOrderDetail }>(
      response,
      "Unable to load order."
    );
    return data.order;
  },

  async updateOrder(
    session: AdminSession,
    orderId: string,
    payload: AdminOrderUpdatePayload
  ): Promise<AdminOrderDetail> {
    const response = await fetch(
      apiPath(`/api/admin/orders/${encodeURIComponent(orderId)}/status`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session),
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await parseJsonResponse<{ order: AdminOrderDetail }>(
      response,
      "Unable to update order."
    );
    return data.order;
  },
};
