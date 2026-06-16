import type { AdminSession } from "./adminSession";
import { apiPath } from "../../api/config";

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

const authHeaders = (session: AdminSession) => ({
  Authorization: `Bearer ${session.token}`,
});

const jsonAuthHeaders = (session: AdminSession) => ({
  ...authHeaders(session),
  "Content-Type": "application/json",
});

const withQuery = (path: string, filters: object = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return apiPath(`${path}${query ? `?${query}` : ""}`);
};

export interface AdminProductCategory {
  slug: string;
  name: string;
}

export interface AdminProductSupplierLink {
  id: string;
  supplierId: string;
  supplierSku?: string | null;
  supplierProductName?: string | null;
  isPreferred: boolean;
  notes?: string | null;
  supplier?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  sku?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  price?: number | null;
  compareAtPrice?: number | null;
  currency: string;
  categorySlug?: string | null;
  category?: AdminProductCategory | null;
  tags: string[];
  thumbnailImage?: string | null;
  galleryImages: string[];
  publishingStatus: "draft" | "active" | "archived";
  isPublished: boolean;
  isFeatured: boolean;
  stock: {
    inventoryItemId?: string | null;
    quantityOnHand?: number | null;
    reservedQuantity?: number | null;
    availableQuantity?: number | null;
    reorderThreshold?: number | null;
    lowStockThreshold?: number | null;
    stockStatus: string;
    isLowStock: boolean;
    isOutOfStock: boolean;
    updatedAt?: string | null;
  };
  supplierLinks: AdminProductSupplierLink[];
  preferredSupplier?: AdminProductSupplierLink | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminProductFilters {
  search?: string;
  publishingStatus?: string;
  categorySlug?: string;
  tag?: string;
  limit?: number;
}

export interface AdminProductPatchPayload {
  name?: string;
  slug?: string;
  shortDescription?: string | null;
  longDescription?: string | null;
  sku?: string | null;
  price?: number | string | null;
  compareAtPrice?: number | string | null;
  currency?: string;
  categorySlug?: string | null;
  tags?: string[];
}

export interface AdminProductPublishingPayload {
  publishingStatus?: "draft" | "active" | "archived";
  isFeatured?: boolean;
}

export interface AdminProductSupplierPayload {
  supplierId: string | null;
  supplierSku?: string | null;
  supplierProductCode?: string | null;
  notes?: string | null;
}

export const adminProductsApi = {
  async listProducts(session: AdminSession, filters: AdminProductFilters = {}) {
    const response = await fetch(withQuery("/api/admin/products", filters), {
      headers: authHeaders(session),
    });
    return parseJsonResponse<{ products: AdminProduct[]; categories: AdminProductCategory[] }>(
      response,
      "Unable to load products."
    );
  },

  async getProduct(session: AdminSession, id: string): Promise<AdminProduct> {
    const response = await fetch(apiPath(`/api/admin/products/${encodeURIComponent(id)}`), {
      headers: authHeaders(session),
    });
    const data = await parseJsonResponse<{ product: AdminProduct }>(
      response,
      "Unable to load product."
    );
    return data.product;
  },

  async updateProduct(
    session: AdminSession,
    id: string,
    payload: AdminProductPatchPayload
  ): Promise<AdminProduct> {
    const response = await fetch(apiPath(`/api/admin/products/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: jsonAuthHeaders(session),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse<{ product: AdminProduct }>(
      response,
      "Unable to update product."
    );
    return data.product;
  },

  async updateProductPublishing(
    session: AdminSession,
    id: string,
    payload: AdminProductPublishingPayload
  ): Promise<AdminProduct> {
    const response = await fetch(apiPath(`/api/admin/products/${encodeURIComponent(id)}/publishing`), {
      method: "PATCH",
      headers: jsonAuthHeaders(session),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse<{ product: AdminProduct }>(
      response,
      "Unable to update product publishing."
    );
    return data.product;
  },

  async updateProductSupplier(
    session: AdminSession,
    id: string,
    payload: AdminProductSupplierPayload
  ): Promise<AdminProduct> {
    const response = await fetch(apiPath(`/api/admin/products/${encodeURIComponent(id)}/suppliers`), {
      method: "PATCH",
      headers: jsonAuthHeaders(session),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse<{ product: AdminProduct }>(
      response,
      "Unable to update product supplier."
    );
    return data.product;
  },
};
