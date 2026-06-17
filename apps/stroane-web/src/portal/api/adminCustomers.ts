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

export interface AdminCustomer {
  id: string;
  email: string;
  status: "invited" | "active" | "locked";
  name: string;
  phone?: string;
  businessName?: string;
  preferredContactMethod?: string;
  defaultDeliveryAddress?: string;
  deliveryNotes?: string;
  hasAccount: boolean;
  inviteActive: boolean;
  invitedAt?: string;
  inviteExpiresAt?: string;
  activatedAt?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  orderCount: number;
  totalSpend: number;
  lastOrder?: {
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    paymentStatus?: string;
    createdAt?: string;
  } | null;
}

export interface AdminCustomerSummary {
  totalCustomers: number;
  activeAccounts: number;
  invitedAccounts: number;
  lockedAccounts: number;
  linkedOrders: number;
}

export interface AdminCustomerFilters {
  search?: string;
  status?: string;
  limit?: number;
}

export interface AdminCustomerPayload {
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  preferredContactMethod?: string;
  defaultDeliveryAddress?: string;
  deliveryNotes?: string;
  createInvite?: boolean;
}

export interface AdminCustomerInvite {
  signupUrl: string;
  expiresAt: string;
}

export const adminCustomersApi = {
  async listCustomers(session: AdminSession, filters: AdminCustomerFilters = {}) {
    const response = await fetch(withQuery("/api/admin/customers", filters), {
      ...authRequest(session),
    });
    return parseJsonResponse<{ customers: AdminCustomer[]; summary: AdminCustomerSummary }>(
      response,
      "Unable to load customers."
    );
  },

  async createCustomer(session: AdminSession, payload: AdminCustomerPayload) {
    const response = await fetch(apiPath("/api/admin/customers"), {
      method: "POST",
      ...jsonAuthRequest(session),
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<{ customer: AdminCustomer; invite: AdminCustomerInvite | null }>(
      response,
      "Unable to create customer."
    );
  },

  async updateCustomer(session: AdminSession, customerId: string, payload: Partial<AdminCustomerPayload>) {
    const response = await fetch(apiPath(`/api/admin/customers/${encodeURIComponent(customerId)}`), {
      method: "PATCH",
      ...jsonAuthRequest(session),
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<{ customer: AdminCustomer }>(response, "Unable to update customer.");
  },

  async createInvite(session: AdminSession, customerId: string) {
    const response = await fetch(
      apiPath(`/api/admin/customers/${encodeURIComponent(customerId)}/invite`),
      {
        method: "POST",
        ...jsonAuthRequest(session),
        body: JSON.stringify({}),
      }
    );
    return parseJsonResponse<{ customer: AdminCustomer; invite: AdminCustomerInvite }>(
      response,
      "Unable to create invitation."
    );
  },
};
