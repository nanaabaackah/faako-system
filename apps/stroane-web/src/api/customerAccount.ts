import { apiPath } from "./config";
import type { CheckoutOrderResponse } from "./orders";

const CUSTOMER_CLIENT_HEADER = { "X-Stroane-Client": "storefront" };

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

export type CustomerContactMethod = "email" | "phone" | "whatsapp";

export interface CustomerProfile {
  id: string;
  email: string;
  status: "invited" | "active" | "locked";
  name: string;
  phone?: string;
  businessName?: string;
  preferredContactMethod?: CustomerContactMethod;
  defaultDeliveryAddress?: string;
  deliveryNotes?: string;
  invitedAt?: string;
  inviteExpiresAt?: string;
  activatedAt?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerSignupPayload {
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  preferredContactMethod?: CustomerContactMethod;
  defaultDeliveryAddress?: string;
  deliveryNotes?: string;
  password: string;
  inviteToken?: string;
  paymentReference?: string;
}

export interface CustomerLoginPayload {
  email: string;
  password: string;
}

export interface CustomerPasswordResetRequestPayload {
  email: string;
}

export interface CustomerPasswordResetPayload {
  token: string;
  password: string;
}

export interface CustomerProfileUpdatePayload {
  name: string;
  phone?: string;
  businessName?: string;
  preferredContactMethod?: CustomerContactMethod;
  defaultDeliveryAddress?: string;
  deliveryNotes?: string;
}

export type CustomerOrder = CheckoutOrderResponse["order"];

const customerJsonRequest = (payload: unknown): RequestInit => ({
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    ...CUSTOMER_CLIENT_HEADER,
  },
  body: JSON.stringify(payload),
});

export const customerAccountApi = {
  async signup(payload: CustomerSignupPayload): Promise<CustomerProfile> {
    const response = await fetch(apiPath("/api/customer/signup"), customerJsonRequest(payload));
    const data = await parseJsonResponse<{ ok: boolean; customer: CustomerProfile }>(
      response,
      "Unable to create your customer profile."
    );
    return data.customer;
  },

  async login(payload: CustomerLoginPayload): Promise<CustomerProfile> {
    const response = await fetch(apiPath("/api/customer/login"), customerJsonRequest(payload));
    const data = await parseJsonResponse<{ ok: boolean; customer: CustomerProfile }>(
      response,
      "Unable to sign in."
    );
    return data.customer;
  },

  async requestPasswordReset(payload: CustomerPasswordResetRequestPayload): Promise<string> {
    const response = await fetch(
      apiPath("/api/customer/password/forgot"),
      customerJsonRequest(payload)
    );
    const data = await parseJsonResponse<{ ok: boolean; message?: string }>(
      response,
      "Unable to request a password reset."
    );
    return data.message || "If that email belongs to a Stroane account, a reset link will be sent.";
  },

  async resetPassword(payload: CustomerPasswordResetPayload): Promise<CustomerProfile> {
    const response = await fetch(
      apiPath("/api/customer/password/reset"),
      customerJsonRequest(payload)
    );
    const data = await parseJsonResponse<{ ok: boolean; customer: CustomerProfile }>(
      response,
      "Unable to reset your password."
    );
    return data.customer;
  },

  async logout(): Promise<void> {
    await fetch(apiPath("/api/customer/logout"), {
      method: "POST",
      credentials: "include",
      headers: CUSTOMER_CLIENT_HEADER,
    }).catch(() => undefined);
  },

  async getCurrent(): Promise<CustomerProfile> {
    const response = await fetch(apiPath("/api/customer/me"), {
      credentials: "include",
    });
    const data = await parseJsonResponse<{ ok: boolean; customer: CustomerProfile }>(
      response,
      "Sign in to continue."
    );
    return data.customer;
  },

  async updateProfile(payload: CustomerProfileUpdatePayload): Promise<CustomerProfile> {
    const response = await fetch(apiPath("/api/customer/me"), {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...CUSTOMER_CLIENT_HEADER,
      },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse<{ ok: boolean; customer: CustomerProfile }>(
      response,
      "Unable to update your profile."
    );
    return data.customer;
  },

  async listOrders(): Promise<CustomerOrder[]> {
    const response = await fetch(apiPath("/api/customer/orders"), {
      credentials: "include",
    });
    const data = await parseJsonResponse<{ ok: boolean; orders: CustomerOrder[] }>(
      response,
      "Unable to load your orders."
    );
    return data.orders;
  },
};
