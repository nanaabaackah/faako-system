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
    void session;
    return stroaneApiClient.get<{
      customers: AdminCustomer[];
      summary: AdminCustomerSummary;
    }>(withQuery("/api/admin/customers", filters), {
      fallbackMessage: "Unable to load customers.",
    });
  },

  async createCustomer(session: AdminSession, payload: AdminCustomerPayload) {
    void session;
    return stroaneApiClient.post<{
      customer: AdminCustomer;
      invite: AdminCustomerInvite | null;
    }>("/api/admin/customers", {
      json: payload,
      fallbackMessage: "Unable to create customer.",
    });
  },

  async updateCustomer(
    session: AdminSession,
    customerId: string,
    payload: Partial<AdminCustomerPayload>
  ) {
    void session;
    return stroaneApiClient.patch<{ customer: AdminCustomer }>(
      `/api/admin/customers/${encodeURIComponent(customerId)}`,
      {
        json: payload,
        fallbackMessage: "Unable to update customer.",
      }
    );
  },

  async createInvite(session: AdminSession, customerId: string) {
    void session;
    return stroaneApiClient.post<{
      customer: AdminCustomer;
      invite: AdminCustomerInvite;
    }>(`/api/admin/customers/${encodeURIComponent(customerId)}/invite`,
      {
        json: {},
        fallbackMessage: "Unable to create invitation.",
      }
    );
  },
};
