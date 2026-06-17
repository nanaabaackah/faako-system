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

export interface SupplierSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  location?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  contactCount?: number;
  productCount?: number;
  inventoryItemCount?: number;
}

export interface InventoryItem {
  id: string;
  productId?: string | null;
  productSlug: string;
  variantId?: string | null;
  sku?: string | null;
  supplierId?: string | null;
  quantityOnHand?: number | null;
  reservedQuantity: number;
  availableQuantity?: number | null;
  storedAvailableQuantity?: number | null;
  reorderThreshold?: number | null;
  lowStockThreshold?: number | null;
  stockStatus: string;
  computedStockStatus: string;
  inventoryTrackingEnabled: boolean;
  allowBackorder?: boolean | null;
  isPurchasable?: boolean | null;
  isLowStock: boolean;
  needsReorder: boolean;
  lastCountedAt?: string | null;
  lastRestockedAt?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  product?: {
    id: string;
    slug: string;
    name: string;
    sku?: string | null;
    categorySlug?: string | null;
    price?: number | null;
    currency?: string | null;
    stockStatus?: string | null;
    stockQuantity?: number | null;
    availableQuantity?: number | null;
    reservedQuantity?: number | null;
    lowStockThreshold?: number | null;
    reorderThreshold?: number | null;
    isPurchasable?: boolean | null;
    allowBackorder?: boolean | null;
  } | null;
  supplier?: SupplierSummary | null;
}

export interface InventoryMovement {
  id: string;
  inventoryItemId?: string | null;
  productSlug: string;
  variantId?: string | null;
  supplierId?: string | null;
  movementType: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  reservedBefore?: number | null;
  reservedAfter?: number | null;
  reason?: string | null;
  supplierNote?: string | null;
  purchaseNote?: string | null;
  supplier?: SupplierSummary | null;
  createdByName?: string | null;
  createdAt?: string | null;
}

export interface InventoryFilters {
  search?: string;
  status?: string;
  supplierId?: string;
  limit?: number;
}

export interface InventoryMovementFilters {
  productSlug?: string;
  movementType?: string;
  supplierId?: string;
  limit?: number;
}

export interface InventoryItemPatchPayload {
  quantityOnHand?: number | null;
  stockQuantity?: number | null;
  reservedQuantity?: number | null;
  reorderThreshold?: number | null;
  lowStockThreshold?: number | null;
  stockStatus?: string;
  inventoryTrackingEnabled?: boolean | null;
  allowBackorder?: boolean | null;
  isPurchasable?: boolean | null;
  supplierId?: string | null;
  sku?: string | null;
  notes?: string | null;
  lastCountedAt?: string | null;
}

export interface InventoryMovementPayload {
  inventoryItemId?: string | null;
  productSlug?: string;
  variantId?: string | null;
  supplierId?: string | null;
  movementType: string;
  quantityDelta: number;
  quantityAfter?: number;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  supplierNote?: string | null;
  purchaseNote?: string | null;
}

export interface InventoryAlert {
  id: string;
  alertType: "LOW_STOCK" | "OUT_OF_STOCK" | "RESTOCKED";
  status: string;
  reason?: string | null;
  productSlug?: string | null;
  productName?: string | null;
  sku?: string | null;
  availableQuantity?: number | null;
  reservedQuantity?: number | null;
  reorderThreshold?: number | null;
  firstDetectedAt?: string | null;
  lastDetectedAt?: string | null;
  lastNotificationAttemptAt?: string | null;
  lastNotifiedAt?: string | null;
  notificationCount: number;
}

export interface InventoryAlertSummary {
  active: InventoryAlert[];
  recentDispatches: Array<{
    id: string;
    batchKey: string;
    trigger: string;
    alertType: string;
    channel: string;
    status: string;
    recipientCount: number;
    createdAt?: string | null;
  }>;
  counts: {
    lowStock: number;
    outOfStock: number;
    total: number;
  };
}

export const adminInventoryApi = {
  async listInventory(
    session: AdminSession,
    filters: InventoryFilters = {}
  ): Promise<InventoryItem[]> {
    const response = await fetch(withQuery("/api/admin/inventory", filters), {
      ...authRequest(session),
    });
    const data = await parseJsonResponse<{ inventory: InventoryItem[] }>(
      response,
      "Unable to load inventory."
    );
    return data.inventory;
  },

  async listSuppliers(session: AdminSession): Promise<SupplierSummary[]> {
    const response = await fetch(withQuery("/api/admin/suppliers", { limit: 100 }), {
      ...authRequest(session),
    });
    const data = await parseJsonResponse<{ suppliers: SupplierSummary[] }>(
      response,
      "Unable to load suppliers."
    );
    return data.suppliers;
  },

  async listMovements(
    session: AdminSession,
    filters: InventoryMovementFilters = {}
  ): Promise<InventoryMovement[]> {
    const response = await fetch(withQuery("/api/admin/inventory/movements", filters), {
      ...authRequest(session),
    });
    const data = await parseJsonResponse<{ movements: InventoryMovement[] }>(
      response,
      "Unable to load inventory activity."
    );
    return data.movements;
  },

  async getInventoryItem(session: AdminSession, id: string): Promise<InventoryItem> {
    const response = await fetch(apiPath(`/api/admin/inventory/${encodeURIComponent(id)}`), {
      ...authRequest(session),
    });
    const data = await parseJsonResponse<{ inventoryItem: InventoryItem }>(
      response,
      "Unable to load inventory item."
    );
    return data.inventoryItem;
  },

  async updateInventoryItem(
    session: AdminSession,
    id: string,
    payload: InventoryItemPatchPayload
  ): Promise<InventoryItem> {
    const response = await fetch(apiPath(`/api/admin/inventory/${encodeURIComponent(id)}`), {
      method: "PATCH",
      ...jsonAuthRequest(session),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse<{ inventoryItem: InventoryItem }>(
      response,
      "Unable to update inventory item."
    );
    return data.inventoryItem;
  },

  async createMovement(
    session: AdminSession,
    payload: InventoryMovementPayload
  ): Promise<{ inventoryItem: InventoryItem; movement: InventoryMovement }> {
    const response = await fetch(apiPath("/api/admin/inventory/movements"), {
      method: "POST",
      ...jsonAuthRequest(session),
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<{ inventoryItem: InventoryItem; movement: InventoryMovement }>(
      response,
      "Unable to record inventory movement."
    );
  },

  async getAlertSummary(session: AdminSession): Promise<InventoryAlertSummary> {
    const response = await fetch(apiPath("/api/admin/inventory/alerts"), {
      ...authRequest(session),
    });
    const data = await parseJsonResponse<{ summary: InventoryAlertSummary }>(
      response,
      "Unable to load inventory alerts."
    );
    return data.summary;
  },
};
