import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineArchive,
  HiOutlineBell,
  HiOutlineCheckCircle,
  HiOutlineClipboardList,
  HiOutlineCube,
  HiOutlineExclamation,
  HiOutlineLockClosed,
  HiOutlineOfficeBuilding,
  HiOutlineRefresh,
  HiOutlineShoppingBag,
  HiOutlineXCircle,
} from "react-icons/hi";
import { Link } from "react-router-dom";
import {
  ERPFormNotice,
  ERPSecondaryAction,
  ERPStatusBadge,
} from "@faako/ui";
import {
  SYNC_STATES,
  SYNC_STATE_LABELS,
  cancelQueuedAction,
  getQueueActionLabel,
  getQueueItemDisplayMeta,
  isQueueItemConflictLike,
  markQueuedActionResolved,
  useOnlineStatus,
  useSyncQueueSummary,
} from "@faako/offline-sync";
import {
  adminInventoryApi,
  type InventoryAlertSummary,
  type InventoryItem,
  type InventoryMovement,
  type SupplierSummary,
} from "../../api/adminInventory";
import { adminProductsApi, type AdminProduct } from "../../api/adminProducts";
import { getAdminSalutationName } from "../../api/adminSession";
import { portalUrl } from "../../config/appSurface";
import { useAdminPortal } from "../../context/AdminPortalContext";
import useSEOMeta from "../../hooks/useSEOMeta";
import {
  type PortalOverviewSnapshot,
  loadPortalOverviewSnapshot,
  savePortalOverviewSnapshot,
} from "../../offline/portalOverviewCache";
import {
  STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
  STROANE_PORTAL_QUEUE_SOURCE_APP,
  createStroanePortalQueueStorage,
  notifyStroanePortalQueueChanged,
  processPendingPortalOverviewRefreshes,
  processQueuedPortalOverviewRefresh,
  queuePortalOverviewRefresh,
} from "../../offline/portalOfflineQueue";
import "../../styles/pages/AdminPortal.css";

const EMPTY_ALERT_SUMMARY: InventoryAlertSummary = {
  active: [],
  recentDispatches: [],
  counts: {
    lowStock: 0,
    outOfStock: 0,
    total: 0,
  },
};

const formatLabel = (value = "") =>
  value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const STOCK_STATUS_LABELS: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  preorder: "Preorder",
  unavailable: "Unavailable",
  manual_review: "Manual review",
};

const formatStockStatusLabel = (status = "") =>
  STOCK_STATUS_LABELS[status] || formatLabel(status);

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getProductName = (item: InventoryItem) => item.product?.name || formatLabel(item.productSlug);

const toInventoryQuantity = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : null;

const getInventoryAvailableQuantity = (item: InventoryItem) => {
  const itemAvailableQuantity = toInventoryQuantity(item.availableQuantity);
  if (itemAvailableQuantity !== null) return itemAvailableQuantity;

  const quantityOnHand = toInventoryQuantity(item.quantityOnHand);
  if (quantityOnHand !== null) {
    return Math.max(0, quantityOnHand - (toInventoryQuantity(item.reservedQuantity) ?? 0));
  }

  const productAvailableQuantity = toInventoryQuantity(item.product?.availableQuantity);
  if (productAvailableQuantity !== null) return productAvailableQuantity;

  const productStockQuantity = toInventoryQuantity(item.product?.stockQuantity);
  if (productStockQuantity !== null) {
    return Math.max(
      0,
      productStockQuantity - (toInventoryQuantity(item.product?.reservedQuantity) ?? 0)
    );
  }

  return null;
};

const getInventoryStockStatus = (item: InventoryItem) => {
  const availableQuantity = getInventoryAvailableQuantity(item);
  const status = item.computedStockStatus || item.stockStatus || item.product?.stockStatus || "unavailable";

  if (status === "preorder" || status === "manual_review") return status;
  if (availableQuantity !== null && availableQuantity <= 0) return "out_of_stock";

  if (availableQuantity !== null && status === "unavailable") {
    const threshold =
      toInventoryQuantity(item.lowStockThreshold) ??
      toInventoryQuantity(item.product?.lowStockThreshold);
    return threshold !== null && availableQuantity <= threshold ? "low_stock" : "in_stock";
  }

  return status;
};

const getStockTone = (item: InventoryItem) => {
  const stockStatus = getInventoryStockStatus(item);
  if (stockStatus === "out_of_stock") return "danger";
  if (stockStatus === "low_stock" || item.isLowStock || item.needsReorder) return "warning";
  return "neutral";
};

const isAttentionItem = (item: InventoryItem) =>
  item.isLowStock ||
  item.needsReorder ||
  ["out_of_stock", "unavailable", "manual_review"].includes(getInventoryStockStatus(item));

const calculatePercentage = (value: number, total: number) =>
  total ? Math.round((value / total) * 100) : 0;

type StockAttentionFilter = "all" | "out_of_stock" | "low_stock" | "unconfirmed";

const matchesStockAttentionFilter = (item: InventoryItem, filter: StockAttentionFilter) => {
  const stockStatus = getInventoryStockStatus(item);
  const availableQuantity = getInventoryAvailableQuantity(item);

  if (filter === "all") return true;
  if (filter === "out_of_stock") return stockStatus === "out_of_stock";
  if (filter === "unconfirmed") {
    return availableQuantity === null || ["unavailable", "manual_review"].includes(stockStatus);
  }
  return (
    stockStatus !== "out_of_stock" &&
    (stockStatus === "low_stock" || item.isLowStock || item.needsReorder)
  );
};

type PortalQueueItem = {
  id: string;
  actionType: string;
  sourceApp: string;
  organizationId: string;
  actorId: string;
  status: string;
  conflictStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  lastError?: string;
  payload?: {
    targetType?: string;
    targetId?: string;
    queuedAt?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  retry?: {
    attempts?: number;
    lastError?: string;
    [key: string]: unknown;
  };
  review?: {
    lastError?: string;
    [key: string]: unknown;
  };
};

type QueueDisplayMeta = {
  title?: string;
  targetType?: string;
  targetId?: string;
  queuedAt?: string;
  lastError?: string;
};

type DashboardLinkItem = {
  label: string;
  detail: string;
  value: number | string;
  tone: string;
  icon: React.ReactNode;
  to?: string;
  href?: string;
};

const getPortalQueueStatusLabel = (status = "") =>
  SYNC_STATE_LABELS[status] || formatLabel(status || "queued");

const getPortalQueueActionLabel = (item: PortalQueueItem) =>
  formatLabel(getQueueActionLabel(item));

const getPortalQueueDisplayMeta = (item: PortalQueueItem): QueueDisplayMeta =>
  getQueueItemDisplayMeta(item) as QueueDisplayMeta;

const canRetryPortalQueueItem = (item: PortalQueueItem) =>
  [SYNC_STATES.FAILED, SYNC_STATES.CONFLICT, SYNC_STATES.NEEDS_REVIEW].includes(item.status);

const canCancelPortalQueueItem = (item: PortalQueueItem) =>
  ![
    SYNC_STATES.CANCELLED,
    SYNC_STATES.RESOLVED,
    SYNC_STATES.SYNCED,
    SYNC_STATES.SYNCING,
  ].includes(item.status);

const canResolvePortalQueueItem = (item: PortalQueueItem) =>
  isQueueItemConflictLike(item) || item.status === SYNC_STATES.FAILED;

const AdminPortalHome: React.FC = () => {
  const { session } = useAdminPortal();
  const isOnline = useOnlineStatus();
  const queueStorage = useMemo(() => createStroanePortalQueueStorage(), []);
  const {
    counts: queueCounts,
    error: queueError,
    loading: queueLoading,
    refresh: refreshQueue,
    reviewItems: queueReviewItems,
  } = useSyncQueueSummary({
    storage: queueStorage,
    sourceApp: STROANE_PORTAL_QUEUE_SOURCE_APP,
    organizationId: STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
    actorId: session?.username?.trim().toLowerCase() || "",
    enabled: Boolean(session),
    pollIntervalMs: 4000,
  });
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlertSummary>(EMPTY_ALERT_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [loadWarning, setLoadWarning] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [retryingQueueItemId, setRetryingQueueItemId] = useState("");
  const [cancellingQueueItemId, setCancellingQueueItemId] = useState("");
  const [resolvingQueueItemId, setResolvingQueueItemId] = useState("");
  const [stockAttentionFilter, setStockAttentionFilter] =
    useState<StockAttentionFilter>("all");

  useSEOMeta({
    title: "Operations portal | Stroane",
    description: "Private Stroane operations overview.",
    canonical: portalUrl("/admin"),
    noIndex: true,
  });

  const applyOverviewSnapshot = useCallback((snapshot: PortalOverviewSnapshot) => {
    setInventory(snapshot.inventory);
    setSuppliers(snapshot.suppliers);
    setMovements(snapshot.movements);
    setProducts(snapshot.products);
    setAlerts(snapshot.alerts);
  }, []);

  const fetchOverviewFromServer = useCallback(async (options: { throwOnPartial?: boolean } = {}) => {
    if (!session) return;
    setLoadWarning("");

    const [inventoryResult, supplierResult, movementResult, alertResult, productResult] =
      await Promise.allSettled([
        adminInventoryApi.listInventory(session, { limit: 100 }),
        adminInventoryApi.listSuppliers(session),
        adminInventoryApi.listMovements(session, { limit: 8 }),
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
          ? "Operational data is temporarily unavailable."
          : "Some operational data could not be refreshed."
      );
    }

    if (inventoryResult.status === "fulfilled") setInventory(inventoryResult.value);
    if (supplierResult.status === "fulfilled") setSuppliers(supplierResult.value);
    if (movementResult.status === "fulfilled") setMovements(movementResult.value);
    if (alertResult.status === "fulfilled") setAlerts(alertResult.value);
    if (productResult.status === "fulfilled") setProducts(productResult.value.products);

    if (failedLoads) {
      setLoadWarning(
        failedLoads === 5
          ? "Operational data is temporarily unavailable. Check the API connection and try again."
          : "Some operational data could not be refreshed. Available portal data is shown below."
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

    savePortalOverviewSnapshot(session, {
      inventory: inventoryResult.value,
      suppliers: supplierResult.value,
      movements: movementResult.value,
      alerts: alertResult.value,
      products: productResult.value.products,
    });
  }, [session]);

  const refreshOverviewFromServer = useCallback(async () => {
    setLoading(true);
    try {
      await fetchOverviewFromServer();
      setSyncMessage("");
    } finally {
      setLoading(false);
    }
  }, [fetchOverviewFromServer]);

  const handleRefreshOverview = useCallback(async () => {
    if (!session) return;
    if (!isOnline) {
      await queuePortalOverviewRefresh(queueStorage, session);
      await refreshQueue();
      setSyncMessage("Refresh queued. It will sync automatically when this device is back online.");
      setLoadWarning("You're offline. Showing the last saved portal dashboard on this device.");
      return;
    }

    await refreshOverviewFromServer();
  }, [isOnline, queueStorage, refreshOverviewFromServer, refreshQueue, session]);

  const syncQueuedOverview = useCallback(
    () => fetchOverviewFromServer({ throwOnPartial: true }),
    [fetchOverviewFromServer]
  );

  const handleRetryQueuedItem = useCallback(async (item: PortalQueueItem) => {
    setRetryingQueueItemId(item.id);
    try {
      await processQueuedPortalOverviewRefresh(queueStorage, item, syncQueuedOverview);
      await refreshQueue();
      setSyncMessage("Queued portal refresh synced.");
    } finally {
      setRetryingQueueItemId("");
    }
  }, [queueStorage, refreshQueue, syncQueuedOverview]);

  const handleCancelQueuedItem = useCallback(async (item: PortalQueueItem) => {
    setCancellingQueueItemId(item.id);
    try {
      await cancelQueuedAction(queueStorage, item, {
        reason: "Cancelled from the Stroane portal offline sync panel.",
      });
      notifyStroanePortalQueueChanged();
      await refreshQueue();
    } finally {
      setCancellingQueueItemId("");
    }
  }, [queueStorage, refreshQueue]);

  const handleResolveQueuedItem = useCallback(async (item: PortalQueueItem) => {
    setResolvingQueueItemId(item.id);
    try {
      await markQueuedActionResolved(queueStorage, item, {
        resolution: "Marked resolved from the Stroane portal offline sync panel.",
      });
      notifyStroanePortalQueueChanged();
      await refreshQueue();
    } finally {
      setResolvingQueueItemId("");
    }
  }, [queueStorage, refreshQueue]);

  useEffect(() => {
    if (!session) return;
    const cached = loadPortalOverviewSnapshot(session);
    if (cached) {
      applyOverviewSnapshot(cached);
      if (!isOnline) {
        setLoadWarning("You're offline. Showing the last saved portal dashboard on this device.");
      }
      return;
    }

    if (!isOnline) {
      setLoadWarning("You're offline and this device has no saved portal dashboard yet. Connect once to cache it.");
    }
  }, [applyOverviewSnapshot, isOnline, session]);

  useEffect(() => {
    if (!session || !isOnline) return;
    void refreshOverviewFromServer();
  }, [isOnline, refreshOverviewFromServer, session]);

  useEffect(() => {
    if (!session || !isOnline) return;
    let cancelled = false;

    const syncPendingRefreshes = async () => {
      const syncedCount = await processPendingPortalOverviewRefreshes(
        queueStorage,
        session,
        syncQueuedOverview
      );
      if (cancelled || !syncedCount) return;
      await refreshQueue();
      setSyncMessage(
        `${syncedCount} queued portal refresh${syncedCount === 1 ? "" : "es"} synced.`
      );
    };

    void syncPendingRefreshes();

    return () => {
      cancelled = true;
    };
  }, [isOnline, queueStorage, refreshQueue, session, syncQueuedOverview]);

  const baseAttentionItems = useMemo(
    () =>
      inventory
        .filter(isAttentionItem)
        .sort((left, right) => {
          const leftOut = getInventoryStockStatus(left) === "out_of_stock" ? 1 : 0;
          const rightOut = getInventoryStockStatus(right) === "out_of_stock" ? 1 : 0;
          if (leftOut !== rightOut) return rightOut - leftOut;
          return (getInventoryAvailableQuantity(left) ?? Number.MAX_SAFE_INTEGER) -
            (getInventoryAvailableQuantity(right) ?? Number.MAX_SAFE_INTEGER);
        }),
    [inventory]
  );

  const attentionItems = useMemo(
    () =>
      baseAttentionItems
        .filter((item) => matchesStockAttentionFilter(item, stockAttentionFilter))
        .slice(0, 6),
    [baseAttentionItems, stockAttentionFilter]
  );

  const stockAttentionFilters = useMemo(
    () => [
      {
        id: "all" as StockAttentionFilter,
        label: "All",
        count: baseAttentionItems.length,
      },
      {
        id: "out_of_stock" as StockAttentionFilter,
        label: "Out",
        count: baseAttentionItems.filter((item) =>
          matchesStockAttentionFilter(item, "out_of_stock")
        ).length,
      },
      {
        id: "low_stock" as StockAttentionFilter,
        label: "Low",
        count: baseAttentionItems.filter((item) =>
          matchesStockAttentionFilter(item, "low_stock")
        ).length,
      },
      {
        id: "unconfirmed" as StockAttentionFilter,
        label: "Unconfirmed",
        count: baseAttentionItems.filter((item) =>
          matchesStockAttentionFilter(item, "unconfirmed")
        ).length,
      },
    ],
    [baseAttentionItems]
  );

  const summary = useMemo(
    () => {
      const trackedItems = inventory.filter((item) => item.inventoryTrackingEnabled).length;
      const countedStockItems = inventory.filter(
        (item) => item.inventoryTrackingEnabled && getInventoryAvailableQuantity(item) !== null
      ).length;
      const availableUnits = inventory.reduce(
        (total, item) => total + (getInventoryAvailableQuantity(item) ?? 0),
        0
      );
      const reservedUnits = inventory.reduce(
        (total, item) => total + (item.reservedQuantity || 0),
        0
      );
      const activeProducts = products.filter(
        (product) => product.publishingStatus === "active"
      ).length;
      const draftProducts = products.filter(
        (product) => product.publishingStatus === "draft"
      ).length;
      const linkedProducts = products.filter(
        (product) => product.preferredSupplier || product.supplierLinks.length
      ).length;
      const activeSuppliers = suppliers.filter((supplier) => supplier.status === "active").length;
      const lowStockItems = inventory.filter(
        (item) =>
          getInventoryStockStatus(item) !== "out_of_stock" &&
          (item.isLowStock || item.needsReorder)
      ).length;
      const outOfStockItems = inventory.filter(
        (item) => getInventoryStockStatus(item) === "out_of_stock"
      ).length;
      const unconfirmedStockItems = inventory.filter((item) =>
        matchesStockAttentionFilter(item, "unconfirmed")
      ).length;

      return {
        trackedItems,
        countedStockItems,
        availableUnits,
        reservedUnits,
        products: products.length,
        activeProducts,
        draftProducts,
        linkedProducts,
        activeSuppliers,
        suppliers: suppliers.length,
        lowStockItems: Math.max(alerts.counts.lowStock, lowStockItems),
        outOfStockItems: Math.max(alerts.counts.outOfStock, outOfStockItems),
        unconfirmedStockItems,
      };
    },
    [alerts.counts.lowStock, alerts.counts.outOfStock, inventory, products, suppliers]
  );

  const dashboardKpis = useMemo(
    () => [
      {
        label: "Products",
        value: summary.products,
        detail: `${summary.activeProducts} live products`,
        to: "/admin/products",
        tone: "accent",
        icon: <HiOutlineShoppingBag aria-hidden="true" />,
      },
      {
        label: "Available units",
        value: summary.countedStockItems ? summary.availableUnits : 0,
        detail: summary.countedStockItems
          ? `${summary.countedStockItems} of ${summary.trackedItems} counts recorded`
          : summary.trackedItems
            ? `${summary.trackedItems} stock counts awaiting entry`
            : "No inventory records yet",
        to: "/admin/inventory",
        tone: "success",
        icon: <HiOutlineCheckCircle aria-hidden="true" />,
      },
      {
        label: "Reserved units",
        value: summary.reservedUnits,
        detail: "Held from available stock",
        to: "/admin/inventory",
        tone: "neutral",
        icon: <HiOutlineLockClosed aria-hidden="true" />,
      },
      {
        label: "Low stock",
        value: summary.lowStockItems,
        detail: "Reorder needed soon",
        to: "/admin/inventory",
        tone: summary.lowStockItems ? "warning" : "success",
        icon: <HiOutlineExclamation aria-hidden="true" />,
      },
      {
        label: "Out of stock",
        value: summary.outOfStockItems,
        detail: summary.outOfStockItems ? "Restock required" : "No blocked stock",
        to: "/admin/inventory",
        tone: summary.outOfStockItems ? "danger" : "success",
        icon: <HiOutlineXCircle aria-hidden="true" />,
      },
      {
        label: "Draft products",
        value: summary.draftProducts,
        detail: "Awaiting publication",
        to: "/admin/products",
        tone: "neutral",
        icon: <HiOutlineArchive aria-hidden="true" />,
      },
    ],
    [summary]
  );

  const readiness = useMemo(
    () => [
      {
        label: "Live catalogue",
        value: calculatePercentage(summary.activeProducts, summary.products),
        detail: `${summary.activeProducts} of ${summary.products} products active`,
      },
      {
        label: "Stock tracking",
        value: calculatePercentage(summary.trackedItems, summary.products),
        detail: `${summary.trackedItems} of ${summary.products} products tracked`,
      },
      {
        label: "Supplier coverage",
        value: calculatePercentage(summary.linkedProducts, summary.products),
        detail: `${summary.linkedProducts} of ${summary.products} products linked`,
      },
    ],
    [summary]
  );

  const pendingSyncCount = Number(queueCounts?.reviewable || 0);
  const queueStatus =
    Number(queueCounts?.failed || 0) || Number(queueCounts?.needsReview || 0)
      ? SYNC_STATES.FAILED
      : Number(queueCounts?.syncing || 0)
        ? SYNC_STATES.SYNCING
        : pendingSyncCount
          ? SYNC_STATES.PENDING
          : SYNC_STATES.SYNCED;
  const visibleQueueItems = (queueReviewItems || []) as PortalQueueItem[];
  const queueSummaryChips = [
    { label: "Pending", value: Number(queueCounts?.pending || 0) },
    { label: "Syncing", value: Number(queueCounts?.syncing || 0) },
    { label: "Failed", value: Number(queueCounts?.failed || 0) },
    { label: "Needs review", value: Number(queueCounts?.needsReview || 0) },
    { label: "Retrying", value: Number(queueCounts?.retrying || 0) },
  ].filter((item) => item.value > 0);

  const actionItems = useMemo<DashboardLinkItem[]>(() => {
    const items: DashboardLinkItem[] = [];

    if (summary.outOfStockItems) {
      items.push({
        label: "Restock blocked products",
        value: summary.outOfStockItems,
        detail: "Out-of-stock products cannot be sold until stock is updated.",
        to: "/admin/inventory",
        tone: "danger",
        icon: <HiOutlineXCircle aria-hidden="true" />,
      });
    }

    if (summary.lowStockItems) {
      items.push({
        label: "Plan supplier reorder",
        value: summary.lowStockItems,
        detail: "Low-stock products need review before they block sales.",
        to: "/admin/suppliers",
        tone: "warning",
        icon: <HiOutlineOfficeBuilding aria-hidden="true" />,
      });
    }

    if (summary.unconfirmedStockItems) {
      items.push({
        label: "Confirm stock counts",
        value: summary.unconfirmedStockItems,
        detail: "Products without confirmed quantities need a physical count.",
        to: "/admin/inventory",
        tone: "warning",
        icon: <HiOutlineClipboardList aria-hidden="true" />,
      });
    }

    if (summary.products > summary.linkedProducts) {
      items.push({
        label: "Link supplier coverage",
        value: summary.products - summary.linkedProducts,
        detail: "Products without supplier links are harder to reorder quickly.",
        to: "/admin/suppliers",
        tone: "neutral",
        icon: <HiOutlineOfficeBuilding aria-hidden="true" />,
      });
    }

    if (summary.draftProducts) {
      items.push({
        label: "Review draft products",
        value: summary.draftProducts,
        detail: "Draft catalogue items are not visible to customers yet.",
        to: "/admin/products",
        tone: "neutral",
        icon: <HiOutlineArchive aria-hidden="true" />,
      });
    }

    if (pendingSyncCount) {
      items.push({
        label: "Sync queued work",
        value: pendingSyncCount,
        detail: "Offline portal work is waiting on this device.",
        href: "#stroane-sync-title",
        tone: "warning",
        icon: <HiOutlineRefresh aria-hidden="true" />,
      });
    }

    return items.slice(0, 5);
  }, [
    pendingSyncCount,
    summary.draftProducts,
    summary.linkedProducts,
    summary.lowStockItems,
    summary.outOfStockItems,
    summary.products,
    summary.unconfirmedStockItems,
  ]);

  if (!session) return null;

  return (
    <section className="stroane-portal-overview">
      <header className="stroane-portal-overview__head">
        <div>
          <h1>Good to see you, {getAdminSalutationName(session)}</h1>
          <p>Keep track of your products, stock levels, and supplier coverage before moving into the relevant workspace.</p>
        </div>
        <ERPSecondaryAction
          icon={<HiOutlineRefresh />}
          onClick={handleRefreshOverview}
          disabled={loading}
        >
          {loading ? "Refreshing" : "Refresh"}
        </ERPSecondaryAction>
      </header>

      {loadWarning ? (
        <ERPFormNotice tone="warning" title="Partial operational view">
          {loadWarning}
        </ERPFormNotice>
      ) : null}

      {syncMessage ? (
        <ERPFormNotice tone="info" title="Offline sync">
          {syncMessage}
        </ERPFormNotice>
      ) : null}

      <section className="stroane-portal-overview__kpis" aria-label="Operations key performance indicators">
        {dashboardKpis.map((kpi) => (
          <Link
            key={kpi.label}
            to={kpi.to}
            className="bubble-card stroane-portal-overview__kpi-card"
            data-tone={kpi.tone}
          >
            <span>{kpi.icon}</span>
            <small>{kpi.label}</small>
            <strong>{kpi.value}</strong>
            <em>{kpi.detail}</em>
          </Link>
        ))}
      </section>

      <section
        className="glass-card stroane-portal-overview__readiness"
        aria-labelledby="stroane-readiness-title"
      >
        <header>
          <span>Operational readiness</span>
          <h2 id="stroane-readiness-title">Catalogue coverage</h2>
        </header>
        <div>
          {readiness.map((item) => (
            <article key={item.label}>
              <span>
                <strong>{item.label}</strong>
                <small>{item.value}%</small>
              </span>
              <i
                role="progressbar"
                aria-label={item.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={item.value}
              >
                <b style={{ width: `${item.value}%` }} />
              </i>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section
        className="glass-card stroane-portal-overview__action-panel"
        aria-labelledby="stroane-action-title"
      >
        <div className="stroane-portal-overview__panel-head">
          <div>
            <span><HiOutlineBell aria-hidden="true" /> Action required</span>
            <h2 id="stroane-action-title">Next operational moves</h2>
          </div>
        </div>

        {actionItems.length ? (
          <div className="stroane-portal-overview__action-list">
            {actionItems.map((item) => {
              const actionContent = (
                <>
                  <span className="stroane-portal-overview__action-icon">{item.icon}</span>
                  <span className="stroane-portal-overview__action-copy">
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <span className="stroane-portal-overview__action-value">{item.value}</span>
                </>
              );

              return item.href ? (
                <a
                  key={item.label}
                  href={item.href}
                  className="stroane-portal-overview__action-item"
                  data-tone={item.tone}
                >
                  {actionContent}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.to || "/admin"}
                  className="stroane-portal-overview__action-item"
                  data-tone={item.tone}
                >
                  {actionContent}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="stroane-portal-overview__action-empty">
            <HiOutlineCheckCircle aria-hidden="true" />
            <span>
              <strong>No urgent actions</strong>
              <small>Stock, supplier coverage, and sync queue are clear.</small>
            </span>
          </div>
        )}
      </section>

      <div className="stroane-portal-overview__grid">
        <section className="glass-card stroane-portal-overview__panel">
          <div className="stroane-portal-overview__panel-head">
            <div>
              <span><HiOutlineBell aria-hidden="true" /> Stock attention</span>
              <h2>{alerts.counts.total || baseAttentionItems.length} item(s) need a closer look</h2>
            </div>
            <Link to="/admin/inventory">Open inventory</Link>
          </div>
          <div className="stroane-portal-overview__stock-filters" role="group" aria-label="Stock attention filters">
            {stockAttentionFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={filter.id === stockAttentionFilter ? "is-active" : ""}
                aria-pressed={filter.id === stockAttentionFilter}
                onClick={() => setStockAttentionFilter(filter.id)}
              >
                <span>{filter.label}</span>
                <strong>{filter.count}</strong>
              </button>
            ))}
          </div>
          {attentionItems.length ? (
            <div className="stroane-portal-overview__attention-list">
              {attentionItems.map((item) => {
                const stockStatus = getInventoryStockStatus(item);
                const availableQuantity = getInventoryAvailableQuantity(item);

                return (
                  <Link key={item.id} to="/admin/inventory">
                    <span>
                      <strong>{getProductName(item)}</strong>
                      <small>{item.sku || item.productSlug}</small>
                    </span>
                    <span>
                      <ERPStatusBadge tone={getStockTone(item)}>
                        {formatStockStatusLabel(stockStatus)}
                      </ERPStatusBadge>
                      <small>
                        {availableQuantity === null
                          ? "Quantity not set"
                          : `${availableQuantity} available`}
                      </small>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="stroane-portal-overview__empty">
              {loading
                ? "Checking inventory signals..."
                : stockAttentionFilter === "all"
                  ? "No tracked stock warnings right now."
                  : "No matching stock warnings right now."}
            </p>
          )}
        </section>

        <section className="glass-card stroane-portal-overview__panel">
          <div className="stroane-portal-overview__panel-head">
            <div>
              <span><HiOutlineClipboardList aria-hidden="true" /> Recent activity</span>
              <h2>Latest inventory movements</h2>
            </div>
            <Link to="/admin/inventory">Open inventory</Link>
          </div>
          {movements.length ? (
            <div className="stroane-portal-overview__activity-list">
              {movements.slice(0, 6).map((movement) => (
                <div key={movement.id}>
                  <span>
                    <strong>{formatLabel(movement.productSlug)}</strong>
                    <small>{formatDateTime(movement.createdAt)}</small>
                  </span>
                  <span>
                    <ERPStatusBadge tone={movement.quantityDelta < 0 ? "warning" : "success"}>
                      {formatLabel(movement.movementType)}
                    </ERPStatusBadge>
                    <small>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta} units</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="stroane-portal-overview__empty">
              {loading ? "Loading recent movements..." : "No inventory movements have been recorded yet."}
            </p>
          )}
        </section>
      </div>

      <section
        className={`glass-card stroane-portal-overview__sync-panel is-${queueStatus}`}
        aria-labelledby="stroane-sync-title"
      >
        <div className="stroane-portal-overview__sync-head">
          <div>
            <span>Offline sync</span>
            <h2 id="stroane-sync-title">Queue</h2>
          </div>
          <button
            type="button"
            className="stroane-portal-overview__sync-refresh"
            onClick={refreshQueue}
            disabled={queueLoading}
          >
            <HiOutlineRefresh aria-hidden="true" />
            <span>{queueLoading ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>

        {queueSummaryChips.length ? (
          <div className="stroane-portal-overview__sync-counts" aria-label="Offline sync queue counts">
            {queueSummaryChips.map((chip) => (
              <span key={chip.label}>{chip.label}: {chip.value}</span>
            ))}
          </div>
        ) : null}

        {queueError ? (
          <p className="stroane-portal-overview__sync-error" role="alert">
            {queueError}
          </p>
        ) : null}

        {visibleQueueItems.length ? (
          <div className="stroane-portal-overview__sync-items">
            {visibleQueueItems.map((item) => {
              const meta = getPortalQueueDisplayMeta(item);
              const queuedLabel = formatDateTime(meta.queuedAt || item.createdAt);
              const canRetry = canRetryPortalQueueItem(item);
              const canCancel = canCancelPortalQueueItem(item);
              const canResolve = canResolvePortalQueueItem(item);

              return (
                <article
                  key={item.id}
                  className="stroane-portal-overview__sync-item"
                  data-sync-state={item.status || SYNC_STATES.PENDING}
                >
                  <div className="stroane-portal-overview__sync-item-head">
                    <span>
                      <strong>{getPortalQueueActionLabel(item)}</strong>
                      <small>{meta.title || "Queued portal work"}</small>
                    </span>
                    <ERPStatusBadge tone={item.status === SYNC_STATES.FAILED ? "danger" : "warning"}>
                      {getPortalQueueStatusLabel(item.status)}
                    </ERPStatusBadge>
                  </div>

                  {meta.lastError ? (
                    <p className="stroane-portal-overview__sync-error">{meta.lastError}</p>
                  ) : null}

                  <div className="stroane-portal-overview__sync-meta">
                    <span>Queued {queuedLabel}</span>
                    {item.retry?.attempts ? (
                      <span>{item.retry.attempts} retry{item.retry.attempts === 1 ? "" : "s"}</span>
                    ) : null}
                    {meta.targetType ? (
                      <span>{formatLabel(meta.targetType)}{meta.targetId ? ` #${meta.targetId}` : ""}</span>
                    ) : null}
                  </div>

                  {(canRetry || canResolve || canCancel) ? (
                    <div className="stroane-portal-overview__sync-actions">
                      {canRetry ? (
                        <button
                          type="button"
                          onClick={() => handleRetryQueuedItem(item)}
                          disabled={retryingQueueItemId === item.id}
                        >
                          {retryingQueueItemId === item.id ? "Retrying" : "Retry"}
                        </button>
                      ) : null}
                      {canResolve ? (
                        <button
                          type="button"
                          onClick={() => handleResolveQueuedItem(item)}
                          disabled={resolvingQueueItemId === item.id}
                        >
                          {resolvingQueueItemId === item.id ? "Resolving" : "Resolve"}
                        </button>
                      ) : null}
                      {canCancel ? (
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => handleCancelQueuedItem(item)}
                          disabled={cancellingQueueItemId === item.id}
                        >
                          {cancellingQueueItemId === item.id ? "Cancelling" : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="stroane-portal-overview__sync-empty">
            <HiOutlineCheckCircle aria-hidden="true" />
            <span>
              <strong>No queued work</strong>
              <small>No queued portal work on this device.</small>
            </span>
          </div>
        )}
      </section>

      <section className="stroane-portal-overview__workspaces" aria-labelledby="stroane-workspaces-title">
        <header>
          <span>Workspaces</span>
          <h2 id="stroane-workspaces-title">Move the work forward</h2>
        </header>
        <div className="stroane-portal-overview__links">
          <Link to="/admin/inventory" className="bubble-card">
            <HiOutlineCube aria-hidden="true" />
            <span><strong>Inventory</strong><small>Review stock counts and movements</small></span>
          </Link>
          <Link to="/admin/suppliers" className="bubble-card">
            <HiOutlineOfficeBuilding aria-hidden="true" />
            <span><strong>Suppliers</strong><small>Manage supplier coverage and reorder routes</small></span>
          </Link>
          <Link to="/admin/products" className="bubble-card">
            <HiOutlineShoppingBag aria-hidden="true" />
            <span><strong>Products</strong><small>Prepare catalogue items for sale</small></span>
          </Link>
          <Link to="/admin/operations" className="bubble-card">
            <HiOutlineClipboardList aria-hidden="true" />
            <span><strong>Operations</strong><small>Review the wider portal workflow</small></span>
          </Link>
        </div>
      </section>
    </section>
  );
};

export default AdminPortalHome;
