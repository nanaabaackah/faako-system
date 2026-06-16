import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  OFFLINE_CONFLICT_STATUSES,
  SYNC_STATES,
  cancelQueuedAction,
  markQueuedActionResolved,
  useOnlineStatus,
  useSyncQueueSummary,
  type OfflineQueueItem,
} from "@faako/offline-sync";
import {
  adminInventoryApi,
  type InventoryItemPatchPayload,
  type InventoryMovementPayload,
} from "../api/adminInventory";
import {
  adminProductsApi,
  type AdminProductPatchPayload,
  type AdminProductPublishingPayload,
} from "../api/adminProducts";
import { useAdminPortal } from "./AdminPortalContext";
import {
  STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
  STROANE_PORTAL_QUEUE_SOURCE_APP,
  createStroanePortalQueueStorage,
  notifyStroanePortalQueueChanged,
} from "../offline/portalOfflineQueue";
import {
  applyInventoryMovementLocally,
  applyInventoryPatchLocally,
  buildInventoryManagementSummary,
  EMPTY_ALERT_SUMMARY,
  matchesInventoryFilters,
  sortInventoryItems,
} from "../utils/inventoryUtils";
import type {
  AdminProduct,
  AdminProductCategory,
  InventoryAlertSummary,
  InventoryItem,
  InventoryManagementFilters,
  InventoryManagementSnapshot,
  InventoryManagementSummary,
  InventoryMovement,
  QueuedInventoryMovementPayload,
  QueuedInventoryUpdatePayload,
  QueuedProductUpdatePayload,
  SupplierSummary,
} from "../types/inventory";

const INVENTORY_CACHE_PREFIX = "stroane_inventory_management_cache_v1";

export const STROANE_INVENTORY_UPDATE_ACTION = "UPDATE_INVENTORY_ITEM";
export const STROANE_INVENTORY_MOVEMENT_ACTION = "CREATE_INVENTORY_MOVEMENT";
export const STROANE_PRODUCT_UPDATE_ACTION = "UPDATE_CATALOGUE_PRODUCT";

const INVENTORY_ACTION_TYPES = new Set([
  STROANE_INVENTORY_UPDATE_ACTION,
  STROANE_INVENTORY_MOVEMENT_ACTION,
  STROANE_PRODUCT_UPDATE_ACTION,
]);

const DEFAULT_FILTERS: InventoryManagementFilters = {
  search: "",
  status: "all",
  supplierId: "",
};

type InventoryQueueItem = OfflineQueueItem & {
  payload?: Record<string, unknown>;
};

interface InventoryManagementContextValue {
  inventory: InventoryItem[];
  filteredInventory: InventoryItem[];
  suppliers: SupplierSummary[];
  movements: InventoryMovement[];
  products: AdminProduct[];
  categories: AdminProductCategory[];
  alerts: InventoryAlertSummary;
  summary: InventoryManagementSummary;
  filters: InventoryManagementFilters;
  selectedItemId: string;
  selectedItem: InventoryItem | null;
  selectedProduct: AdminProduct | null;
  loading: boolean;
  refreshing: boolean;
  savingInventoryItem: boolean;
  recordingMovement: boolean;
  savingProduct: boolean;
  syncingQueueItemId: string;
  error: string;
  loadWarning: string;
  notice: string;
  cachedAt: string;
  isOnline: boolean;
  canManageInventory: boolean;
  queueCounts: ReturnType<typeof useSyncQueueSummary>["counts"];
  queueLoading: boolean;
  queueError: string;
  queueReviewItems: InventoryQueueItem[];
  setFilters: React.Dispatch<React.SetStateAction<InventoryManagementFilters>>;
  updateFilter: <Key extends keyof InventoryManagementFilters>(
    key: Key,
    value: InventoryManagementFilters[Key]
  ) => void;
  selectItem: (id: string) => void;
  refreshInventory: () => Promise<void>;
  saveInventoryItem: (
    item: InventoryItem,
    patch: InventoryItemPatchPayload
  ) => Promise<void>;
  recordInventoryMovement: (
    item: InventoryItem,
    payload: InventoryMovementPayload
  ) => Promise<void>;
  saveProductDetails: (
    productId: string,
    detailsPatch: AdminProductPatchPayload,
    publishingPatch?: AdminProductPublishingPayload
  ) => Promise<void>;
  retryQueueItem: (item: InventoryQueueItem) => Promise<void>;
  cancelQueueItem: (item: InventoryQueueItem) => Promise<void>;
  resolveQueueItem: (item: InventoryQueueItem) => Promise<void>;
  clearMessages: () => void;
}

const InventoryManagementContext =
  createContext<InventoryManagementContextValue | null>(null);

const getActorId = (username = "") => username.trim().toLowerCase();

const getCacheKey = (username = "") =>
  `${INVENTORY_CACHE_PREFIX}:${getActorId(username) || "anonymous"}`;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to complete inventory work.";

const isInventorySnapshot = (value: unknown): value is InventoryManagementSnapshot => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InventoryManagementSnapshot>;
  return (
    Array.isArray(candidate.inventory) &&
    Array.isArray(candidate.suppliers) &&
    Array.isArray(candidate.movements) &&
    Array.isArray(candidate.products) &&
    Array.isArray(candidate.categories) &&
    Boolean(candidate.alerts) &&
    typeof candidate.cachedAt === "string"
  );
};

const loadInventorySnapshot = (username = ""): InventoryManagementSnapshot | null => {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getCacheKey(username)) || "null");
    return isInventorySnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const saveInventorySnapshot = (
  username: string,
  snapshot: Omit<InventoryManagementSnapshot, "cachedAt">
) => {
  if (typeof window === "undefined") return null;
  const nextSnapshot = { ...snapshot, cachedAt: new Date().toISOString() };
  window.localStorage.setItem(getCacheKey(username), JSON.stringify(nextSnapshot));
  return nextSnapshot;
};

const isInventoryQueueAction = (item: OfflineQueueItem | undefined): item is InventoryQueueItem =>
  Boolean(item?.actionType && INVENTORY_ACTION_TYPES.has(item.actionType));

const hasPatchValues = (value?: object | null) =>
  Boolean(value && Object.keys(value).length);

const toProductPrice = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const InventoryManagementProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { session } = useAdminPortal();
  const isOnline = useOnlineStatus();
  const queueStorage = useMemo(() => createStroanePortalQueueStorage(), []);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminProductCategory[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlertSummary>(EMPTY_ALERT_SUMMARY);
  const [filters, setFilters] = useState<InventoryManagementFilters>(DEFAULT_FILTERS);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingInventoryItem, setSavingInventoryItem] = useState(false);
  const [recordingMovement, setRecordingMovement] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [syncingQueueItemId, setSyncingQueueItemId] = useState("");
  const [error, setError] = useState("");
  const [loadWarning, setLoadWarning] = useState("");
  const [notice, setNotice] = useState("");
  const [cachedAt, setCachedAt] = useState("");

  const {
    counts: queueCounts,
    error: queueError,
    loading: queueLoading,
    refresh: refreshQueue,
    reviewItems,
  } = useSyncQueueSummary({
    storage: queueStorage,
    sourceApp: STROANE_PORTAL_QUEUE_SOURCE_APP,
    organizationId: STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
    actorId: getActorId(session?.username || ""),
    enabled: Boolean(session),
    pollIntervalMs: 4000,
  });

  const canManageInventory = session?.role === "ADMIN";

  const applySnapshot = useCallback((snapshot: InventoryManagementSnapshot) => {
    setInventory(snapshot.inventory);
    setSuppliers(snapshot.suppliers);
    setMovements(snapshot.movements);
    setProducts(snapshot.products);
    setCategories(snapshot.categories);
    setAlerts(snapshot.alerts);
    setCachedAt(snapshot.cachedAt);
  }, []);

  const fetchInventoryFromServer = useCallback(
    async (options: { throwOnPartial?: boolean } = {}) => {
      if (!session) return;
      setLoadWarning("");

      const [inventoryResult, supplierResult, movementResult, alertResult, productResult] =
        await Promise.allSettled([
          adminInventoryApi.listInventory(session, { limit: 100 }),
          adminInventoryApi.listSuppliers(session),
          adminInventoryApi.listMovements(session, { limit: 40 }),
          adminInventoryApi.getAlertSummary(session),
          adminProductsApi.listProducts(session, { limit: 200 }),
        ]);

      const failedLoads = [
        inventoryResult,
        supplierResult,
        movementResult,
        alertResult,
        productResult,
      ].filter((result) => result.status === "rejected").length;

      if (failedLoads && options.throwOnPartial) {
        throw new Error(
          failedLoads === 5
            ? "Inventory data is temporarily unavailable."
            : "Some inventory data could not be refreshed."
        );
      }

      if (inventoryResult.status === "fulfilled") setInventory(inventoryResult.value);
      if (supplierResult.status === "fulfilled") setSuppliers(supplierResult.value);
      if (movementResult.status === "fulfilled") setMovements(movementResult.value);
      if (alertResult.status === "fulfilled") setAlerts(alertResult.value);
      if (productResult.status === "fulfilled") {
        setProducts(productResult.value.products);
        setCategories(productResult.value.categories);
      }

      if (failedLoads) {
        setLoadWarning(
          failedLoads === 5
            ? "Inventory data is temporarily unavailable. Check the API connection and try again."
            : "Some inventory data could not be refreshed. Available inventory data is shown below."
        );
        return;
      }

      if (
        inventoryResult.status !== "fulfilled" ||
        supplierResult.status !== "fulfilled" ||
        movementResult.status !== "fulfilled" ||
        alertResult.status !== "fulfilled" ||
        productResult.status !== "fulfilled"
      ) {
        return;
      }

      const snapshot = saveInventorySnapshot(session.username, {
        inventory: inventoryResult.value,
        suppliers: supplierResult.value,
        movements: movementResult.value,
        alerts: alertResult.value,
        products: productResult.value.products,
        categories: productResult.value.categories,
      });
      if (snapshot) setCachedAt(snapshot.cachedAt);
    },
    [session]
  );

  const refreshInventory = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    setError("");
    try {
      if (!isOnline) {
        setLoadWarning(
          "You're offline. Showing saved inventory data and queueing changes on this device."
        );
        setNotice("Refresh will use the server again when this device is back online.");
        return;
      }
      await fetchInventoryFromServer();
      await refreshQueue();
      setNotice("Inventory refreshed.");
    } catch (refreshError) {
      setError(getErrorMessage(refreshError));
    } finally {
      setRefreshing(false);
    }
  }, [fetchInventoryFromServer, isOnline, refreshQueue, session]);

  const applyInventoryItem = useCallback((item: InventoryItem) => {
    setInventory((current) => {
      const hasItem = current.some((candidate) => candidate.id === item.id);
      return hasItem
        ? current.map((candidate) => (candidate.id === item.id ? item : candidate))
        : [item, ...current];
    });
  }, []);

  const applyMovement = useCallback((movement: InventoryMovement) => {
    setMovements((current) => [
      movement,
      ...current.filter((candidate) => candidate.id !== movement.id),
    ].slice(0, 40));
  }, []);

  const applyProductPatchLocally = useCallback(
    (
      productId: string,
      detailsPatch: AdminProductPatchPayload = {},
      publishingPatch: AdminProductPublishingPayload = {}
    ) => {
      setProducts((current) =>
        current.map((product) => {
          if (product.id !== productId) return product;

          return {
            ...product,
            name: detailsPatch.name ?? product.name,
            shortDescription:
              detailsPatch.shortDescription === undefined
                ? product.shortDescription
                : detailsPatch.shortDescription,
            longDescription:
              detailsPatch.longDescription === undefined
                ? product.longDescription
                : detailsPatch.longDescription,
            sku: detailsPatch.sku === undefined ? product.sku : detailsPatch.sku,
            price:
              detailsPatch.price === undefined
                ? product.price
                : toProductPrice(detailsPatch.price),
            compareAtPrice:
              detailsPatch.compareAtPrice === undefined
                ? product.compareAtPrice
                : toProductPrice(detailsPatch.compareAtPrice),
            currency: detailsPatch.currency ?? product.currency,
            categorySlug:
              detailsPatch.categorySlug === undefined
                ? product.categorySlug
                : detailsPatch.categorySlug,
            tags: detailsPatch.tags ?? product.tags,
            publishingStatus: publishingPatch.publishingStatus || product.publishingStatus,
            isPublished:
              publishingPatch.publishingStatus === undefined
                ? product.isPublished
                : publishingPatch.publishingStatus === "active",
            isFeatured:
              publishingPatch.isFeatured === undefined
                ? product.isFeatured
                : publishingPatch.isFeatured,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      setInventory((current) =>
        current.map((item) =>
          item.product?.id === productId
            ? {
                ...item,
                product: {
                  ...item.product,
                  name: detailsPatch.name || item.product.name,
                  sku:
                    detailsPatch.sku === undefined
                      ? item.product.sku
                      : detailsPatch.sku,
                  price:
                    detailsPatch.price === undefined
                      ? item.product.price
                      : toProductPrice(detailsPatch.price),
                  currency: detailsPatch.currency || item.product.currency,
                  categorySlug:
                    detailsPatch.categorySlug === undefined
                      ? item.product.categorySlug
                      : detailsPatch.categorySlug,
                },
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
    },
    []
  );

  const processQueueItem = useCallback(
    async (item: InventoryQueueItem) => {
      if (!session || !isInventoryQueueAction(item)) return false;

      const now = new Date().toISOString();
      await queueStorage.updateStatus(item.id, SYNC_STATES.SYNCING, {
        lastAttemptAt: now,
        review: {
          lastError: "",
          syncStartedAt: now,
        },
      });

      try {
        if (item.actionType === STROANE_INVENTORY_UPDATE_ACTION) {
          const payload = item.payload as Partial<QueuedInventoryUpdatePayload> | undefined;
          const targetId = String(payload?.targetId || "");
          const patch = payload?.patch;
          if (!targetId || !patch) throw new Error("Queued inventory update is incomplete.");
          const inventoryItem = await adminInventoryApi.updateInventoryItem(
            session,
            targetId,
            patch
          );
          applyInventoryItem(inventoryItem);
        }

        if (item.actionType === STROANE_INVENTORY_MOVEMENT_ACTION) {
          const payload = item.payload as Partial<QueuedInventoryMovementPayload> | undefined;
          const movement = payload?.movement;
          if (!movement) throw new Error("Queued inventory movement is incomplete.");
          const result = await adminInventoryApi.createMovement(session, movement);
          applyInventoryItem(result.inventoryItem);
          applyMovement(result.movement);
        }

        if (item.actionType === STROANE_PRODUCT_UPDATE_ACTION) {
          const payload = item.payload as Partial<QueuedProductUpdatePayload> | undefined;
          const productId = String(payload?.targetId || "");
          const detailsPatch = payload?.detailsPatch;
          const publishingPatch = payload?.publishingPatch;
          if (!productId) throw new Error("Queued product update is incomplete.");

          let product: AdminProduct | null = null;
          if (hasPatchValues(detailsPatch)) {
            product = await adminProductsApi.updateProduct(session, productId, detailsPatch || {});
          }
          if (hasPatchValues(publishingPatch)) {
            product = await adminProductsApi.updateProductPublishing(
              session,
              productId,
              publishingPatch || {}
            );
          }
          if (product) {
            setProducts((current) =>
              current.map((candidate) => (candidate.id === product.id ? product : candidate))
            );
          }
        }

        await queueStorage.updateStatus(item.id, SYNC_STATES.SYNCED, {
          conflictStatus: OFFLINE_CONFLICT_STATUSES.NONE,
          retry: {
            ...(item.retry || {}),
            lastError: "",
          },
          review: {
            lastError: "",
            syncedAt: new Date().toISOString(),
            resolution: "Inventory work synced through the Stroane API.",
          },
        });
        notifyStroanePortalQueueChanged();
        return true;
      } catch (queueError) {
        const message = getErrorMessage(queueError);
        await queueStorage.updateStatus(item.id, SYNC_STATES.FAILED, {
          conflictStatus: OFFLINE_CONFLICT_STATUSES.NEEDS_REVIEW,
          retry: {
            ...(item.retry || {}),
            attempts: Number(item.retry?.attempts || 0) + 1,
            lastError: message,
          },
          review: {
            lastError: message,
          },
        });
        notifyStroanePortalQueueChanged();
        throw queueError;
      }
    },
    [applyInventoryItem, applyMovement, queueStorage, session]
  );

  const saveInventoryItem = useCallback(
    async (item: InventoryItem, patch: InventoryItemPatchPayload) => {
      if (!session) return;
      if (!canManageInventory) {
        setError("Only portal admins can update inventory.");
        return;
      }

      setSavingInventoryItem(true);
      setError("");
      setNotice("");

      try {
        if (!isOnline) {
          const optimisticItem = applyInventoryPatchLocally(item, patch, suppliers);
          applyInventoryItem(optimisticItem);
          await queueStorage.put({
            actionType: STROANE_INVENTORY_UPDATE_ACTION,
            sourceApp: STROANE_PORTAL_QUEUE_SOURCE_APP,
            organizationId: STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
            actorId: getActorId(session.username),
            status: SYNC_STATES.PENDING,
            payload: {
              targetType: "inventory-item",
              targetId: item.id,
              queuedAt: new Date().toISOString(),
              patch,
              metadata: {
                itemName: `Update ${item.product?.name || item.productSlug}`,
                productSlug: item.productSlug,
                queuedBy: session.username,
              },
            } satisfies QueuedInventoryUpdatePayload,
          });
          notifyStroanePortalQueueChanged();
          await refreshQueue();
          setNotice("Inventory update queued. The local stock view has been updated.");
          return;
        }

        const updatedItem = await adminInventoryApi.updateInventoryItem(session, item.id, patch);
        applyInventoryItem(updatedItem);
        setNotice("Inventory item saved.");
      } catch (saveError) {
        setError(getErrorMessage(saveError));
      } finally {
        setSavingInventoryItem(false);
      }
    },
    [
      applyInventoryItem,
      canManageInventory,
      isOnline,
      queueStorage,
      refreshQueue,
      session,
      suppliers,
    ]
  );

  const recordInventoryMovement = useCallback(
    async (item: InventoryItem, payload: InventoryMovementPayload) => {
      if (!session) return;
      if (!canManageInventory) {
        setError("Only portal admins can record inventory movements.");
        return;
      }

      setRecordingMovement(true);
      setError("");
      setNotice("");

      try {
        if (!isOnline) {
          const optimistic = applyInventoryMovementLocally(item, payload);
          applyInventoryItem(optimistic.item);
          applyMovement(optimistic.movement);
          await queueStorage.put({
            actionType: STROANE_INVENTORY_MOVEMENT_ACTION,
            sourceApp: STROANE_PORTAL_QUEUE_SOURCE_APP,
            organizationId: STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
            actorId: getActorId(session.username),
            status: SYNC_STATES.PENDING,
            payload: {
              targetType: "inventory-movement",
              targetId: item.id,
              queuedAt: new Date().toISOString(),
              movement: payload,
              metadata: {
                itemName: `Record ${payload.movementType.toLowerCase()} for ${
                  item.product?.name || item.productSlug
                }`,
                productSlug: item.productSlug,
                queuedBy: session.username,
              },
            } satisfies QueuedInventoryMovementPayload,
          });
          notifyStroanePortalQueueChanged();
          await refreshQueue();
          setNotice("Inventory movement queued and reflected locally.");
          return;
        }

        const result = await adminInventoryApi.createMovement(session, payload);
        applyInventoryItem(result.inventoryItem);
        applyMovement(result.movement);
        setNotice("Inventory movement recorded.");
      } catch (movementError) {
        setError(getErrorMessage(movementError));
      } finally {
        setRecordingMovement(false);
      }
    },
    [
      applyInventoryItem,
      applyMovement,
      canManageInventory,
      isOnline,
      queueStorage,
      refreshQueue,
      session,
    ]
  );

  const saveProductDetails = useCallback(
    async (
      productId: string,
      detailsPatch: AdminProductPatchPayload,
      publishingPatch: AdminProductPublishingPayload = {}
    ) => {
      if (!session || !productId) return;
      if (!canManageInventory) {
        setError("Only portal admins can update products.");
        return;
      }

      setSavingProduct(true);
      setError("");
      setNotice("");

      try {
        if (!isOnline) {
          applyProductPatchLocally(productId, detailsPatch, publishingPatch);
          const product = products.find((candidate) => candidate.id === productId);
          await queueStorage.put({
            actionType: STROANE_PRODUCT_UPDATE_ACTION,
            sourceApp: STROANE_PORTAL_QUEUE_SOURCE_APP,
            organizationId: STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
            actorId: getActorId(session.username),
            status: SYNC_STATES.PENDING,
            payload: {
              targetType: "catalogue-product",
              targetId: productId,
              queuedAt: new Date().toISOString(),
              detailsPatch,
              publishingPatch,
              metadata: {
                itemName: `Update ${product?.name || "catalogue product"}`,
                productSlug: product?.slug,
                queuedBy: session.username,
              },
            } satisfies QueuedProductUpdatePayload,
          });
          notifyStroanePortalQueueChanged();
          await refreshQueue();
          setNotice("Product update queued and reflected locally.");
          return;
        }

        let product: AdminProduct | null = null;
        if (hasPatchValues(detailsPatch)) {
          product = await adminProductsApi.updateProduct(session, productId, detailsPatch);
        }
        if (hasPatchValues(publishingPatch)) {
          product = await adminProductsApi.updateProductPublishing(
            session,
            productId,
            publishingPatch
          );
        }
        if (product) {
          setProducts((current) =>
            current.map((candidate) => (candidate.id === product?.id ? product : candidate))
          );
          await fetchInventoryFromServer();
        }
        setNotice("Product details saved.");
      } catch (productError) {
        setError(getErrorMessage(productError));
      } finally {
        setSavingProduct(false);
      }
    },
    [
      applyProductPatchLocally,
      canManageInventory,
      fetchInventoryFromServer,
      isOnline,
      products,
      queueStorage,
      refreshQueue,
      session,
    ]
  );

  const retryQueueItem = useCallback(
    async (item: InventoryQueueItem) => {
      setSyncingQueueItemId(item.id);
      setError("");
      try {
        await processQueueItem(item);
        await fetchInventoryFromServer();
        await refreshQueue();
        setNotice("Queued inventory work synced.");
      } catch (retryError) {
        setError(getErrorMessage(retryError));
      } finally {
        setSyncingQueueItemId("");
      }
    },
    [fetchInventoryFromServer, processQueueItem, refreshQueue]
  );

  const cancelQueueItem = useCallback(
    async (item: InventoryQueueItem) => {
      setSyncingQueueItemId(item.id);
      try {
        await cancelQueuedAction(queueStorage, item, {
          reason: "Cancelled from the Stroane inventory management module.",
        });
        notifyStroanePortalQueueChanged();
        await refreshQueue();
      } finally {
        setSyncingQueueItemId("");
      }
    },
    [queueStorage, refreshQueue]
  );

  const resolveQueueItem = useCallback(
    async (item: InventoryQueueItem) => {
      setSyncingQueueItemId(item.id);
      try {
        await markQueuedActionResolved(queueStorage, item, {
          resolution: "Marked resolved from the Stroane inventory management module.",
        });
        notifyStroanePortalQueueChanged();
        await refreshQueue();
      } finally {
        setSyncingQueueItemId("");
      }
    },
    [queueStorage, refreshQueue]
  );

  const updateFilter = useCallback(
    <Key extends keyof InventoryManagementFilters>(
      key: Key,
      value: InventoryManagementFilters[Key]
    ) => {
      setFilters((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const clearMessages = useCallback(() => {
    setError("");
    setNotice("");
    setLoadWarning("");
  }, []);

  useEffect(() => {
    if (!session) return;
    const snapshot = loadInventorySnapshot(session.username);
    if (snapshot) {
      applySnapshot(snapshot);
      if (!isOnline) {
        setLoadWarning(
          "You're offline. Showing saved inventory data and queueing changes on this device."
        );
      }
      return;
    }

    if (!isOnline) {
      setLoadWarning(
        "You're offline and this device has no saved inventory view yet. Connect once to cache it."
      );
    }
  }, [applySnapshot, isOnline, session]);

  useEffect(() => {
    if (!session || !isOnline) return;
    setLoading(true);
    void fetchInventoryFromServer().finally(() => setLoading(false));
  }, [fetchInventoryFromServer, isOnline, session]);

  useEffect(() => {
    if (!session || !isOnline) return;
    let cancelled = false;

    const syncPendingInventoryWork = async () => {
      const queueItems = await queueStorage.list();
      const pendingItems = queueItems.filter(
        (item) =>
          isInventoryQueueAction(item) &&
          [SYNC_STATES.PENDING, SYNC_STATES.RETRYING].includes(item.status)
      );

      let syncedCount = 0;
      for (const item of pendingItems) {
        if (cancelled) return;
        try {
          const synced = await processQueueItem(item);
          if (synced) syncedCount += 1;
        } catch {
          break;
        }
      }

      if (cancelled || !syncedCount) return;
      await fetchInventoryFromServer();
      await refreshQueue();
      setNotice(
        `${syncedCount} queued inventory action${syncedCount === 1 ? "" : "s"} synced.`
      );
    };

    void syncPendingInventoryWork();
    return () => {
      cancelled = true;
    };
  }, [
    fetchInventoryFromServer,
    isOnline,
    processQueueItem,
    queueStorage,
    refreshQueue,
    session,
  ]);

  useEffect(() => {
    if (!session) return;
    if (!inventory.length && !products.length && !suppliers.length) return;
    const snapshot = saveInventorySnapshot(session.username, {
      inventory,
      suppliers,
      movements,
      products,
      categories,
      alerts,
    });
    if (snapshot) setCachedAt(snapshot.cachedAt);
  }, [alerts, categories, inventory, movements, products, session, suppliers]);

  useEffect(() => {
    if (!inventory.length) {
      setSelectedItemId("");
      return;
    }
    if (!selectedItemId || !inventory.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(sortInventoryItems(inventory)[0]?.id || "");
    }
  }, [inventory, selectedItemId]);

  const filteredInventory = useMemo(
    () => sortInventoryItems(inventory.filter((item) => matchesInventoryFilters(item, filters))),
    [filters, inventory]
  );

  const selectedItem = useMemo(
    () => inventory.find((item) => item.id === selectedItemId) || null,
    [inventory, selectedItemId]
  );

  const selectedProduct = useMemo(() => {
    if (!selectedItem) return null;
    return (
      products.find((product) => product.id === selectedItem.productId) ||
      products.find((product) => product.slug === selectedItem.productSlug) ||
      null
    );
  }, [products, selectedItem]);

  const summary = useMemo(
    () => buildInventoryManagementSummary(inventory, products),
    [inventory, products]
  );

  const queueReviewItems = useMemo(
    () => reviewItems.filter(isInventoryQueueAction) as InventoryQueueItem[],
    [reviewItems]
  );

  const value = useMemo<InventoryManagementContextValue>(
    () => ({
      inventory,
      filteredInventory,
      suppliers,
      movements,
      products,
      categories,
      alerts,
      summary,
      filters,
      selectedItemId,
      selectedItem,
      selectedProduct,
      loading,
      refreshing,
      savingInventoryItem,
      recordingMovement,
      savingProduct,
      syncingQueueItemId,
      error,
      loadWarning,
      notice,
      cachedAt,
      isOnline,
      canManageInventory,
      queueCounts,
      queueLoading,
      queueError,
      queueReviewItems,
      setFilters,
      updateFilter,
      selectItem: setSelectedItemId,
      refreshInventory,
      saveInventoryItem,
      recordInventoryMovement,
      saveProductDetails,
      retryQueueItem,
      cancelQueueItem,
      resolveQueueItem,
      clearMessages,
    }),
    [
      alerts,
      cachedAt,
      canManageInventory,
      cancelQueueItem,
      categories,
      clearMessages,
      error,
      filteredInventory,
      filters,
      inventory,
      isOnline,
      loadWarning,
      loading,
      movements,
      notice,
      products,
      queueCounts,
      queueError,
      queueLoading,
      queueReviewItems,
      recordInventoryMovement,
      refreshInventory,
      refreshing,
      resolveQueueItem,
      retryQueueItem,
      saveInventoryItem,
      saveProductDetails,
      savingInventoryItem,
      savingProduct,
      recordingMovement,
      selectedItem,
      selectedItemId,
      selectedProduct,
      suppliers,
      summary,
      syncingQueueItemId,
      updateFilter,
    ]
  );

  return (
    <InventoryManagementContext.Provider value={value}>
      {children}
    </InventoryManagementContext.Provider>
  );
};

export const useInventoryManagement = () => {
  const context = useContext(InventoryManagementContext);
  if (!context) {
    throw new Error("useInventoryManagement must be used inside InventoryManagementProvider.");
  }
  return context;
};
