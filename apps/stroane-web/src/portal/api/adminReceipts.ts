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

export interface AdminReceiptItem {
  id: string;
  productSlug: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  currency: string;
}

export interface AdminReceipt {
  id: string;
  receiptNumber: string;
  status: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  currency: string;
  subtotal: number;
  total: number;
  paymentReference?: string;
  paymentStatus?: string;
  issuedAt?: string;
  sentAt?: string;
  downloadedAt?: string;
  resendStatus?: string;
  resendProviderId?: string;
  resendError?: string;
  notes?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    deliveryMethod?: string;
    customer: {
      name: string;
      email: string;
      phone: string;
      deliveryAddress: string;
    };
    items: AdminReceiptItem[];
  } | null;
}

export interface AdminReceiptSummary {
  totalReceipts: number;
  issuedReceipts: number;
  sentReceipts: number;
  downloadedReceipts: number;
  totalValue: number;
}

export interface AdminReceiptFilters {
  search?: string;
  status?: string;
  limit?: number;
}

export interface AdminReceiptCreatePayload {
  orderId: string;
  notes?: string;
}

export const adminReceiptsApi = {
  async listReceipts(session: AdminSession, filters: AdminReceiptFilters = {}) {
    const response = await fetch(withQuery("/api/admin/receipts", filters), {
      ...authRequest(session),
    });
    return parseJsonResponse<{ receipts: AdminReceipt[]; summary: AdminReceiptSummary }>(
      response,
      "Unable to load receipts."
    );
  },

  async createReceipt(session: AdminSession, payload: AdminReceiptCreatePayload) {
    const response = await fetch(apiPath("/api/admin/receipts"), {
      method: "POST",
      ...jsonAuthRequest(session),
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<{ receipt: AdminReceipt }>(response, "Unable to create receipt.");
  },

  async resendReceipt(session: AdminSession, receiptId: string) {
    const response = await fetch(
      apiPath(`/api/admin/receipts/${encodeURIComponent(receiptId)}/resend`),
      {
        method: "POST",
        ...jsonAuthRequest(session),
        body: JSON.stringify({}),
      }
    );
    return parseJsonResponse<{
      receipt: AdminReceipt;
      notification: { status: string; sent: boolean; reason?: string };
    }>(response, "Unable to resend receipt.");
  },

  async downloadReceipt(session: AdminSession, receiptId: string) {
    const response = await fetch(
      apiPath(`/api/admin/receipts/${encodeURIComponent(receiptId)}/download`),
      {
        ...authRequest(session),
      }
    );
    const body = await response.text();
    if (!response.ok) {
      throw new Error(body || "Unable to download receipt.");
    }
    return body;
  },
};
