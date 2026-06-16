import type {
  InventoryAlertSummary,
  InventoryItem,
  InventoryItemPatchPayload,
  InventoryMovement,
  InventoryMovementPayload,
  SupplierSummary,
} from "../api/adminInventory";
import type {
  AdminProduct,
  AdminProductCategory,
  AdminProductPatchPayload,
  AdminProductPublishingPayload,
} from "../api/adminProducts";

export type {
  AdminProduct,
  AdminProductCategory,
  AdminProductPatchPayload,
  AdminProductPublishingPayload,
  InventoryAlertSummary,
  InventoryItem,
  InventoryItemPatchPayload,
  InventoryMovement,
  InventoryMovementPayload,
  SupplierSummary,
};

export type InventoryStockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "preorder"
  | "unavailable"
  | "manual_review";

export type InventoryStatusFilter =
  | "all"
  | InventoryStockStatus
  | "attention"
  | "unconfirmed";

export type InventoryMovementType =
  | "RESTOCK"
  | "ADJUSTMENT"
  | "DAMAGE"
  | "MANUAL_CORRECTION"
  | "RESERVED"
  | "RELEASED";

export interface InventoryManagementFilters {
  search: string;
  status: InventoryStatusFilter;
  supplierId: string;
}

export interface InventoryManagementSummary {
  totalItems: number;
  trackedItems: number;
  availableUnits: number;
  reservedUnits: number;
  lowStockItems: number;
  outOfStockItems: number;
  manualReviewItems: number;
  unconfirmedItems: number;
  supplierLinkedItems: number;
  productLinkedItems: number;
  activeProducts: number;
  draftProducts: number;
  archivedProducts: number;
  supplierCoveragePercent: number;
  countedPercent: number;
}

export interface InventoryEditDraft {
  quantityOnHand: string;
  reservedQuantity: string;
  lowStockThreshold: string;
  reorderThreshold: string;
  stockStatus: InventoryStockStatus;
  supplierId: string;
  sku: string;
  notes: string;
  inventoryTrackingEnabled: boolean;
  allowBackorder: boolean;
  isPurchasable: boolean;
  lastCountedAt: string;
}

export interface InventoryMovementDraft {
  movementType: InventoryMovementType;
  quantityDelta: string;
  quantityAfter: string;
  reason: string;
  supplierNote: string;
  purchaseNote: string;
}

export interface InventoryProductDraft {
  name: string;
  sku: string;
  price: string;
  currency: string;
  categorySlug: string;
  publishingStatus: "draft" | "active" | "archived";
  isFeatured: boolean;
  shortDescription: string;
}

export interface InventoryManagementSnapshot {
  inventory: InventoryItem[];
  suppliers: SupplierSummary[];
  movements: InventoryMovement[];
  products: AdminProduct[];
  categories: AdminProductCategory[];
  alerts: InventoryAlertSummary;
  cachedAt: string;
}

export interface QueuedInventoryUpdatePayload {
  targetType: "inventory-item";
  targetId: string;
  queuedAt: string;
  patch: InventoryItemPatchPayload;
  metadata: {
    itemName: string;
    productSlug?: string;
    queuedBy?: string;
  };
}

export interface QueuedInventoryMovementPayload {
  targetType: "inventory-movement";
  targetId: string;
  queuedAt: string;
  movement: InventoryMovementPayload;
  metadata: {
    itemName: string;
    productSlug?: string;
    queuedBy?: string;
  };
}

export interface QueuedProductUpdatePayload {
  targetType: "catalogue-product";
  targetId: string;
  queuedAt: string;
  detailsPatch?: AdminProductPatchPayload;
  publishingPatch?: AdminProductPublishingPayload;
  metadata: {
    itemName: string;
    productSlug?: string;
    queuedBy?: string;
  };
}
