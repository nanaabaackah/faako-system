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

export interface AdminProductCreatePayload extends AdminProductPatchPayload {
  name: string;
  publishingStatus?: "draft" | "active" | "archived";
  isFeatured?: boolean;
  quantityOnHand?: number | null;
  reservedQuantity?: number | null;
  lowStockThreshold?: number | null;
  reorderThreshold?: number | null;
  stockStatus?: string;
  supplierId?: string | null;
  inventoryTrackingEnabled?: boolean;
  allowBackorder?: boolean;
  isPurchasable?: boolean;
  notes?: string | null;
}

export interface AdminProductPublishingPayload {
  publishingStatus?: "draft" | "active" | "archived";
  isFeatured?: boolean;
}

export interface AdminProductBulkPayload {
  productIds: string[];
  action: "archive" | "delete" | "delete_listing" | "restore" | "activate" | "draft";
}

export interface AdminProductSupplierPayload {
  supplierId: string | null;
  supplierSku?: string | null;
  supplierProductCode?: string | null;
  notes?: string | null;
}

export const adminProductsApi = {
  async listProducts(session: AdminSession, filters: AdminProductFilters = {}) {
    void session;
    return stroaneApiClient.get<{ products: AdminProduct[]; categories: AdminProductCategory[] }>(
      withQuery("/api/admin/products", filters),
      { fallbackMessage: "Unable to load products." },
    );
  },

  async getProduct(session: AdminSession, id: string): Promise<AdminProduct> {
    void session;
    const data = await stroaneApiClient.get<{ product: AdminProduct }>(
      `/api/admin/products/${encodeURIComponent(id)}`,
      { fallbackMessage: "Unable to load product." },
    );
    return data.product;
  },

  async createProduct(
    session: AdminSession,
    payload: AdminProductCreatePayload
  ): Promise<AdminProduct> {
    void session;
    const data = await stroaneApiClient.post<{ product: AdminProduct }>(
      "/api/admin/products",
      { json: payload, fallbackMessage: "Unable to create product." },
    );
    return data.product;
  },

  async bulkUpdateProducts(
    session: AdminSession,
    payload: AdminProductBulkPayload
  ): Promise<{ products: AdminProduct[]; count: number; action: AdminProductBulkPayload["action"] }> {
    void session;
    return stroaneApiClient.patch<{
      products: AdminProduct[];
      count: number;
      action: AdminProductBulkPayload["action"];
    }>("/api/admin/products/bulk", {
      json: payload,
      fallbackMessage: "Unable to update selected products.",
    });
  },

  async updateProduct(
    session: AdminSession,
    id: string,
    payload: AdminProductPatchPayload
  ): Promise<AdminProduct> {
    void session;
    const data = await stroaneApiClient.patch<{ product: AdminProduct }>(
      `/api/admin/products/${encodeURIComponent(id)}`,
      { json: payload, fallbackMessage: "Unable to update product." },
    );
    return data.product;
  },

  async updateProductPublishing(
    session: AdminSession,
    id: string,
    payload: AdminProductPublishingPayload
  ): Promise<AdminProduct> {
    void session;
    const data = await stroaneApiClient.patch<{ product: AdminProduct }>(
      `/api/admin/products/${encodeURIComponent(id)}/publishing`,
      { json: payload, fallbackMessage: "Unable to update product publishing." },
    );
    return data.product;
  },

  async updateProductSupplier(
    session: AdminSession,
    id: string,
    payload: AdminProductSupplierPayload
  ): Promise<AdminProduct> {
    void session;
    const data = await stroaneApiClient.patch<{ product: AdminProduct }>(
      `/api/admin/products/${encodeURIComponent(id)}/suppliers`,
      { json: payload, fallbackMessage: "Unable to update product supplier." },
    );
    return data.product;
  },
};
