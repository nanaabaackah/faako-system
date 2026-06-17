import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineArchive,
  HiOutlineBell,
  HiOutlineCash,
  HiOutlineChartBar,
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
  ERPModal,
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
} from "../api/adminInventory";
import {
  adminOrdersApi,
  type AdminOrder,
  type AdminOrderSummary,
} from "../api/adminOrders";
import { adminProductsApi, type AdminProduct } from "../api/adminProducts";
import { getAdminSalutationName } from "../api/adminSession";
import { portalUrl } from "../../config/appSurface";
import { useAdminPortal } from "../context/AdminPortalContext";
import useSEOMeta from "../../hooks/useSEOMeta";
import {
  type PortalOverviewSnapshot,
  loadPortalOverviewSnapshot,
  savePortalOverviewSnapshot,
} from "../offline/portalOverviewCache";
import {
  STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
  STROANE_PORTAL_QUEUE_SOURCE_APP,
  createStroanePortalQueueStorage,
  notifyStroanePortalQueueChanged,
  processPendingPortalOverviewRefreshes,
  processQueuedPortalOverviewRefresh,
  queuePortalOverviewRefresh,
} from "../offline/portalOfflineQueue";
import BusinessAnalyticsSection from "../components/dashboard/BusinessAnalyticsSection";
import "../styles/AdminPortal.css";

const EMPTY_ALERT_SUMMARY: InventoryAlertSummary = {
  active: [],
  recentDispatches: [],
  counts: {
    lowStock: 0,
    outOfStock: 0,
    total: 0,
  },
};

const EMPTY_ORDER_SUMMARY: AdminOrderSummary = {
  totalOrders: 0,
  totalValue: 0,
  paidValue: 0,
  outstandingValue: 0,
  paidOrders: 0,
  pendingPaymentOrders: 0,
  failedPaymentOrders: 0,
  completedOrders: 0,
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

const toMoneyNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMoney = (value: number, currency = "GHS") =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: currency || "GHS",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);

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

type DashboardDrilldownItem = {
  id: string;
  label: string;
  detail: string;
  value?: string | number;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  to?: string;
};

type DashboardDrilldown = {
  title: string;
  description: string;
  items: DashboardDrilldownItem[];
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
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderSummary, setOrderSummary] = useState<AdminOrderSummary>(EMPTY_ORDER_SUMMARY);
  const [alerts, setAlerts] = useState<InventoryAlertSummary>(EMPTY_ALERT_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [loadWarning, setLoadWarning] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [drilldown, setDrilldown] = useState<DashboardDrilldown | null>(null);
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

    const [
      inventoryResult,
      supplierResult,
      movementResult,
      alertResult,
      productResult,
      orderResult,
    ] =
      await Promise.allSettled([
        adminInventoryApi.listInventory(session, { limit: 100 }),
        adminInventoryApi.listSuppliers(session),
        adminInventoryApi.listMovements(session, { limit: 8 }),
        adminInventoryApi.getAlertSummary(session),
        adminProductsApi.listProducts(session, { limit: 200 }),
        adminOrdersApi.listOrders(session, { limit: 100 }),
      ]);

    const failedLoads = [
      inventoryResult,
      supplierResult,
      movementResult,
      alertResult,
      productResult,
      orderResult,
    ].filter((result) => result.status === "rejected").length;

    if (failedLoads && options.throwOnPartial) {
      throw new Error(
        failedLoads === 6
          ? "Operational data is temporarily unavailable."
          : "Some operational data could not be refreshed."
      );
    }

    if (inventoryResult.status === "fulfilled") setInventory(inventoryResult.value);
    if (supplierResult.status === "fulfilled") setSuppliers(supplierResult.value);
    if (movementResult.status === "fulfilled") setMovements(movementResult.value);
    if (alertResult.status === "fulfilled") setAlerts(alertResult.value);
    if (productResult.status === "fulfilled") setProducts(productResult.value.products);
    if (orderResult.status === "fulfilled") {
      setOrders(orderResult.value.orders);
      setOrderSummary(orderResult.value.summary);
    }

    if (failedLoads) {
      setLoadWarning(
        failedLoads === 6
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
      productResult.status !== "fulfilled" ||
      orderResult.status !== "fulfilled"
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
      const pricedProducts = products.filter(
        (product) => toMoneyNumber(product.price) !== null
      ).length;
      const linkedProducts = products.filter(
        (product) => product.preferredSupplier || product.supplierLinks.length
      ).length;
      const productsById = new Map(products.map((product) => [product.id, product]));
      const productsBySlug = new Map(products.map((product) => [product.slug, product]));
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
      let stockRetailValue = 0;
      let activeStockRetailValue = 0;
      let atRiskStockRetailValue = 0;
      let pricedStockItems = 0;
      let revenueReadyUnits = 0;

      inventory.forEach((item) => {
        const product =
          (item.productId ? productsById.get(item.productId) : undefined) ||
          productsBySlug.get(item.productSlug);
        const price = toMoneyNumber(item.product?.price ?? product?.price);
        const availableQuantity = getInventoryAvailableQuantity(item);
        if (price === null || availableQuantity === null) return;

        pricedStockItems += 1;
        stockRetailValue += price * availableQuantity;
        if (isAttentionItem(item)) {
          atRiskStockRetailValue += price * availableQuantity;
        }
        if (product?.publishingStatus === "active") {
          activeStockRetailValue += price * availableQuantity;
          revenueReadyUnits += availableQuantity;
        }
      });

      const averageOrderValue = orderSummary.totalOrders
        ? orderSummary.totalValue / orderSummary.totalOrders
        : 0;
      const paymentCollectionRate = orderSummary.totalValue
        ? calculatePercentage(orderSummary.paidValue, orderSummary.totalValue)
        : 0;
      const pricingCoverage = calculatePercentage(pricedProducts, products.length);

      return {
        trackedItems,
        countedStockItems,
        availableUnits,
        reservedUnits,
        products: products.length,
        activeProducts,
        draftProducts,
        pricedProducts,
        linkedProducts,
        activeSuppliers,
        suppliers: suppliers.length,
        pricedStockItems,
        revenueReadyUnits,
        stockRetailValue,
        activeStockRetailValue,
        atRiskStockRetailValue,
        orderCount: orderSummary.totalOrders,
        paidOrders: orderSummary.paidOrders,
        pendingPaymentOrders: orderSummary.pendingPaymentOrders,
        failedPaymentOrders: orderSummary.failedPaymentOrders,
        completedOrders: orderSummary.completedOrders,
        paidRevenue: orderSummary.paidValue,
        outstandingRevenue: orderSummary.outstandingValue,
        averageOrderValue,
        paymentCollectionRate,
        pricingCoverage,
        lowStockItems: Math.max(alerts.counts.lowStock, lowStockItems),
        outOfStockItems: Math.max(alerts.counts.outOfStock, outOfStockItems),
        unconfirmedStockItems,
      };
    },
    [alerts.counts.lowStock, alerts.counts.outOfStock, inventory, orderSummary, products, suppliers]
  );

  const drilldownLists = useMemo(() => {
    const inventoryItems = (items: InventoryItem[]): DashboardDrilldownItem[] =>
      items.map((item) => {
        const stockStatus = getInventoryStockStatus(item);
        const availableQuantity = getInventoryAvailableQuantity(item);
        return {
          id: item.id,
          label: getProductName(item),
          detail: [
            item.sku || item.productSlug,
            formatStockStatusLabel(stockStatus),
            availableQuantity === null ? "Quantity not set" : `${availableQuantity} available`,
          ]
            .filter(Boolean)
            .join(" · "),
          value: availableQuantity ?? "Unset",
          tone: getStockTone(item),
          to: `/admin/inventory?item=${encodeURIComponent(item.id)}`,
        };
      });

    const productItems = (items: AdminProduct[]): DashboardDrilldownItem[] =>
      items.map((product) => ({
        id: product.id,
        label: product.name,
        detail: [
          product.sku || product.slug,
          product.category?.name || product.categorySlug || "Uncategorised",
          product.price == null ? "No storefront price" : formatMoney(Number(product.price), product.currency),
        ]
          .filter(Boolean)
          .join(" · "),
        value: formatLabel(product.publishingStatus),
        tone:
          product.publishingStatus === "active"
            ? "success"
            : product.publishingStatus === "archived"
              ? "danger"
              : "neutral",
        to: "/admin/products",
      }));

    const orderItems = (items: AdminOrder[]): DashboardDrilldownItem[] =>
      items.map((order) => ({
        id: order.id,
        label: order.orderNumber,
        detail: `${order.customer.name} · ${formatLabel(order.paymentStatus || "not_started")}`,
        value: formatMoney(order.total, order.currency),
        tone:
          order.paymentStatus === "paid"
            ? "success"
            : order.paymentStatus === "failed" || order.paymentStatus === "abandoned"
              ? "danger"
              : "warning",
        to: "/admin/orders",
      }));

    const activeProducts = products.filter((product) => product.publishingStatus === "active");
    const draftProducts = products.filter((product) => product.publishingStatus === "draft");
    const unpricedProducts = products.filter((product) => toMoneyNumber(product.price) === null);
    const supplierGapProducts = products.filter(
      (product) => !product.preferredSupplier && !product.supplierLinks.length
    );
    const countedInventory = inventory.filter((item) => getInventoryAvailableQuantity(item) !== null);
    const reservedInventory = inventory.filter((item) => (item.reservedQuantity || 0) > 0);
    const lowStockInventory = inventory.filter(
      (item) =>
        getInventoryStockStatus(item) !== "out_of_stock" &&
        (item.isLowStock || item.needsReorder || getInventoryStockStatus(item) === "low_stock")
    );
    const outOfStockInventory = inventory.filter(
      (item) => getInventoryStockStatus(item) === "out_of_stock"
    );
    const unconfirmedInventory = inventory.filter((item) =>
      matchesStockAttentionFilter(item, "unconfirmed")
    );
    const valuedInventory = inventory.filter((item) => {
      const product = products.find(
        (productItem) =>
          productItem.id === item.productId ||
          productItem.slug === item.productSlug ||
          productItem.id === item.productSlug
      );
      const price = toMoneyNumber(item.product?.price ?? product?.price);
      return price !== null && getInventoryAvailableQuantity(item) !== null;
    });

    return {
      activeProducts: productItems(activeProducts),
      allProducts: productItems(products),
      draftProducts: productItems(draftProducts),
      unpricedProducts: productItems(unpricedProducts),
      supplierGapProducts: productItems(supplierGapProducts),
      countedInventory: inventoryItems(countedInventory),
      reservedInventory: inventoryItems(reservedInventory),
      lowStockInventory: inventoryItems(lowStockInventory),
      outOfStockInventory: inventoryItems(outOfStockInventory),
      unconfirmedInventory: inventoryItems(unconfirmedInventory),
      valuedInventory: inventoryItems(valuedInventory),
      orders: orderItems(orders),
      pendingOrders: orderItems(
        orders.filter((order) =>
          ["payment_pending", "not_started", ""].includes(order.paymentStatus || "")
        )
      ),
      paidOrders: orderItems(orders.filter((order) => order.paymentStatus === "paid")),
      failedOrders: orderItems(
        orders.filter((order) => ["failed", "abandoned"].includes(order.paymentStatus || ""))
      ),
      completedOrders: orderItems(
        orders.filter(
          (order) =>
            order.status === "completed" || order.fulfillmentStatus === "delivered"
        )
      ),
    };
  }, [inventory, orders, products]);

  const dashboardKpis = useMemo(
    () => [
      {
        label: "Products",
        value: summary.products,
        detail: `${summary.activeProducts} live products`,
        to: "/admin/products",
        tone: "accent",
        icon: <HiOutlineShoppingBag aria-hidden="true" />,
        drilldown: {
          title: "Catalogue products",
          description: "Products currently known to the portal.",
          items: drilldownLists.allProducts,
        },
      },
      {
        label: "Orders",
        value: summary.orderCount,
        detail: `${formatMoney(summary.paidRevenue)} captured`,
        to: "/admin/orders",
        tone: "accent",
        icon: <HiOutlineClipboardList aria-hidden="true" />,
        drilldown: {
          title: "Recent orders",
          description: "Storefront and manually created commerce orders.",
          items: drilldownLists.orders,
        },
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
        drilldown: {
          title: "Available stock records",
          description: "Inventory rows with confirmed quantities.",
          items: drilldownLists.countedInventory,
        },
      },
      {
        label: "Reserved units",
        value: summary.reservedUnits,
        detail: "Held from available stock",
        to: "/admin/inventory",
        tone: "neutral",
        icon: <HiOutlineLockClosed aria-hidden="true" />,
        drilldown: {
          title: "Reserved stock",
          description: "Inventory rows holding reserved units.",
          items: drilldownLists.reservedInventory,
        },
      },
      {
        label: "Low stock",
        value: summary.lowStockItems,
        detail: "Reorder needed soon",
        to: "/admin/inventory",
        tone: summary.lowStockItems ? "warning" : "success",
        icon: <HiOutlineExclamation aria-hidden="true" />,
        drilldown: {
          title: "Low stock",
          description: "Products that need reorder planning before they block sales.",
          items: drilldownLists.lowStockInventory,
        },
      },
      {
        label: "Out of stock",
        value: summary.outOfStockItems,
        detail: summary.outOfStockItems ? "Restock required" : "No blocked stock",
        to: "/admin/inventory",
        tone: summary.outOfStockItems ? "danger" : "success",
        icon: <HiOutlineXCircle aria-hidden="true" />,
        drilldown: {
          title: "Out of stock",
          description: "Products currently blocked by unavailable stock.",
          items: drilldownLists.outOfStockInventory,
        },
      },
    ],
    [drilldownLists, summary]
  );

  const businessAnalytics = useMemo(
    () => [
      {
        label: "Paid revenue",
        value: formatMoney(summary.paidRevenue),
        detail: `${summary.paidOrders} paid order${summary.paidOrders === 1 ? "" : "s"}`,
        to: "/admin/orders",
        tone: "success",
        icon: <HiOutlineCash aria-hidden="true" />,
        drilldown: {
          title: "Paid orders",
          description: "Orders that have been verified as paid.",
          items: drilldownLists.paidOrders,
        },
      },
      {
        label: "Receivables",
        value: formatMoney(summary.outstandingRevenue),
        detail: `${summary.pendingPaymentOrders} payment pending`,
        to: "/admin/orders",
        tone: summary.outstandingRevenue ? "warning" : "success",
        icon: <HiOutlineClipboardList aria-hidden="true" />,
        drilldown: {
          title: "Outstanding orders",
          description: "Orders still waiting for payment confirmation.",
          items: drilldownLists.pendingOrders,
        },
      },
      {
        label: "Collection rate",
        value: `${summary.paymentCollectionRate}%`,
        detail: `${formatMoney(summary.averageOrderValue)} average order value`,
        to: "/admin/orders",
        tone: summary.paymentCollectionRate >= 80 ? "success" : "warning",
        icon: <HiOutlineChartBar aria-hidden="true" />,
        drilldown: {
          title: "Payment issues",
          description: "Orders with failed or abandoned payment states.",
          items: drilldownLists.failedOrders,
        },
      },
      {
        label: "Stock retail value",
        value: formatMoney(summary.stockRetailValue),
        detail: `${summary.pricedStockItems} priced stock record${
          summary.pricedStockItems === 1 ? "" : "s"
        }`,
        to: "/admin/inventory",
        tone: "accent",
        icon: <HiOutlineCash aria-hidden="true" />,
        drilldown: {
          title: "Priced stock records",
          description: "Inventory rows that can contribute to stock value.",
          items: drilldownLists.valuedInventory,
        },
      },
      {
        label: "Revenue-ready stock",
        value: formatMoney(summary.activeStockRetailValue),
        detail: `${summary.revenueReadyUnits} active priced unit${
          summary.revenueReadyUnits === 1 ? "" : "s"
        }`,
        to: "/admin/inventory",
        tone: "success",
        icon: <HiOutlineChartBar aria-hidden="true" />,
        drilldown: {
          title: "Revenue-ready stock",
          description: "Active priced inventory that can support storefront sales.",
          items: drilldownLists.valuedInventory,
        },
      },
      {
        label: "Stock risk value",
        value: formatMoney(summary.atRiskStockRetailValue),
        detail: "Priced value tied to attention items",
        to: "/admin/inventory",
        tone: summary.atRiskStockRetailValue ? "warning" : "success",
        icon: <HiOutlineExclamation aria-hidden="true" />,
        drilldown: {
          title: "Stock value at risk",
          description: "Attention stock records with priced available units.",
          items: [...drilldownLists.lowStockInventory, ...drilldownLists.outOfStockInventory],
        },
      },
      {
        label: "Priced catalogue",
        value: `${summary.pricingCoverage}%`,
        detail: "Products with a storefront price",
        to: "/admin/products",
        tone: summary.pricedProducts === summary.products ? "success" : "warning",
        icon: <HiOutlineShoppingBag aria-hidden="true" />,
        drilldown: {
          title: "Products missing prices",
          description: "Products that will stay hidden from purchase flow until priced.",
          items: drilldownLists.unpricedProducts,
        },
      },
      {
        label: "Supplier cover",
        value: `${calculatePercentage(summary.linkedProducts, summary.products)}%`,
        detail: `${summary.linkedProducts} of ${summary.products} products linked`,
        to: "/admin/suppliers",
        tone: summary.linkedProducts === summary.products ? "success" : "neutral",
        icon: <HiOutlineOfficeBuilding aria-hidden="true" />,
        drilldown: {
          title: "Supplier coverage gaps",
          description: "Products without a preferred or linked supplier.",
          items: drilldownLists.supplierGapProducts,
        },
      },
    ],
    [drilldownLists, summary]
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

      <BusinessAnalyticsSection
        items={businessAnalytics}
        onSelect={(item) => {
          if (item.drilldown) setDrilldown(item.drilldown as DashboardDrilldown);
        }}
      />

      <section className="glass-card stroane-portal-overview__business" aria-label="Operations key performance indicators">
        
          <header>
            <span>Business analytics</span>
            <h2 id="stroane-business-title">Revenue and catalogue health</h2>
          </header>
          <div className="stroane-portal-overview__kpis">
          {dashboardKpis.map((kpi) => {
            const content = (
              <>
                <span>{kpi.icon}</span>
                <small>{kpi.label}</small>
                <strong>{kpi.value}</strong>
                <em>{kpi.detail}</em>
              </>
            );

            return kpi.drilldown ? (
              <button
                key={kpi.label}
                type="button"
                className="bubble-card stroane-portal-overview__kpi-card"
                data-tone={kpi.tone}
                onClick={() => setDrilldown(kpi.drilldown)}
              >
                {content}
              </button>
            ) : (
              <Link
                key={kpi.label}
                to={kpi.to}
                className="bubble-card stroane-portal-overview__kpi-card"
                data-tone={kpi.tone}
              >
                {content}
              </Link>
            );
          })}
        </div>
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
          <Link to="/admin/orders" className="bubble-card">
            <HiOutlineClipboardList aria-hidden="true" />
            <span><strong>Orders</strong><small>Manage storefront and manual orders</small></span>
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

      <ERPModal
        open={Boolean(drilldown)}
        title={drilldown?.title || "Details"}
        description={drilldown?.description}
        onClose={() => setDrilldown(null)}
        closeOnBackdrop
        size="lg"
        className="stroane-portal-overview__drilldown-modal"
      >
        {drilldown?.items.length ? (
          <div className="stroane-portal-overview__drilldown-list">
            {drilldown.items.map((item) => {
              const content = (
                <>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                  {item.value !== undefined ? (
                    <ERPStatusBadge tone={item.tone || "neutral"}>{item.value}</ERPStatusBadge>
                  ) : null}
                </>
              );

              return item.to ? (
                <Link
                  key={item.id}
                  to={item.to}
                  className="stroane-portal-overview__drilldown-item"
                  data-tone={item.tone || "neutral"}
                  onClick={() => setDrilldown(null)}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={item.id}
                  className="stroane-portal-overview__drilldown-item"
                  data-tone={item.tone || "neutral"}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="stroane-portal-overview__empty">No matching records right now.</p>
        )}
      </ERPModal>
    </section>
  );
};

export default AdminPortalHome;
