/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatedLoadingState, InlineNotice, SelectField } from "@faako/ui";
import {
  SyncReviewPanel,
  createIndexedDbQueueStorage,
  markQueuedActionResolved,
  useQueuedActionCancel,
  useQueuedActionRetry,
  useSyncQueueSummary,
} from "@faako/offline-sync";
import "./AdminWorkspace.css";
import { useNavigate } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faArrowRight,
  faArrowRightFromBracket,
  faBoxesStacked,
  faCalendarDays,
  faClipboardList,
  faCloudArrowUp,
  faClock,
  faMinus,
  faPlus,
  faReceipt,
  faRotateRight,
  faTruck,
  faTrash,
  faBolt,
  faUser,
  faXmark,
} from "/src/icons/iconSet";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { reebsApiResponse } from "../../api/client";
import {
  createQueueItem,
  loadCustomerSnapshot,
  loadInventorySnapshot,
  loadOfflineQueue,
  saveCustomerSnapshot,
  saveInventorySnapshot,
  saveOfflineQueue,
} from "../../utils/offlineQueue";
import {
  DASHBOARD_PATHS,
} from "../../utils/adminDashboardLinks";
import SearchField from "../../components/SearchField/SearchField";
import { AdminWorkspaceHomeView } from "./components/AdminWorkspaceHomeView";
import {
  canAccessPortalBookings,
  canAccessPortalCustomerDirectory,
  canAccessPortalInventory,
  canAccessPortalOrders,
  canAccessPortalRoute,
  canAccessPrivilegedPortalArea,
  isDriverPortalRole,
  isWaterPortalRole,
  normalizeAdminRole,
} from "../../utils/adminAccess";
import {
  applyInventoryLineQuantityDelta,
  buildProductSearchText,
  buildVariantOptionLabel,
  findVariantById,
  getActiveItemVariants,
  getBaseItemPrice,
  getProductAvailableQty,
  getProductLineKey,
  getVariantAvailableQty,
  getVariantUnitPrice,
  isVariantParentItem,
} from "../../utils/productVariants";

const STOCK_ACTION_OPTIONS = [1, 5, 10];
const LOW_STOCK_THRESHOLD = 3;
const APPROVAL_ORDER_MIN = 2000;
const APPROVAL_BOOKING_MIN = 3000;
const DAY_MS = 24 * 60 * 60 * 1000;

const HOME_WINDOW_OPTIONS = [
  {
    key: "today",
    label: "Today",
    orderStatsWindow: "today",
    financialWindow: "today",
    previousFinancialWindow: "yesterday",
    sourceLabel: "Live sales, bookings, and expenses",
  },
  {
    key: "7d",
    label: "7 days",
    orderStatsWindow: "7d",
    financialWindow: "last7Days",
    previousFinancialWindow: "previous7Days",
    sourceLabel: "Rolling 7-day operating window",
  },
  {
    key: "30d",
    label: "30 days",
    orderStatsWindow: "30d",
    financialWindow: "last30Days",
    previousFinancialWindow: "previous30Days",
    sourceLabel: "Rolling 30-day operating window",
  },
  {
    key: "thisMonth",
    label: "This month",
    orderStatsWindow: "thisMonth",
    financialWindow: "thisMonth",
    previousFinancialWindow: "lastMonth",
    sourceLabel: "Month-to-date live finance and ops",
  },
];

const buildPathWithParams = (basePath, params = {}) => {
  const [pathname, baseSearch = ""] = String(basePath || "").split("?");
  const searchParams = new URLSearchParams(baseSearch);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (!normalized || normalized === "all") return;
    searchParams.set(key, normalized);
  });
  const nextSearch = searchParams.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getQuantity = (item, quantityByLineKey = new Map()) =>
  getProductAvailableQty(item, quantityByLineKey);

const isRentalItem = (item) => {
  const code = String(
    item?.sourceCategoryCode || item?.inventoryProductCode || item?.productGroupCode || ""
  ).trim().toUpperCase();
  if (code === "RENTAL") return true;
  const sku = String(item?.sku || "").trim().toUpperCase();
  return sku.startsWith("REN");
};

const getPrice = (item, variant = null) =>
  variant ? getVariantUnitPrice(item, variant) : getBaseItemPrice(item);

const toCurrency = (value, currency = "GHS") => {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  } catch {
    return `${currency} ${Number(value || 0).toFixed(2)}`;
  }
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatMonthLabel = (value) => {
  if (!value) return "";
  const normalized =
    typeof value === "string" && /^\d{4}-\d{2}$/.test(value)
      ? `${value}-01T00:00:00Z`
      : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
};

const normalizeIdFilter = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
};

const startOfDay = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value = new Date()) => {
  const date = startOfDay(value);
  if (!date) return null;
  date.setDate(date.getDate() + 1);
  return date;
};

const resolveHomeWindowRanges = (windowKey = "30d", nowValue = new Date()) => {
  const now = nowValue instanceof Date ? new Date(nowValue.getTime()) : new Date(nowValue);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  if (!todayStart || !todayEnd) {
    const fallback = new Date();
    return {
      currentStart: fallback,
      currentEnd: fallback,
      previousStart: fallback,
      previousEnd: fallback,
    };
  }

  switch (windowKey) {
    case "today":
      return {
        currentStart: todayStart,
        currentEnd: todayEnd,
        previousStart: new Date(todayStart.getTime() - DAY_MS),
        previousEnd: todayStart,
      };
    case "7d": {
      const currentStart = new Date(now.getTime() - 7 * DAY_MS);
      const previousEnd = currentStart;
      return {
        currentStart,
        currentEnd: now,
        previousStart: new Date(previousEnd.getTime() - 7 * DAY_MS),
        previousEnd,
      };
    }
    case "thisMonth": {
      const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        currentStart,
        currentEnd: now,
        previousStart,
        previousEnd: currentStart,
      };
    }
    case "30d":
    default: {
      const currentStart = new Date(now.getTime() - 30 * DAY_MS);
      const previousEnd = currentStart;
      return {
        currentStart,
        currentEnd: now,
        previousStart: new Date(previousEnd.getTime() - 30 * DAY_MS),
        previousEnd,
      };
    }
  }
};

const isDateInRange = (value, start, end) => {
  if (!value || !start || !end) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date < end;
};

const isOrderClosed = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  return ["fulfilled", "completed", "delivered", "cancelled", "canceled"].includes(normalized);
};

const isBookingClosed = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  return ["completed", "cancelled", "canceled"].includes(normalized);
};

const getOrderWorkDate = (order) =>
  order?.deliveryDate || order?.lastModifiedAt || order?.orderDate || null;

const getBookingWorkDate = (booking) =>
  booking?.eventDate || booking?.lastModifiedAt || null;

const isToday = (value) => {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  return isDateInRange(value, todayStart, todayEnd);
};

const isOverdue = (value) => {
  const date = startOfDay(value);
  const today = startOfDay(new Date());
  if (!date || !today) return false;
  return date < today;
};

const pluralize = (value, label) => `${value} ${label}${value === 1 ? "" : "s"}`;

const formatDeltaText = (value, formatter, neutralLabel = "No change vs last period") => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount === 0) return neutralLabel;
  const prefix = amount > 0 ? "+" : "-";
  return `${prefix}${formatter(Math.abs(amount))} vs last period`;
};

const formatCompactCount = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return `${Math.round(numeric)}`;
};

const getCustomerTotalValue = (customer) =>
  (toNumber(customer?.total_spent) + toNumber(customer?.total_rented))/100;

const buildSparkline = (items, getValue) => {
  const values = (Array.isArray(items) ? items : []).map((item) =>
    Math.max(0, Number(getValue(item)) || 0)
  );
  if (!values.length) {
    return { linePoints: "", fillPoints: "", max: 0 };
  }
  const max = Math.max(...values, 0);
  if (max <= 0) {
    return { linePoints: "", fillPoints: "", max };
  }
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : (index / Math.max(1, values.length - 1)) * 100;
      const y = 100 - Math.min(96, (value / max) * 96);
      return `${x},${y}`;
    })
    .join(" ");
  return {
    linePoints: points,
    fillPoints: `0,100 ${points} 100,100`,
    max,
  };
};

const stockForecastLabel = (forecastLeadTime, lowStockCount) => {
  if (!forecastLeadTime) return "Set vendor lead times to forecast reorder pressure.";
  if (!lowStockCount) return `Lead time average ${forecastLeadTime}d with no critical stock risk.`;
  return `${lowStockCount} items are below level and vendors average ${forecastLeadTime}d lead time.`;
};

const formatDuration = (value) => {
  const totalSeconds = Math.max(0, Math.floor((Number(value) || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const formatRelativeTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60 * 1000) return "Just now";
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateTime(value);
};

const getFirstName = (user, fallbackName = "") => {
  const directFirstName = String(user?.firstName || "").trim();
  if (directFirstName) return directFirstName;
  const baseName = String(fallbackName || "").trim();
  if (!baseName) return "";
  return baseName.split(/\s+/)[0] || "";
};

const isLikelyOfflineError = (error) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const message = String(error?.message || "").toLowerCase();
  return message.includes("network") || message.includes("failed to fetch");
};

const getActivityVisual = (item) => {
  const kind = String(item?.kind || "").trim().toLowerCase();
  const tone = String(item?.tone || "").trim().toLowerCase();

  if (kind === "order" || kind === "sync-order") {
    return {
      icon: faReceipt,
      accentClass: tone === "failed" ? "is-failed" : "is-order",
      actionLabel: kind === "sync-order" ? "Queue" : "Open",
    };
  }
  if (kind === "booking") {
    return {
      icon: faCalendarDays,
      accentClass: "is-booking",
      actionLabel: "Open",
    };
  }
  if (kind === "stock" || kind === "sync-stock") {
    return {
      icon: faBoxesStacked,
      accentClass: tone === "failed" ? "is-failed" : "is-stock",
      actionLabel: kind === "sync-stock" ? "Queue" : "Open",
    };
  }
  if (tone === "failed") {
    return {
      icon: faXmark,
      accentClass: "is-failed",
      actionLabel: "Open",
    };
  }
  if (tone === "pending") {
    return {
      icon: faCloudArrowUp,
      accentClass: "is-pending",
      actionLabel: "Open",
    };
  }
  return {
    icon: faClipboardList,
    accentClass: "is-neutral",
    actionLabel: "Open",
  };
};

const INITIAL_PURCHASE_STATUS = "paid";

const SECTION_CONFIG = {
  home: { title: "Control Hub", subtitle: "Simple daily flow for store staff." },
  inventory: { title: "Stock", subtitle: "Fast count updates from phone." },
  purchases: { title: "Purchases", subtitle: "Quick checkout from inventory." },
  offline: { title: "Offline Sync", subtitle: "Queued actions and retry status." },
};

function AdminWorkspace({ section = "home" }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const roleKey = normalizeAdminRole(user?.role);
  const isDriverUser = isDriverPortalRole(roleKey);
  const canViewHomeKpis = canAccessPrivilegedPortalArea(roleKey);
  const isWaterUser = isWaterPortalRole(roleKey);
  const canAccessCustomers = canAccessPortalCustomerDirectory(roleKey);
  const canAccessInventoryModule = canAccessPortalInventory(roleKey);
  const canAccessOrdersModule = canAccessPortalOrders(roleKey);
  const canAccessBookingsModule = canAccessPortalBookings(roleKey);
  const canAccessOfflineModule = canAccessPortalRoute(roleKey, DASHBOARD_PATHS.offline);
  const canAccessTimesheetsModule = canAccessPortalRoute(roleKey, "/admin/timesheets");
  const canAccessActivityFeed =
    canAccessOrdersModule
    || canAccessBookingsModule
    || canAccessInventoryModule
    || canAccessOfflineModule;

  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [usingInventorySnapshot, setUsingInventorySnapshot] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [customerError, setCustomerError] = useState("");
  const [usingCustomerSnapshot, setUsingCustomerSnapshot] = useState(false);

  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [queue, setQueue] = useState(loadOfflineQueue);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const sharedOfflineQueueStorage = useMemo(() => createIndexedDbQueueStorage(), []);
  const sharedSyncQueue = useSyncQueueSummary({
    storage: sharedOfflineQueueStorage,
    sourceApp: "reebs-portal",
    organizationId: user?.organizationId || user?.orgId || "",
    actorId: user?.id || user?.userId || "",
    enabled: Boolean((user?.organizationId || user?.orgId) && (user?.id || user?.userId)),
  });
  const [sharedQueuedResolvingId, setSharedQueuedResolvingId] = useState("");
  const {
    retry: retrySharedQueuedAction,
    retryingId: sharedQueuedRetryingId,
    error: sharedQueuedRetryError,
  } = useQueuedActionRetry({
    storage: sharedOfflineQueueStorage,
    onAfterChange: sharedSyncQueue.refresh,
  });
  const {
    cancel: cancelSharedQueuedAction,
    cancellingId: sharedQueuedCancellingId,
    error: sharedQueuedCancelError,
  } = useQueuedActionCancel({
    storage: sharedOfflineQueueStorage,
    onAfterChange: sharedSyncQueue.refresh,
  });
  const resolveSharedQueuedAction = useCallback(async (item) => {
    if (!item?.id) return;
    setSharedQueuedResolvingId(item.id);
    try {
      await markQueuedActionResolved(sharedOfflineQueueStorage, item, {
        resolution: "Marked resolved from REEBS offline sync review.",
      });
      await sharedSyncQueue.refresh();
    } finally {
      setSharedQueuedResolvingId("");
    }
  }, [sharedOfflineQueueStorage, sharedSyncQueue.refresh]);

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [quickQuantity, setQuickQuantity] = useState(1);
  const [stockBusyId, setStockBusyId] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedVariantIds, setSelectedVariantIds] = useState({});
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);

  const [surfaceError, setSurfaceError] = useState("");
  const [surfaceNotice, setSurfaceNotice] = useState("");
  const [kpiStats, setKpiStats] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState("");
  const [advancedAnalytics, setAdvancedAnalytics] = useState(null);
  const [advancedAnalyticsLoading, setAdvancedAnalyticsLoading] = useState(false);
  const [advancedAnalyticsError, setAdvancedAnalyticsError] = useState("");
  const [dashboardWindow, setDashboardWindow] = useState("30d");
  const [financialStats, setFinancialStats] = useState({
    cashflow: [],
    windowLabel: "",
    summary: { revenue: 0, netProfit: 0, operatingExpenses: 0, rentalIncome: 0 },
    automation: null,
  });
  const [previousFinancialStats, setPreviousFinancialStats] = useState({
    cashflow: [],
    windowLabel: "",
    summary: { revenue: 0, netProfit: 0, operatingExpenses: 0, rentalIncome: 0 },
    automation: null,
  });
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialError, setFinancialError] = useState("");
  const [stockActivity, setStockActivity] = useState([]);
  const [stockActivityLoading, setStockActivityLoading] = useState(false);
  const [stockActivityError, setStockActivityError] = useState("");
  const [workflowOrders, setWorkflowOrders] = useState([]);
  const [workflowBookings, setWorkflowBookings] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState("");
  const [homeUpdatedAt, setHomeUpdatedAt] = useState("");
  const [activityScope, setActivityScope] = useState("mine");
  const [assignedWorkFilter, setAssignedWorkFilter] = useState("");
  const [isAssignedWorkListVisible, setIsAssignedWorkListVisible] = useState(true);
  const [expandedAssignedWorkKey, setExpandedAssignedWorkKey] = useState("");
  const [directoryStats, setDirectoryStats] = useState({
    customers: 0,
    vendors: 0,
    avgLeadTime: 0,
    leadTimeCoverage: 0,
  });
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [activityItems, setActivityItems] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());
  const [sessionFallbackStartedAt, setSessionFallbackStartedAt] = useState(() => new Date());

  const profileName =
    user?.fullName ||
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Team member";
  const profileFirstName = getFirstName(user, profileName);

  const activeWindowConfig = useMemo(
    () => HOME_WINDOW_OPTIONS.find((option) => option.key === dashboardWindow) || HOME_WINDOW_OPTIONS[2],
    [dashboardWindow]
  );

  const activeSection = section in SECTION_CONFIG ? section : "home";
  const sectionConfig = SECTION_CONFIG[activeSection];
  const sectionTitle =
    activeSection === "home"
      ? profileFirstName
        ? `Welcome ${profileFirstName}!`
        : "Welcome"
      : sectionConfig.title;
  const sectionSubtitle =
    activeSection === "home"
      ? currentDateTime.toLocaleString("en-GB", {
          weekday: "long",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : sectionConfig.subtitle;

  useEffect(() => {
    if (activeSection !== "home" || typeof window === "undefined") return undefined;
    const updateDateTime = () => setCurrentDateTime(new Date());
    updateDateTime();
    const timer = window.setInterval(updateDateTime, 1000);
    return () => window.clearInterval(timer);
  }, [activeSection]);

  useEffect(() => {
    setSessionFallbackStartedAt(new Date());
  }, [user?.id]);

  useEffect(() => {
    setActivityScope(canViewHomeKpis ? "team" : "mine");
  }, [canViewHomeKpis, user?.id]);

  const postJson = useCallback(async (url, payload) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Request failed.");
    }
    return data || {};
  }, []);

  const loadInventory = useCallback(async ({ quiet = false } = {}) => {
    if (!canAccessInventoryModule) {
      setInventory([]);
      setUsingInventorySnapshot(false);
      setInventoryError("");
      if (!quiet) setInventoryLoading(false);
      return true;
    }
    if (!quiet) {
      setInventoryLoading(true);
      setInventoryError("");
    }
    try {
      const response = await fetch("/api/inventory");
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load stock.");
      }
      const items = Array.isArray(payload) ? payload : [];
      setInventory(items);
      saveInventorySnapshot(items);
      setUsingInventorySnapshot(false);
      return true;
    } catch (error) {
      const snapshot = loadInventorySnapshot();
      if (snapshot.length > 0) {
        setInventory(snapshot);
        setUsingInventorySnapshot(true);
        if (!quiet) {
          setInventoryError("Using saved stock snapshot. Sync when online.");
        }
      } else if (!quiet) {
        setInventoryError(error.message || "Unable to load stock.");
      }
      return false;
    } finally {
      if (!quiet) setInventoryLoading(false);
    }
  }, [canAccessInventoryModule]);

  const loadCustomers = useCallback(async () => {
    if (!canAccessCustomers) {
      setCustomers([]);
      setUsingCustomerSnapshot(false);
      setCustomerError("");
      return true;
    }
    setCustomerError("");
    try {
      const response = await fetch("/api/customers");
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load customers.");
      }
      const nextCustomers = Array.isArray(payload) ? payload : [];
      setCustomers(nextCustomers);
      saveCustomerSnapshot(nextCustomers);
      setUsingCustomerSnapshot(false);
      return true;
    } catch (error) {
      const snapshot = loadCustomerSnapshot();
      if (snapshot.length > 0) {
        setCustomers(snapshot);
        setUsingCustomerSnapshot(true);
        setCustomerError("Using saved customer list.");
      } else {
        setCustomerError(error.message || "Unable to load customers.");
      }
      return false;
    }
  }, [canAccessCustomers]);

  const setProductQuantity = useCallback((productId, nextQty, options = {}) => {
    const safeQty = Math.max(0, Number(nextQty) || 0);
    const variantId = Number(options?.variantId);
    const variantAvailableQty = Number(options?.variantAvailableQty);

    setInventory((prev) =>
      prev.map((item) => {
        if (Number(item.id) !== Number(productId)) return item;
        if (!Number.isFinite(variantId) || variantId <= 0) {
          return { ...item, quantity: safeQty, stock: safeQty };
        }

        const variants = (Array.isArray(item.variants) ? item.variants : []).map((variant) => {
          if (Number(variant.id) !== variantId) return variant;
          const reservedQty = Math.max(0, Number(variant.reservedQty) || 0);
          return {
            ...variant,
            stockQty: safeQty,
            availableQty: Number.isFinite(variantAvailableQty)
              ? Math.max(0, variantAvailableQty)
              : Math.max(safeQty - reservedQty, 0),
          };
        });
        const totalQty = variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stockQty) || 0), 0);
        return { ...item, variants, quantity: totalQty, stock: totalQty };
      })
    );
  }, []);

  const adjustProductQuantity = useCallback((productId, delta, options = {}) => {
    const variantId = Number(options?.variantId);
    setInventory((prev) =>
      prev.map((item) => {
        if (Number(item.id) !== Number(productId)) return item;
        if (!Number.isFinite(variantId) || variantId <= 0) {
          const nextQty = Math.max(0, getQuantity(item) + delta);
          return { ...item, quantity: nextQty, stock: nextQty };
        }

        const variants = (Array.isArray(item.variants) ? item.variants : []).map((variant) => {
          if (Number(variant.id) !== variantId) return variant;
          const nextStock = Math.max(0, (Number(variant.stockQty) || 0) + delta);
          const reservedQty = Math.max(0, Number(variant.reservedQty) || 0);
          return {
            ...variant,
            stockQty: nextStock,
            availableQty: Math.max(nextStock - reservedQty, 0),
          };
        });
        const totalQty = variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stockQty) || 0), 0);
        return { ...item, variants, quantity: totalQty, stock: totalQty };
      })
    );
  }, []);

  const queueAction = useCallback((queueItem) => {
    setQueue((prev) => [...prev, queueItem]);
  }, []);

  const sendStockUpdate = useCallback(
    async (payload) => postJson("/api/stock", payload),
    [postJson]
  );

  const sendPurchase = useCallback(
    async (payload) => postJson("/api/orders", payload),
    [postJson]
  );

  const normalizeKpiStats = useCallback((payload) => {
    if (!payload || typeof payload !== "object") return null;
    const list = (items, mapFn) => (Array.isArray(items) ? items.map(mapFn) : []);
    return {
      windowDays: payload.windowDays ?? 30,
      orders: toNumber(payload.orders),
      revenue: toNumber(payload.revenue),
      units: toNumber(payload.units),
      bookings: toNumber(payload.bookings),
      bookingRevenue: toNumber(payload.bookingRevenue),
      operatingExpenses: toNumber(payload.operatingExpenses),
      operatingExpensesWindow: toNumber(payload.operatingExpensesWindow),
      operatingExpensesTotal: toNumber(payload.operatingExpensesTotal),
      expenseWindowLabel: payload.expenseWindowLabel || "",
      maintenanceOpen: toNumber(payload.maintenanceOpen),
      maintenanceCost: toNumber(payload.maintenanceCost),
      lockedInNextQuarter: toNumber(payload.lockedInNextQuarter),
      nextQuarterLabel: payload.nextQuarterLabel || "Next quarter",
      conflicts: Array.isArray(payload.conflicts) ? payload.conflicts : [],
      topRentalBookings: list(payload.topRentalBookings, (row) => ({
        ...row,
        units: toNumber(row.units),
        revenue: toNumber(row.revenue),
      })),
      topProducts: list(payload.topProducts, (row) => ({
        ...row,
        units: toNumber(row.units),
      })),
      lowStockCount: toNumber(payload.lowStockCount),
      lowStockItems: list(payload.lowStockItems, (row) => ({
        ...row,
        stock: toNumber(row.stock),
      })),
      inventoryValue: toNumber(payload.inventoryValue),
      productCount: toNumber(payload.productCount),
      retailRevenue: toNumber(payload.retailRevenue),
      rentalRevenue: toNumber(payload.rentalRevenue),
      categories: list(payload.categories, (row) => ({
        category: row.category,
        count: toNumber(row.count),
      })),
      velocity: list(payload.velocity, (row) => ({
        label: row.label,
        stockIn: toNumber(row.stockIn),
        stockOut: toNumber(row.stockOut),
      })),
    };
  }, []);

  const normalizeFinancialStats = useCallback((payload) => {
    if (!payload || typeof payload !== "object") {
      return {
        cashflow: [],
        windowLabel: "",
        summary: { revenue: 0, netProfit: 0, operatingExpenses: 0, rentalIncome: 0 },
        automation: null,
      };
    }
    return {
      windowLabel: payload.windowLabel || payload.expenseWindowLabel || "This month",
      summary: {
        revenue: toNumber(payload?.summary?.revenue),
        netProfit: toNumber(payload?.summary?.netProfit),
        operatingExpenses: toNumber(payload?.summary?.operatingExpenses),
        rentalIncome: toNumber(payload?.summary?.rentalIncome),
      },
      automation: payload?.automation || null,
      startDate: payload?.startDate || "",
      endDate: payload?.endDate || "",
      cashflow: Array.isArray(payload.cashflow)
        ? payload.cashflow
            .map((row) => ({
              date: row?.date,
              revenue: toNumber(row?.revenue),
            }))
            .filter((row) => row.date)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
        : [],
    };
  }, []);

  const normalizeStockActivity = useCallback((payload) => {
    const rows = Array.isArray(payload?.months) ? payload.months : [];
    return rows
      .map((row) => ({
        monthKey: row?.month_key || "",
        monthStart: row?.month_start || "",
        label: formatMonthLabel(row?.month_start || row?.month_key),
        stockIn: toNumber(row?.stock_in),
        stockOut: toNumber(row?.stock_out),
      }))
      .filter((row) => row.monthKey || row.monthStart)
      .sort((a, b) => new Date(a.monthStart || a.monthKey) - new Date(b.monthStart || b.monthKey));
  }, []);

  const normalizeActivityItems = useCallback((payload) => {
    const details =
      payload?.details && typeof payload.details === "object" ? payload.details : {};
    const activityScopeKey = String(payload?.scope || "mine").trim().toLowerCase();
    const formatStatus = (value, fallback = "") => {
      const normalized = String(value || "").trim();
      if (!normalized) return fallback;
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    };

    const orders = canAccessOrdersModule && Array.isArray(details.orders)
      ? details.orders.map((order) => ({
          id: `activity-order-${order.id}`,
          kind: "order",
          label: order.orderNumber ? `Order ${order.orderNumber}` : `Order #${order.id}`,
          meta: [
            order.customerName ? `Customer: ${order.customerName}` : "",
            formatStatus(order.status, "Order"),
            activityScopeKey === "team"
              ? `By ${order.updatedByName || order.createdByName || order.assignedUserName || "Team"}`
              : "",
          ]
            .filter(Boolean)
            .join(" • "),
          createdAt: order.lastModifiedAt || order.orderDate || order.deliveryDate,
          tone: "synced",
          badgeLabel: "Order",
          href: `${DASHBOARD_PATHS.orders}?id=${order.id}`,
          actor: order.updatedByName || order.createdByName || order.assignedUserName || "",
        }))
      : [];

    const bookings = canAccessBookingsModule && Array.isArray(details.bookings)
      ? details.bookings.map((booking) => ({
          id: `activity-booking-${booking.id}`,
          kind: "booking",
          label: `Booking #${booking.id}`,
          meta: [
            booking.customerName ? `Client: ${booking.customerName}` : "",
            formatStatus(booking.status, "Booking"),
            activityScopeKey === "team"
              ? `By ${booking.updatedByName || booking.createdByName || booking.assignedUserName || "Team"}`
              : "",
          ]
            .filter(Boolean)
            .join(" • "),
          createdAt: booking.lastModifiedAt || booking.eventDate,
          tone: "synced",
          badgeLabel: "Booking",
          href: `/admin/bookings?id=${booking.id}`,
          actor: booking.updatedByName || booking.createdByName || booking.assignedUserName || "",
        }))
      : [];

    const stockMovements = canAccessInventoryModule && Array.isArray(details.stockMovements)
      ? details.stockMovements.map((movement) => {
          const isStockOut = String(movement.type || "").trim().toLowerCase() === "stockout";
          const movementLabel = isStockOut ? "Stock out" : "Stock in";
          return {
            id: `activity-stock-${movement.id}`,
            kind: "stock",
            label: movement.productName
              ? `${movementLabel}: ${movement.productName}`
              : movementLabel,
            meta: [
              Number.isFinite(Number(movement.quantity))
                ? `${Number(movement.quantity)} unit${Number(movement.quantity) === 1 ? "" : "s"}`
                : "",
              movement.reference ? `Ref: ${movement.reference}` : "",
              activityScopeKey === "team"
                ? `By ${movement.performedByName || "Team"}`
                : "",
            ]
              .filter(Boolean)
              .join(" • "),
            createdAt: movement.createdAt || movement.date,
            tone: "synced",
            badgeLabel: "Stock",
            href: DASHBOARD_PATHS.inventoryActivity,
            actor: movement.performedByName || "",
          };
        })
      : [];

    return [...orders, ...bookings, ...stockMovements]
      .sort(
        (a, b) =>
          new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
      )
      .slice(0, 8);
  }, [canAccessBookingsModule, canAccessInventoryModule, canAccessOrdersModule]);

  const fetchWorkflowData = useCallback(async () => {
    if (!user?.id) {
      setWorkflowOrders([]);
      setWorkflowBookings([]);
      setTeamUsers([]);
      setWorkflowError("");
      return;
    }

    setWorkflowLoading(true);
    setWorkflowError("");
    try {
      const [ordersRes, bookingsRes, usersRes] = await Promise.all([
        canAccessOrdersModule
          ? fetch(`/api/orders?ts=${Date.now()}`)
          : Promise.resolve(null),
        canAccessBookingsModule
          ? fetch(`/api/bookings?ts=${Date.now()}`)
          : Promise.resolve(null),
        canViewHomeKpis
          ? fetch(`/api/users?ts=${Date.now()}`)
          : Promise.resolve(null),
      ]);
      const [ordersData, bookingsData, usersData] = await Promise.all([
        ordersRes?.json().catch(() => null) || Promise.resolve(null),
        bookingsRes?.json().catch(() => null) || Promise.resolve(null),
        usersRes?.json().catch(() => null) || Promise.resolve(null),
      ]);

      if (ordersRes && !ordersRes.ok) {
        throw new Error(ordersData?.error || "Failed to load orders.");
      }
      if (bookingsRes && !bookingsRes.ok) {
        throw new Error(bookingsData?.error || "Failed to load bookings.");
      }
      if (canViewHomeKpis && usersRes && !usersRes.ok) {
        throw new Error(usersData?.error || "Failed to load team members.");
      }

      setWorkflowOrders(canAccessOrdersModule && Array.isArray(ordersData) ? ordersData : []);
      setWorkflowBookings(canAccessBookingsModule && Array.isArray(bookingsData) ? bookingsData : []);
      setTeamUsers(canViewHomeKpis && Array.isArray(usersData) ? usersData : []);
      setHomeUpdatedAt(new Date().toISOString());
    } catch (error) {
      setWorkflowError(error.message || "Unable to load dashboard workflow data.");
    } finally {
      setWorkflowLoading(false);
    }
  }, [canAccessBookingsModule, canAccessOrdersModule, canViewHomeKpis, user?.id]);

  const fetchHomeKpis = useCallback(async () => {
    if (!canViewHomeKpis) {
      setKpiStats(null);
      setKpiError("");
      return;
    }
    setKpiLoading(true);
    setKpiError("");
    try {
      const response = await fetch(
        `/api/orderStats?window=${activeWindowConfig.orderStatsWindow}&ts=${Date.now()}`
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load KPI data.");
      }
      setKpiStats(normalizeKpiStats(payload));
    } catch (error) {
      setKpiError(error.message || "Unable to load KPIs.");
    } finally {
      setKpiLoading(false);
    }
  }, [activeWindowConfig.orderStatsWindow, canViewHomeKpis, normalizeKpiStats]);

  const fetchAdvancedAnalytics = useCallback(async () => {
    if (!canViewHomeKpis) {
      setAdvancedAnalytics(null);
      setAdvancedAnalyticsError("");
      return;
    }
    setAdvancedAnalyticsLoading(true);
    setAdvancedAnalyticsError("");
    try {
      const response = await reebsApiResponse(`/api/advancedAnalytics?ts=${Date.now()}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load advanced insights.");
      }
      setAdvancedAnalytics(payload && typeof payload === "object" ? payload : null);
    } catch (error) {
      setAdvancedAnalyticsError(error.message || "Unable to load advanced insights.");
    } finally {
      setAdvancedAnalyticsLoading(false);
    }
  }, [canViewHomeKpis]);

  const fetchFinancialStats = useCallback(async () => {
    if (!canViewHomeKpis) {
      const emptyState = {
        cashflow: [],
        windowLabel: "",
        summary: { revenue: 0, netProfit: 0, operatingExpenses: 0, rentalIncome: 0 },
        automation: null,
      };
      setFinancialStats(emptyState);
      setPreviousFinancialStats(emptyState);
      setFinancialError("");
      return;
    }
    setFinancialLoading(true);
    setFinancialError("");
    try {
      const [currentResponse, previousResponse] = await Promise.all([
        fetch(
          `/api/financials?window=${activeWindowConfig.financialWindow}&ts=${Date.now()}`
        ),
        fetch(
          `/api/financials?window=${activeWindowConfig.previousFinancialWindow}&ts=${Date.now()}`
        ),
      ]);
      const [currentPayload, previousPayload] = await Promise.all([
        currentResponse.json().catch(() => null),
        previousResponse.json().catch(() => null),
      ]);
      if (!currentResponse.ok) {
        throw new Error(currentPayload?.error || "Failed to load revenue trend.");
      }
      if (!previousResponse.ok) {
        throw new Error(previousPayload?.error || "Failed to load previous financial window.");
      }
      setFinancialStats(normalizeFinancialStats(currentPayload));
      setPreviousFinancialStats(normalizeFinancialStats(previousPayload));
    } catch (error) {
      const emptyState = {
        cashflow: [],
        windowLabel: "",
        summary: { revenue: 0, netProfit: 0, operatingExpenses: 0, rentalIncome: 0 },
        automation: null,
      };
      setFinancialStats(emptyState);
      setPreviousFinancialStats(emptyState);
      setFinancialError(error.message || "Unable to load revenue trend.");
    } finally {
      setFinancialLoading(false);
    }
  }, [
    activeWindowConfig.financialWindow,
    activeWindowConfig.previousFinancialWindow,
    canViewHomeKpis,
    normalizeFinancialStats,
  ]);

  const fetchStockActivity = useCallback(async () => {
    if (!canViewHomeKpis) {
      setStockActivity([]);
      setStockActivityError("");
      return;
    }
    setStockActivityLoading(true);
    setStockActivityError("");
    try {
      const response = await fetch(`/api/stockActivity?ts=${Date.now()}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load stock activity.");
      }
      setStockActivity(normalizeStockActivity(payload));
    } catch (error) {
      setStockActivity([]);
      setStockActivityError(error.message || "Unable to load stock activity.");
    } finally {
      setStockActivityLoading(false);
    }
  }, [canViewHomeKpis, normalizeStockActivity]);

  const fetchDirectoryKpis = useCallback(async () => {
    if (!canViewHomeKpis) {
      setDirectoryStats({
        customers: 0,
        vendors: 0,
        avgLeadTime: 0,
        leadTimeCoverage: 0,
      });
      setDirectoryError("");
      return;
    }

    setDirectoryLoading(true);
    setDirectoryError("");
    try {
      const vendorsRes = await fetch("/api/vendors");
      const vendorsData = await vendorsRes.json().catch(() => null);
      if (!vendorsRes.ok) {
        throw new Error(vendorsData?.error || "Failed to load vendors.");
      }
      const vendorRows = Array.isArray(vendorsData) ? vendorsData : [];
      const leadTimes = vendorRows
        .map((vendor) => Number(vendor.leadTimeDays))
        .filter((value) => Number.isFinite(value) && value >= 0);
      const avgLeadTime = leadTimes.length
        ? Math.round(leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length)
        : 0;
      setDirectoryStats({
        customers: customers.length,
        vendors: vendorRows.length,
        avgLeadTime,
        leadTimeCoverage: leadTimes.length,
      });
    } catch (error) {
      setDirectoryError(error.message || "Unable to load directory KPIs.");
    } finally {
      setDirectoryLoading(false);
    }
  }, [canViewHomeKpis, customers.length]);

  const fetchActivityFeed = useCallback(async () => {
    if (!user?.id) {
      setActivityItems([]);
      setActivityError("");
      return;
    }
    if (!canAccessActivityFeed) {
      setActivityItems([]);
      setActivityError("");
      return;
    }
    setActivityLoading(true);
    setActivityError("");
    try {
      const params = new URLSearchParams({
        details: "1",
        limit: canViewHomeKpis && activityScope === "team" ? "24" : "18",
        scope: canViewHomeKpis ? activityScope : "mine",
        ts: String(Date.now()),
      });
      const response = await fetch(`/api/userStats?${params.toString()}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.error
            || (activityScope === "team"
              ? "Unable to load team activity."
              : "Unable to load your activity.")
        );
      }
      setActivityItems(normalizeActivityItems(payload));
    } catch (error) {
      setActivityItems([]);
      setActivityError(
        error.message
          || (activityScope === "team"
            ? "Unable to load team activity."
            : "Unable to load your activity.")
      );
    } finally {
      setActivityLoading(false);
    }
  }, [activityScope, canAccessActivityFeed, canViewHomeKpis, normalizeActivityItems, user?.id]);

  const syncQueue = useCallback(
    async ({ silent = false } = {}) => {
      if (syncingQueue) return;
      if (!isOnline) {
        if (!silent) setSurfaceError("Device is offline. Sync paused.");
        return;
      }
      const pending = queue.filter((item) => item.status !== "synced");
      if (!pending.length) {
        if (!silent) setSurfaceNotice("Nothing to sync.");
        return;
      }

      setSyncingQueue(true);
      if (!silent) {
        setSurfaceError("");
        setSurfaceNotice("");
      }

      const nextQueue = [];
      let syncedCount = 0;
      let failedCount = 0;

      for (const item of queue) {
        if (item.status === "synced") {
          nextQueue.push(item);
          continue;
        }
        try {
          if (item.type === "stock") {
            await sendStockUpdate(item.payload);
          } else if (item.type === "purchase") {
            await sendPurchase(item.payload);
          } else {
            throw new Error("Unsupported queue action.");
          }
          syncedCount += 1;
          nextQueue.push({
            ...item,
            status: "synced",
            syncedAt: new Date().toISOString(),
            attempts: (item.attempts || 0) + 1,
            lastError: "",
          });
        } catch (error) {
          failedCount += 1;
          nextQueue.push({
            ...item,
            status: "failed",
            attempts: (item.attempts || 0) + 1,
            lastError: error.message || "Sync failed.",
          });
        }
      }

      setQueue(nextQueue);
      if (syncedCount > 0) {
        await loadInventory({ quiet: true });
        await Promise.all([
          fetchActivityFeed(),
          fetchWorkflowData(),
          canViewHomeKpis ? fetchHomeKpis() : Promise.resolve(),
          canViewHomeKpis ? fetchFinancialStats() : Promise.resolve(),
          canViewHomeKpis ? fetchStockActivity() : Promise.resolve(),
        ]);
      }
      if (!silent) {
        if (failedCount > 0) {
          setSurfaceError(`Synced ${syncedCount}. ${failedCount} action(s) still pending.`);
        } else {
          setSurfaceNotice(`Synced ${syncedCount} action(s).`);
        }
      }
      setSyncingQueue(false);
    },
    [
      canViewHomeKpis,
      fetchActivityFeed,
      fetchFinancialStats,
      fetchHomeKpis,
      fetchStockActivity,
      fetchWorkflowData,
      isOnline,
      loadInventory,
      queue,
      sendPurchase,
      sendStockUpdate,
      syncingQueue,
    ]
  );

  useEffect(() => {
    document.body.classList.add("admin-theme", "aw-theme");
    return () => {
      document.body.classList.remove("admin-theme", "aw-theme", "aw-home-bg");
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("aw-home-bg", activeSection === "home");
    return () => {
      document.body.classList.remove("aw-home-bg");
    };
  }, [activeSection]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    saveOfflineQueue(queue);
  }, [queue]);

  useEffect(() => {
    loadInventory();
    loadCustomers();
  }, [loadCustomers, loadInventory]);

  useEffect(() => {
    if (activeSection !== "home") return;
    fetchWorkflowData();
    fetchActivityFeed();
  }, [activeSection, fetchActivityFeed, fetchWorkflowData]);

  useEffect(() => {
    if (activeSection !== "home" || !canViewHomeKpis) return;
    fetchHomeKpis();
    fetchAdvancedAnalytics();
    fetchFinancialStats();
    fetchStockActivity();
    fetchDirectoryKpis();
  }, [
    activeSection,
    canViewHomeKpis,
    fetchAdvancedAnalytics,
    fetchDirectoryKpis,
    fetchFinancialStats,
    fetchHomeKpis,
    fetchStockActivity,
  ]);

  useEffect(() => {
    if (activeSection !== "home" || !user?.id || typeof window === "undefined") return undefined;
    const timer = window.setInterval(() => {
      fetchActivityFeed();
      fetchWorkflowData();
      if (canViewHomeKpis) {
        fetchHomeKpis();
        fetchFinancialStats();
      }
    }, 60000);
    return () => window.clearInterval(timer);
  }, [activeSection, canViewHomeKpis, fetchActivityFeed, fetchFinancialStats, fetchHomeKpis, fetchWorkflowData, user?.id]);

  useEffect(() => {
    if (!isOnline) return;
    const hasPending = queue.some((item) => item.status === "pending");
    if (hasPending) {
      syncQueue({ silent: true });
    }
  }, [isOnline, queue, syncQueue]);

  const inventoryLowStockItems = useMemo(
    () => inventory.filter((item) => getQuantity(item) <= LOW_STOCK_THRESHOLD),
    [inventory]
  );
  const pendingQueue = useMemo(
    () => queue.filter((item) => item.status !== "synced"),
    [queue]
  );
  const failedQueueCount = useMemo(
    () => queue.filter((item) => item.status === "failed").length,
    [queue]
  );
  const syncConflictCount = useMemo(
    () => queue.filter((item) => item.lastError?.includes("conflict") || item.lastError?.includes("duplicate")).length,
    [queue]
  );
  const syncedQueueCount = useMemo(
    () => queue.filter((item) => item.status === "synced").length,
    [queue]
  );
  const currentUserId = normalizeIdFilter(user?.id);
  const homeWindowRanges = useMemo(
    () => resolveHomeWindowRanges(dashboardWindow, currentDateTime),
    [currentDateTime, dashboardWindow]
  );
  const currentWindowOrders = useMemo(
    () =>
      workflowOrders.filter((order) =>
        isDateInRange(order?.orderDate || order?.lastModifiedAt, homeWindowRanges.currentStart, homeWindowRanges.currentEnd)
      ),
    [homeWindowRanges.currentEnd, homeWindowRanges.currentStart, workflowOrders]
  );
  const previousWindowOrders = useMemo(
    () =>
      workflowOrders.filter((order) =>
        isDateInRange(order?.orderDate || order?.lastModifiedAt, homeWindowRanges.previousStart, homeWindowRanges.previousEnd)
      ),
    [homeWindowRanges.previousEnd, homeWindowRanges.previousStart, workflowOrders]
  );
  const currentWindowBookings = useMemo(
    () =>
      workflowBookings.filter((booking) =>
        isDateInRange(booking?.eventDate || booking?.lastModifiedAt, homeWindowRanges.currentStart, homeWindowRanges.currentEnd)
      ),
    [homeWindowRanges.currentEnd, homeWindowRanges.currentStart, workflowBookings]
  );
  const previousWindowBookings = useMemo(
    () =>
      workflowBookings.filter((booking) =>
        isDateInRange(booking?.eventDate || booking?.lastModifiedAt, homeWindowRanges.previousStart, homeWindowRanges.previousEnd)
      ),
    [homeWindowRanges.previousEnd, homeWindowRanges.previousStart, workflowBookings]
  );
  const currentWindowCustomers = useMemo(
    () =>
      customers.filter((customer) =>
        isDateInRange(customer?.createdAt, homeWindowRanges.currentStart, homeWindowRanges.currentEnd)
      ),
    [customers, homeWindowRanges.currentEnd, homeWindowRanges.currentStart]
  );
  const previousWindowCustomers = useMemo(
    () =>
      customers.filter((customer) =>
        isDateInRange(customer?.createdAt, homeWindowRanges.previousStart, homeWindowRanges.previousEnd)
      ),
    [customers, homeWindowRanges.previousEnd, homeWindowRanges.previousStart]
  );
  const openWorkflowOrders = useMemo(
    () => workflowOrders.filter((order) => !isOrderClosed(order?.status)),
    [workflowOrders]
  );
  const openWorkflowBookings = useMemo(
    () => workflowBookings.filter((booking) => !isBookingClosed(booking?.status)),
    [workflowBookings]
  );
  const myOpenOrders = useMemo(
    () =>
      openWorkflowOrders.filter((order) =>
        [
          order?.assignedUserId,
          order?.createdByUserId,
          order?.updatedByUserId,
        ].some((value) => normalizeIdFilter(value) === currentUserId)
      ),
    [currentUserId, openWorkflowOrders]
  );
  const myOpenBookings = useMemo(
    () =>
      openWorkflowBookings.filter((booking) =>
        [
          booking?.assignedUserId,
          booking?.createdByUserId,
          booking?.updatedByUserId,
        ].some((value) => normalizeIdFilter(value) === currentUserId)
      ),
    [currentUserId, openWorkflowBookings]
  );
  const myDueTodayOrders = useMemo(
    () => myOpenOrders.filter((order) => isToday(getOrderWorkDate(order))),
    [myOpenOrders]
  );
  const myDueTodayBookings = useMemo(
    () => myOpenBookings.filter((booking) => isToday(getBookingWorkDate(booking))),
    [myOpenBookings]
  );
  const myOverdueOrders = useMemo(
    () => myOpenOrders.filter((order) => isOverdue(getOrderWorkDate(order))),
    [myOpenOrders]
  );
  const myOverdueBookings = useMemo(
    () => myOpenBookings.filter((booking) => isOverdue(getBookingWorkDate(booking))),
    [myOpenBookings]
  );
  const overdueOrders = useMemo(
    () => openWorkflowOrders.filter((order) => isOverdue(getOrderWorkDate(order))),
    [openWorkflowOrders]
  );
  const overdueBookings = useMemo(
    () => openWorkflowBookings.filter((booking) => isOverdue(getBookingWorkDate(booking))),
    [openWorkflowBookings]
  );
  const pendingConfirmationBookings = useMemo(
    () =>
      openWorkflowBookings.filter((booking) => {
        const normalized = String(booking?.status || "").trim().toLowerCase();
        return normalized === "pending" && !isOverdue(getBookingWorkDate(booking));
      }),
    [openWorkflowBookings]
  );
  const approvalItems = useMemo(() => {
    if (!canViewHomeKpis) return [];
    const nextItems = [];
    workflowOrders.forEach((order) => {
      const status = String(order?.status || "").trim().toLowerCase();
      const amount = toNumber(order?.total);
      if (status !== "pending" || amount < APPROVAL_ORDER_MIN) return;
      nextItems.push({
        key: `order-${order.id}`,
        type: "order",
        id: order.id,
        title: order.orderNumber || `Order #${order.id}`,
        meta: order.customerName ? `Customer: ${order.customerName}` : "High-value order",
        amount,
        date: order.orderDate || order.lastModifiedAt,
        reason: "High-value order still waiting for approval",
        ageLabel: formatRelativeTime(order.orderDate || order.lastModifiedAt),
        href: buildPathWithParams(DASHBOARD_PATHS.orderApprovals, { id: order.id }),
      });
    });
    workflowBookings.forEach((booking) => {
      const status = String(booking?.status || "").trim().toLowerCase();
      const amount = toNumber(booking?.totalAmount) / 100;
      if (status !== "pending" || amount < APPROVAL_BOOKING_MIN) return;
      nextItems.push({
        key: `booking-${booking.id}`,
        type: "booking",
        id: booking.id,
        title: `Booking #${booking.id}`,
        meta: booking.customerName ? `Client: ${booking.customerName}` : "High-value booking",
        amount,
        date: booking.eventDate || booking.lastModifiedAt,
        reason: "Rental booking value is above the approval threshold",
        ageLabel: formatRelativeTime(booking.eventDate || booking.lastModifiedAt),
        href: buildPathWithParams(DASHBOARD_PATHS.bookingsPending, { id: booking.id }),
      });
    });
    return nextItems
      .sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      })
      .slice(0, 6);
  }, [canViewHomeKpis, workflowBookings, workflowOrders]);

  const kpiLowStockItems = useMemo(() => kpiStats?.lowStockItems || [], [kpiStats]);
  const operatingExpensesWindow =
    kpiStats?.operatingExpensesWindow ?? kpiStats?.operatingExpenses ?? 0;
  const totalRevenue = (kpiStats?.revenue ?? 0) + (kpiStats?.bookingRevenue ?? 0);
  const netAfterExpenses = totalRevenue - operatingExpensesWindow;
  const inventoryValue = kpiStats?.inventoryValue ?? 0;
  const retailRevenue = kpiStats?.retailRevenue ?? 0;
  const rentalRevenue = kpiStats?.rentalRevenue ?? 0;
  const revenueTotal = retailRevenue + rentalRevenue || 1;
  const revenueSplit = useMemo(
    () => ({
      retailPct: Math.round((retailRevenue / revenueTotal) * 100),
      rentalPct: Math.round((rentalRevenue / revenueTotal) * 100),
    }),
    [retailRevenue, rentalRevenue, revenueTotal]
  );
  const lowStockCount = kpiStats?.lowStockCount ?? kpiLowStockItems.length;
  const lockedInValue = kpiStats?.lockedInNextQuarter ?? 0;
  const bookingStockConflicts = useMemo(
    () =>
      Array.isArray(kpiStats?.conflicts)
        ? kpiStats.conflicts.map((row, index) => ({
            key: `conflict-${row?.product_id || index}-${row?.event_date || index}`,
            productId: row?.product_id,
            productName: row?.product_name || "Booked product",
            productStock: toNumber(row?.product_stock),
            reservedUnits: toNumber(row?.total_quantity),
            eventDate: row?.event_date,
            bookingIds: Array.isArray(row?.booking_ids) ? row.booking_ids : [],
          }))
        : [],
    [kpiStats?.conflicts]
  );
  const bookingConflictCount = bookingStockConflicts.length;
  const visibleBookingConflicts = useMemo(
    () => bookingStockConflicts.slice(0, 3),
    [bookingStockConflicts]
  );
  const netMarginPctRaw = totalRevenue > 0 ? Math.round((netAfterExpenses / totalRevenue) * 100) : 0;
  const netMarginPct = Math.max(0, Math.min(100, netMarginPctRaw));
  const inventoryItemCount = kpiStats?.productCount || inventory.length;
  const inventoryRiskPct = inventoryItemCount
    ? Math.min(100, Math.round((lowStockCount / Math.max(1, inventoryItemCount)) * 100))
    : 0;
  const lockedInPct = totalRevenue > 0 ? Math.min(100, Math.round((lockedInValue / totalRevenue) * 100)) : 0;
  const totalOrders = kpiStats?.orders ?? 0;
  const totalBookings = kpiStats?.bookings ?? 0;
  const avgOrderValue = totalOrders > 0 ? Math.round((kpiStats?.revenue ?? 0) / totalOrders) : 0;
  const dataFreshnessClass = useMemo(() => {
    if (!homeUpdatedAt) return "";
    const ageMs = Date.now() - new Date(homeUpdatedAt).getTime();
    if (ageMs < 5 * 60 * 1000) return "is-fresh";
    if (ageMs < 30 * 60 * 1000) return "is-aging";
    return "is-stale";
  }, [homeUpdatedAt]);
  const totalOverdueCount = (myOverdueOrders?.length ?? 0) + (myOverdueBookings?.length ?? 0);
  const revenueMixSegments = useMemo(
    () => [
      { key: "retail", label: "Retail", value: Math.max(0, retailRevenue), color: "#3b82f6" },
      { key: "rental", label: "Rental", value: Math.max(0, rentalRevenue), color: "#14b8a6" },
      { key: "expenses", label: "Expenses", value: Math.max(0, operatingExpensesWindow), color: "#f59e0b" },
    ].filter((s) => s.value > 0),
    [retailRevenue, rentalRevenue, operatingExpensesWindow]
  );
  const revenueMixTotal = useMemo(
    () => revenueMixSegments.reduce((sum, segment) => sum + segment.value, 0),
    [revenueMixSegments]
  );
  const revenueDonutRadius = 53;
  const revenueDonutCircumference = 2 * Math.PI * revenueDonutRadius;
  const revenueMixDonut = useMemo(() => {
    let consumed = 0;
    return revenueMixSegments.map((segment) => {
      const fraction = revenueMixTotal ? segment.value / revenueMixTotal : 0;
      const dash = fraction * revenueDonutCircumference;
      const offset = -consumed;
      consumed += dash;
      return { ...segment, dash, offset };
    });
  }, [revenueMixSegments, revenueMixTotal, revenueDonutCircumference]);
  const revenueTrend = useMemo(
    () => financialStats.cashflow || [],
    [financialStats.cashflow]
  );
  const revenueTrendSpark = useMemo(
    () => buildSparkline(revenueTrend, (entry) => entry.revenue),
    [revenueTrend]
  );
  const revenueTrendLatest = revenueTrend.length
    ? revenueTrend[revenueTrend.length - 1]?.revenue || 0
    : 0;
  const revenueTrendStart = revenueTrend.length ? revenueTrend[0]?.revenue || 0 : 0;
  const revenueTrendDelta = revenueTrendLatest - revenueTrendStart;
  const revenueTrendDeltaLabel = revenueTrend.length > 1
    ? `${revenueTrendDelta >= 0 ? "+" : "-"}${toCurrency(Math.abs(revenueTrendDelta), "GHS")} vs start`
    : "Waiting for more days";
  const revenueTrendRangeLabel = revenueTrend.length
    ? `${formatDate(revenueTrend[0]?.date)} to ${formatDate(revenueTrend[revenueTrend.length - 1]?.date)}`
    : "No cashflow points yet";
  const velocityTrend = useMemo(
    () => Array.isArray(kpiStats?.velocity) ? kpiStats.velocity.slice(-6) : [],
    [kpiStats?.velocity]
  );
  const velocityMax = useMemo(
    () =>
      Math.max(
        1,
        ...velocityTrend.map((entry) => Math.max(toNumber(entry.stockIn), toNumber(entry.stockOut)))
      ),
    [velocityTrend]
  );
  const velocityTotals = useMemo(
    () =>
      velocityTrend.reduce(
        (sum, entry) => ({
          stockIn: sum.stockIn + toNumber(entry.stockIn),
          stockOut: sum.stockOut + toNumber(entry.stockOut),
        }),
        { stockIn: 0, stockOut: 0 }
      ),
    [velocityTrend]
  );
  const stockActivityTotals = useMemo(
    () =>
      stockActivity.reduce(
        (sum, entry) => ({
          stockIn: sum.stockIn + toNumber(entry.stockIn),
          stockOut: sum.stockOut + toNumber(entry.stockOut),
        }),
        { stockIn: 0, stockOut: 0 }
      ),
    [stockActivity]
  );
  const stockActivitySpark = useMemo(
    () => buildSparkline(stockActivity, (entry) => toNumber(entry.stockIn) + toNumber(entry.stockOut)),
    [stockActivity]
  );
  const stockActivityRangeLabel = stockActivity.length
    ? `${stockActivity[0]?.label || ""} to ${stockActivity[stockActivity.length - 1]?.label || ""}`
    : "No monthly stock history yet";
  const operationsBars = useMemo(
    () => [
      { key: "orders", label: "Orders", value: kpiStats?.orders ?? 0, color: "#3b82f6" },
      { key: "bookings", label: "Bookings", value: kpiStats?.bookings ?? 0, color: "#14b8a6" },
      { key: "low-stock", label: "Low stock", value: lowStockCount, color: "#f59e0b" },
      { key: "conflicts", label: "Stock conflicts", value: bookingConflictCount, color: "#ef4444" },
      { key: "approvals", label: "Approvals", value: approvalItems.length, color: "#ef4444" },
      { key: "queue", label: "Queue pending", value: pendingQueue.length, color: "#8b5cf6" },
    ],
    [
      approvalItems.length,
      bookingConflictCount,
      kpiStats?.bookings,
      kpiStats?.orders,
      lowStockCount,
      pendingQueue.length,
    ]
  );
  const operationsBarsMax = useMemo(
    () => Math.max(1, ...operationsBars.map((entry) => entry.value)),
    [operationsBars]
  );
  const signedInAt = useMemo(() => {
    const raw = String(user?.authenticatedAt || user?.sessionCreatedAt || "").trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [user?.authenticatedAt, user?.sessionCreatedAt]);
  const sessionDurationLabel = useMemo(() => {
    const anchor = signedInAt || sessionFallbackStartedAt;
    return formatDuration(currentDateTime.getTime() - anchor.getTime());
  }, [currentDateTime, sessionFallbackStartedAt, signedInAt]);
  const pendingSyncActivity = useMemo(
    () =>
      canAccessOfflineModule
        ? queue
        .filter((item) => item.status !== "synced")
        .map((item) => ({
          id: `queue-${item.id}`,
          kind: item.type === "purchase" ? "sync-order" : item.type === "stock" ? "sync-stock" : "sync",
          label: item.label || "Queued activity",
          meta:
            item.type === "purchase"
              ? "Waiting to sync order"
              : item.type === "stock"
                ? "Waiting to sync stock update"
                : "Waiting to sync",
          createdAt: item.createdAt,
          tone: item.status === "failed" ? "failed" : "pending",
          badgeLabel: item.status === "failed" ? "Sync failed" : "Pending sync",
          href: DASHBOARD_PATHS.offline,
          lastError: item.lastError,
        }))
        : [],
    [canAccessOfflineModule, queue]
  );
  const recentStaffActivity = useMemo(
    () =>
      [...(activityScope === "team" ? [] : pendingSyncActivity), ...activityItems]
        .sort((a, b) => {
          const left = new Date(a?.createdAt || 0).getTime();
          const right = new Date(b?.createdAt || 0).getTime();
          return right - left;
        })
        .slice(0, 6),
    [
      activityItems,
      activityScope,
      pendingSyncActivity,
    ]
  );
  const revenueDeltaLabel = useMemo(
    () => formatDeltaText(
      financialStats.summary.revenue - previousFinancialStats.summary.revenue,
      (value) => toCurrency(value, "GHS")
    ),
    [financialStats.summary.revenue, previousFinancialStats.summary.revenue]
  );
  const netDeltaLabel = useMemo(
    () => formatDeltaText(
      financialStats.summary.netProfit - previousFinancialStats.summary.netProfit,
      (value) => toCurrency(value, "GHS")
    ),
    [financialStats.summary.netProfit, previousFinancialStats.summary.netProfit]
  );
  const stockForecastNote = useMemo(
    () => stockForecastLabel(directoryStats.avgLeadTime, lowStockCount),
    [directoryStats.avgLeadTime, lowStockCount]
  );
  const customersDeltaLabel = useMemo(
    () => formatDeltaText(
      currentWindowCustomers.length - previousWindowCustomers.length,
      (value) => pluralize(value, "customer")
    ),
    [currentWindowCustomers.length, previousWindowCustomers.length]
  );
  const allAssignedWorkItems = useMemo(() => {
    const items = [
      ...(canAccessOrdersModule
        ? myOpenOrders.map((order) => ({
        key: `my-order-${order.id}`,
        type: "Order",
        title: order.orderNumber || `Order #${order.id}`,
        subtitle: order.customerName ? `Customer: ${order.customerName}` : "Assigned order",
        when: getOrderWorkDate(order),
        overdue: isOverdue(getOrderWorkDate(order)),
        dueToday: isToday(getOrderWorkDate(order)),
        path: buildPathWithParams(DASHBOARD_PATHS.orders, { id: order.id, assigned: currentUserId }),
      }))
        : []),
      ...(canAccessBookingsModule
        ? myOpenBookings.map((booking) => ({
        key: `my-booking-${booking.id}`,
        type: "Booking",
        title: `Booking #${booking.id}`,
        subtitle: booking.customerName ? `Client: ${booking.customerName}` : "Assigned booking",
        when: getBookingWorkDate(booking),
        overdue: isOverdue(getBookingWorkDate(booking)),
        dueToday: isToday(getBookingWorkDate(booking)),
        path: buildPathWithParams("/admin/bookings", { id: booking.id, assigned: currentUserId }),
      }))
        : []),
    ];

    return items
      .sort((left, right) => {
        if (left.overdue !== right.overdue) return left.overdue ? -1 : 1;
        if (left.dueToday !== right.dueToday) return left.dueToday ? -1 : 1;
        return new Date(left.when || 0).getTime() - new Date(right.when || 0).getTime();
      });
  }, [canAccessBookingsModule, canAccessOrdersModule, currentUserId, myOpenBookings, myOpenOrders]);
  useEffect(() => {
    setAssignedWorkFilter((current) => {
      if (current) return current;
      if (myOverdueOrders.length + myOverdueBookings.length > 0) return "my-overdue";
      if (myOpenOrders.length > 0) return "my-orders";
      if (myOpenBookings.length > 0) return "my-bookings";
      if (myDueTodayOrders.length + myDueTodayBookings.length > 0) return "my-today";
      return "my-orders";
    });
  }, [
    myDueTodayBookings.length,
    myDueTodayOrders.length,
    myOpenBookings.length,
    myOpenOrders.length,
    myOverdueBookings.length,
    myOverdueOrders.length,
  ]);
  const handleAssignedWorkFilterClick = useCallback((nextFilter) => {
    const isSameFilter = assignedWorkFilter === nextFilter;
    setAssignedWorkFilter(nextFilter);
    setIsAssignedWorkListVisible(isSameFilter ? !isAssignedWorkListVisible : true);
  }, [assignedWorkFilter, isAssignedWorkListVisible]);
  const assignedWorkItems = useMemo(() => {
    switch (assignedWorkFilter) {
      case "my-bookings":
        return allAssignedWorkItems.filter((item) => item.type === "Booking");
      case "my-today":
        return allAssignedWorkItems.filter((item) => item.dueToday);
      case "my-overdue":
        return allAssignedWorkItems.filter((item) => item.overdue);
      case "my-orders":
      default:
        return allAssignedWorkItems.filter((item) => item.type === "Order");
    }
  }, [allAssignedWorkItems, assignedWorkFilter]);
  useEffect(() => {
    const availableKeys = new Set(assignedWorkItems.map((item) => item.key));
    setExpandedAssignedWorkKey((current) => {
      if (current && availableKeys.has(current)) {
        return current;
      }
      return assignedWorkItems.find((item) => item.overdue)?.key || "";
    });
  }, [assignedWorkItems]);
  const myWorkCards = useMemo(() => {
    const cards = [];

    if (canAccessOrdersModule) {
      cards.push({
        key: "my-orders",
        label: "My orders",
        value: myOpenOrders.length,
        meta: myOverdueOrders.length
          ? `${myOverdueOrders.length} overdue`
          : myDueTodayOrders.length
            ? `${myDueTodayOrders.length} due today`
            : "No order backlog",
        onClick: () => handleAssignedWorkFilterClick("my-orders"),
        isActive: assignedWorkFilter === "my-orders",
      });
    }

    if (canAccessBookingsModule) {
      cards.push({
        key: "my-bookings",
        label: "My bookings",
        value: myOpenBookings.length,
        meta: myOverdueBookings.length
          ? `${myOverdueBookings.length} overdue`
          : myDueTodayBookings.length
            ? `${myDueTodayBookings.length} due today`
            : "No booking backlog",
        onClick: () => handleAssignedWorkFilterClick("my-bookings"),
        isActive: assignedWorkFilter === "my-bookings",
      });
    }

    if (canAccessOrdersModule || canAccessBookingsModule) {
      const todayMeta = [
        canAccessOrdersModule ? `${myDueTodayOrders.length} orders` : "",
        canAccessBookingsModule ? `${myDueTodayBookings.length} bookings` : "",
      ].filter(Boolean).join(" • ");
      const overdueMeta = [
        canAccessOrdersModule ? `${myOverdueOrders.length} orders` : "",
        canAccessBookingsModule ? `${myOverdueBookings.length} bookings` : "",
      ].filter(Boolean).join(" • ");

      cards.push(
        {
          key: "my-today",
          label: "Due today",
          value:
            (canAccessOrdersModule ? myDueTodayOrders.length : 0)
            + (canAccessBookingsModule ? myDueTodayBookings.length : 0),
          meta: todayMeta,
          onClick: () => handleAssignedWorkFilterClick("my-today"),
          isActive: assignedWorkFilter === "my-today",
        },
        {
          key: "my-overdue",
          label: "Overdue",
          value:
            (canAccessOrdersModule ? myOverdueOrders.length : 0)
            + (canAccessBookingsModule ? myOverdueBookings.length : 0),
          meta: overdueMeta,
          onClick: () => handleAssignedWorkFilterClick("my-overdue"),
          isActive: assignedWorkFilter === "my-overdue",
        }
      );
    }

    return cards;
  }, [
    assignedWorkFilter,
    canAccessBookingsModule,
    canAccessOrdersModule,
    handleAssignedWorkFilterClick,
    myDueTodayBookings.length,
    myDueTodayOrders.length,
    myOpenBookings.length,
    myOpenOrders.length,
    myOverdueBookings.length,
    myOverdueOrders.length,
  ]);
  const exceptionsFirstItems = useMemo(
    () =>
      [
        {
          key: "low-stock",
          title: "Low stock",
          count: lowStockCount,
          note: stockForecastLabel(directoryStats.avgLeadTime, lowStockCount),
          path: DASHBOARD_PATHS.inventoryLow,
          tone: "warning",
        },
        {
          key: "sync-failed",
          title: "Sync failures",
          count: failedQueueCount,
          note: syncConflictCount
            ? `${syncConflictCount} need duplicate or conflict review`
            : "Queued actions need a retry",
          path: DASHBOARD_PATHS.offline,
          tone: "error",
        },
        {
          key: "orders-overdue",
          title: "Overdue orders",
          count: overdueOrders.length,
          note: overdueOrders[0]?.customerName
            ? `Oldest: ${overdueOrders[0].customerName}`
            : "Orders are past their expected date",
          path: buildPathWithParams(DASHBOARD_PATHS.orders, { timing: "overdue" }),
          tone: "attention",
        },
        {
          key: "bookings-overdue",
          title: "Overdue bookings",
          count: overdueBookings.length,
          note: overdueBookings[0]?.customerName
            ? `Oldest: ${overdueBookings[0].customerName}`
            : "Bookings need follow-up",
          path: buildPathWithParams("/admin/bookings", { timing: "overdue" }),
          tone: "attention",
        },
        {
          key: "conflicts",
          title: "Inventory conflicts",
          count: bookingConflictCount,
          note: visibleBookingConflicts[0]
            ? `${visibleBookingConflicts[0].productName} is overbooked`
            : "Bookings are reserved above live stock",
          path: "/admin/bookings",
          tone: "error",
        },
        {
          key: "approvals",
          title: "Approvals waiting",
          count: approvalItems.length,
          note: approvalItems[0]?.reason || "High-value orders and bookings need review",
          path: DASHBOARD_PATHS.orderApprovals,
          tone: "neutral",
        },
      ].filter((item) => item.count > 0),
    [
      approvalItems,
      bookingConflictCount,
      directoryStats.avgLeadTime,
      failedQueueCount,
      lowStockCount,
      overdueBookings,
      overdueOrders,
      syncConflictCount,
      visibleBookingConflicts,
    ]
  );
  const customerHealth = useMemo(() => {
    const activeCustomers = customers.filter(
      (customer) => toNumber(customer?.orders) + toNumber(customer?.bookings) > 0
    );
    const repeatCustomers = activeCustomers.filter(
      (customer) => toNumber(customer?.orders) + toNumber(customer?.bookings) > 1
    );
    const topCustomers = [...activeCustomers]
      .sort((left, right) => getCustomerTotalValue(right) - getCustomerTotalValue(left))
      .slice(0, 3);
    const vipThreshold = topCustomers.length
      ? getCustomerTotalValue(topCustomers[topCustomers.length - 1])
      : 0;
    const inactiveVipCustomers = activeCustomers
      .filter((customer) => {
        if (!vipThreshold || getCustomerTotalValue(customer) < vipThreshold) return false;
        const lastActivity = customer?.last_activity_at || customer?.last_order_date || customer?.last_booking_date;
        if (!lastActivity) return true;
        return !isDateInRange(lastActivity, new Date(currentDateTime.getTime() - 30 * DAY_MS), currentDateTime);
      })
      .sort((left, right) => getCustomerTotalValue(right) - getCustomerTotalValue(left))
      .slice(0, 3);

    return {
      newThisWindow: currentWindowCustomers.length,
      repeatRate: activeCustomers.length
        ? Math.round((repeatCustomers.length / activeCustomers.length) * 100)
        : 0,
      topCustomers,
      inactiveVipCustomers,
    };
  }, [currentDateTime, currentWindowCustomers.length, customers]);
  const recommendationItems = useMemo(() => {
    const items = [];
    const predictedInventoryRisks = Array.isArray(advancedAnalytics?.inventoryRisks)
      ? advancedAnalytics.inventoryRisks
      : [];
    const predictedCriticalStock = predictedInventoryRisks.filter((item) => item?.severity === "critical");
    if (canAccessInventoryModule && lowStockCount > 0) {
      items.push({
        key: "reorder",
        title: `Reorder ${Math.min(lowStockCount, 3)} item${lowStockCount === 1 ? "" : "s"} today`,
        note: predictedInventoryRisks.length
          ? `${predictedCriticalStock.length || predictedInventoryRisks.length} item${(predictedCriticalStock.length || predictedInventoryRisks.length) === 1 ? "" : "s"} may run short soon • ${stockForecastLabel(directoryStats.avgLeadTime, lowStockCount)}`
          : stockForecastLabel(directoryStats.avgLeadTime, lowStockCount),
        path: DASHBOARD_PATHS.inventoryLow,
        eyebrow: predictedInventoryRisks.length ? "Stock forecast" : "Inventory",
        tone: predictedCriticalStock.length ? "critical" : "warning",
      });
    }
    if (canAccessBookingsModule && pendingConfirmationBookings.length > 0) {
      items.push({
        key: "pending-bookings",
        title: `${pendingConfirmationBookings.length} booking${pendingConfirmationBookings.length === 1 ? "" : "s"} need confirmation`,
        note: pendingConfirmationBookings[0]?.customerName
          ? `Next: ${pendingConfirmationBookings[0].customerName} on ${formatDate(pendingConfirmationBookings[0].eventDate)}`
          : "Open the pending bookings queue",
        path: buildPathWithParams("/admin/bookings", { status: "pending", timing: "next7" }),
      });
    }
    const peakWeekday = String(advancedAnalytics?.demand?.peakWeekday || "").trim();
    if (canAccessBookingsModule && peakWeekday && peakWeekday !== "No pattern yet") {
      items.push({
        key: "forecast-peak-day",
        title: `${peakWeekday} is your busiest booking day`,
        note: `Plan delivery and setup capacity for ${toNumber(advancedAnalytics?.demand?.bookingForecastNext30)} predicted bookings over the next 30 days.`,
        path: "/admin/schedule",
        eyebrow: "Demand forecast",
        tone: "info",
      });
    }
    if (canAccessCustomers && customerHealth.inactiveVipCustomers.length > 0) {
      items.push({
        key: "inactive-vip",
        title: `${customerHealth.inactiveVipCustomers.length} high-value customer${customerHealth.inactiveVipCustomers.length === 1 ? "" : "s"} inactive 30+ days`,
        note: customerHealth.inactiveVipCustomers[0]?.name
          ? `Follow up with ${customerHealth.inactiveVipCustomers[0].name}`
          : "Open customer health list",
        path: buildPathWithParams(DASHBOARD_PATHS.customerDirectory, {
          q: customerHealth.inactiveVipCustomers[0]?.name || "",
        }),
      });
    }
    if (canViewHomeKpis && approvalItems.length > 0) {
      items.push({
        key: "approvals",
        title: `${approvalItems.length} approval${approvalItems.length === 1 ? "" : "s"} need a decision`,
        note: approvalItems[0]?.title || "Review high-value orders and bookings",
        path: approvalItems[0]?.href || DASHBOARD_PATHS.orderApprovals,
      });
    }
    const knownInsightKeys = new Set(["inventory-risk", "peak-day"]);
    (Array.isArray(advancedAnalytics?.insights) ? advancedAnalytics.insights : [])
      .filter((insight) => !knownInsightKeys.has(insight?.key))
      .forEach((insight) => {
        items.push({
          key: `forecast-${insight.key || insight.title}`,
          title: insight.title,
          note: insight.detail,
          path: insight.path || "/admin/reports",
          eyebrow: "Suggested action",
          tone: insight.tone || "info",
        });
      });
    if (!items.length) {
      items.push({
        key: "clear",
        title: "No urgent recommendations",
        note: isWaterUser
          ? "Open the water desk for the next live task."
          : "Open Store Mode to continue the day’s work.",
        path: isWaterUser ? DASHBOARD_PATHS.water : DASHBOARD_PATHS.pos,
      });
    }
    return items.slice(0, 4);
  }, [
    approvalItems,
    advancedAnalytics,
    canAccessBookingsModule,
    canAccessCustomers,
    canAccessInventoryModule,
    canViewHomeKpis,
    customerHealth.inactiveVipCustomers,
    directoryStats.avgLeadTime,
    isWaterUser,
    lowStockCount,
    pendingConfirmationBookings,
  ]);
  const teamLoadRows = useMemo(() => {
    if (!teamUsers.length) return [];
    const counts = new Map();
    const ensureRow = (id) => {
      const key = normalizeIdFilter(id);
      if (!key) return null;
      if (!counts.has(key)) {
        counts.set(key, { orders: 0, bookings: 0, overdue: 0 });
      }
      return counts.get(key);
    };
    openWorkflowOrders.forEach((order) => {
      const row = ensureRow(order?.assignedUserId);
      if (!row) return;
      row.orders += 1;
      if (isOverdue(getOrderWorkDate(order))) row.overdue += 1;
    });
    openWorkflowBookings.forEach((booking) => {
      const row = ensureRow(booking?.assignedUserId);
      if (!row) return;
      row.bookings += 1;
      if (isOverdue(getBookingWorkDate(booking))) row.overdue += 1;
    });
    return teamUsers
      .map((member) => {
        const countsRow = counts.get(normalizeIdFilter(member?.id)) || { orders: 0, bookings: 0, overdue: 0 };
        const total = countsRow.orders + countsRow.bookings;
        return {
          id: member.id,
          name: member.fullName || member.name || member.email || `User #${member.id}`,
          orders: countsRow.orders,
          bookings: countsRow.bookings,
          overdue: countsRow.overdue,
          total,
          activeSessionCount: toNumber(member.activeSessionCount),
          path:
            countsRow.bookings > countsRow.orders
              ? buildPathWithParams("/admin/bookings", {
                  assigned: member.id,
                  timing: countsRow.overdue ? "overdue" : "all",
                })
              : buildPathWithParams(DASHBOARD_PATHS.orders, {
                  assigned: member.id,
                  timing: countsRow.overdue ? "overdue" : "all",
                }),
        };
      })
      .sort((left, right) => {
        if (right.overdue !== left.overdue) return right.overdue - left.overdue;
        return right.total - left.total;
      })
      .slice(0, 5);
  }, [openWorkflowBookings, openWorkflowOrders, teamUsers]);
  const homeSummaryCards = useMemo(() => {
    const cards = [
      {
        key: "session",
        label: "Logged in",
        value: sessionDurationLabel,
        meta: signedInAt ? `Since ${formatDateTime(signedInAt)}` : "Active now",
        path: canAccessTimesheetsModule ? "/admin/timesheets" : "/admin/profile",
      },
    ];

    if (canAccessOfflineModule) {
      cards.push({
        key: "queue",
        label: "Sync queue",
        value: pendingQueue.length,
        meta: pendingQueue.length
          ? `${failedQueueCount} failed • ${syncedQueueCount} synced`
          : "Nothing waiting to sync",
        path: DASHBOARD_PATHS.offline,
      });
    }

    if (canAccessInventoryModule) {
      cards.push({
        key: "stock",
        label: "Low stock",
        value: inventoryLowStockItems.length,
        meta: inventoryLowStockItems.length ? "Needs action" : "Healthy",
        path: DASHBOARD_PATHS.inventoryLow,
      });
    }

    if (canAccessCustomers) {
      cards.push({
        key: "customers",
        label: "Customers",
        value: customers.length,
        meta: usingCustomerSnapshot ? "Using saved snapshot" : "Directory ready",
        path: DASHBOARD_PATHS.customerDirectory,
      });
    }

    return cards.slice(0, 4);
  }, [
    canAccessCustomers,
    canAccessInventoryModule,
    canAccessOfflineModule,
    canAccessTimesheetsModule,
    customers.length,
    failedQueueCount,
    inventoryLowStockItems.length,
    pendingQueue.length,
    sessionDurationLabel,
    signedInAt,
    syncedQueueCount,
    usingCustomerSnapshot,
  ]);

  const refreshHomeDashboard = useCallback(() => {
    fetchWorkflowData();
    fetchHomeKpis();
    fetchAdvancedAnalytics();
    fetchFinancialStats();
    fetchStockActivity();
    fetchDirectoryKpis();
  }, [
    fetchDirectoryKpis,
    fetchAdvancedAnalytics,
    fetchFinancialStats,
    fetchHomeKpis,
    fetchStockActivity,
    fetchWorkflowData,
  ]);

  const advancedInsightsPanel = useMemo(() => {
    const forecast = advancedAnalytics?.forecast || {};
    const demand = advancedAnalytics?.demand || {};
    const customer = advancedAnalytics?.customer || {};
    const direction = forecast.direction === "up" ? "growing" : forecast.direction === "down" ? "softening" : "steady";
    const confidence = String(forecast.confidence || "low").toLowerCase();
    const repeat = toNumber(customer.repeat);
    const total = toNumber(customer.total);
    return {
      visible: canViewHomeKpis,
      loading: advancedAnalyticsLoading,
      error: advancedAnalyticsError,
      connected: Boolean(advancedAnalytics?.service?.connected),
      serviceMessage: advancedAnalytics?.service?.message || "Read-only forecasting from aggregated operating data.",
      forecastValue: toCurrency(toNumber(forecast.next30RevenueCents) / 100, "GHS"),
      forecastMeta: `${confidence} confidence • ${direction}${toNumber(forecast.changePct) ? ` ${Math.abs(toNumber(forecast.changePct))}%` : ""}`,
      peakWeekday: demand.peakWeekday || "No pattern yet",
      bookingForecastMeta: `${toNumber(demand.bookingForecastNext30)} bookings predicted in 30 days`,
      repeatRate: Math.max(0, Math.min(100, Math.round(toNumber(customer.repeatRate)))),
      repeatCustomerMeta: `${repeat} of ${total} active customer${total === 1 ? "" : "s"}`,
      insights: Array.isArray(advancedAnalytics?.insights) ? advancedAnalytics.insights : [],
      inventoryRisks: Array.isArray(advancedAnalytics?.inventoryRisks) ? advancedAnalytics.inventoryRisks : [],
      onRefresh: fetchAdvancedAnalytics,
    };
  }, [
    advancedAnalytics,
    advancedAnalyticsError,
    advancedAnalyticsLoading,
    canViewHomeKpis,
    fetchAdvancedAnalytics,
  ]);

  const toggleAssignedWorkItem = useCallback((itemKey) => {
    setExpandedAssignedWorkKey((current) => (current === itemKey ? "" : itemKey));
  }, []);

  const recentStaffActivityWithVisual = useMemo(
    () =>
      recentStaffActivity.map((item) => ({
        ...item,
        visual: getActivityVisual(item),
      })),
    [recentStaffActivity]
  );

  const businessKpiPanel = useMemo(
    () => {
      const forecast = advancedAnalytics?.forecast || {};
      const demand = advancedAnalytics?.demand || {};
      const inventoryRisks = Array.isArray(advancedAnalytics?.inventoryRisks)
        ? advancedAnalytics.inventoryRisks
        : [];
      const confidence = String(forecast.confidence || "low").toLowerCase();
      const direction = forecast.direction === "up"
        ? "growing"
        : forecast.direction === "down"
          ? "softening"
          : "steady";
      const forecastChange = Math.abs(toNumber(forecast.changePct));
      const forecastMeta = `${confidence} confidence • ${direction}${forecastChange ? ` ${forecastChange}%` : ""}`;
      const forecastStatus = advancedAnalyticsLoading
        ? "Updating forecasts"
        : advancedAnalyticsError
          ? "Core metrics live"
          : "Forecasts included";
      const criticalInventoryRisks = inventoryRisks.filter((item) => item?.severity === "critical");

      return ({
      visible: canViewHomeKpis,
      updatedAt: homeUpdatedAt ? formatRelativeTime(homeUpdatedAt) : "",
      sourceLabel: `${activeWindowConfig.sourceLabel} • ${forecastStatus} • REEBS Core only • Water excluded`,
      windowOptions: HOME_WINDOW_OPTIONS,
      activeWindow: dashboardWindow,
      onWindowChange: setDashboardWindow,
      onRefresh: refreshHomeDashboard,
      refreshDisabled:
        kpiLoading
        || financialLoading
        || stockActivityLoading
        || directoryLoading
        || workflowLoading
        || advancedAnalyticsLoading,
      loading: kpiLoading,
      error: kpiError,
      summaryCards: [
        {
          key: "revenue",
          label: "Core revenue",
          value: toCurrency(totalRevenue, "GHS"),
          meta: revenueDeltaLabel,
          signal: {
            label: "Next 30 days",
            value: toCurrency(toNumber(forecast.next30RevenueCents) / 100, "GHS"),
            meta: forecastMeta,
            tone: forecast.direction === "down" ? "warning" : "positive",
          },
          path: DASHBOARD_PATHS.accounting,
        },
        {
          key: "net",
          label: "Net after expenses",
          value: toCurrency(netAfterExpenses, "GHS"),
          meta: netDeltaLabel,
          meterWidth: netMarginPct,
          path: DASHBOARD_PATHS.expenses,
        },
        {
          key: "inventory",
          label: "Inventory value",
          value: toCurrency(inventoryValue, "GHS"),
          meta: stockForecastNote,
          signal: {
            label: "Predicted stock risk",
            value: `${inventoryRisks.length} item${inventoryRisks.length === 1 ? "" : "s"}`,
            meta: criticalInventoryRisks.length
              ? `${criticalInventoryRisks.length} may run out within a week`
              : "Based on recent stock movement",
            tone: criticalInventoryRisks.length ? "critical" : inventoryRisks.length ? "warning" : "positive",
          },
          meterClass: "is-warning",
          meterWidth: Math.max(8, 100 - inventoryRiskPct),
          path: DASHBOARD_PATHS.inventoryLow,
        },
        {
          key: "locked-in",
          label: "Locked-in next quarter",
          value: toCurrency(lockedInValue, "GHS"),
          meta: `${kpiStats?.nextQuarterLabel || "Next quarter"} • ${lockedInPct}% of current revenue`,
          signal: {
            label: "30-day booking demand",
            value: `${toNumber(demand.bookingForecastNext30)} predicted`,
            meta: demand.peakWeekday && demand.peakWeekday !== "No pattern yet"
              ? `${demand.peakWeekday} is usually busiest`
              : "More booking history will improve this",
            tone: "info",
          },
          meterClass: "is-accent",
          meterWidth: lockedInPct,
          path: DASHBOARD_PATHS.bookingsConfirmed,
        },
        {
          key: "aov",
          label: "Avg. Order Value",
          value: avgOrderValue > 0 ? toCurrency(avgOrderValue, "GHS") : "—",
          meta: totalOrders > 0
            ? `Across ${totalOrders} order${totalOrders === 1 ? "" : "s"}`
            : "No orders in window",
          path: DASHBOARD_PATHS.accounting,
        },
      ],
      revenueMix: {
        path: DASHBOARD_PATHS.accounting,
        totalValue: toCurrency(totalRevenue, "GHS"),
        radius: revenueDonutRadius,
        circumference: revenueDonutCircumference,
        donut: revenueMixDonut,
        segments: revenueMixSegments,
        total: revenueMixTotal,
      },
      revenueTrend: {
        path: DASHBOARD_PATHS.accounting,
        windowLabel: financialStats.windowLabel || "This month",
        loading: financialLoading,
        error: financialError,
        hasData: revenueTrend.length > 0,
        latestValue: toCurrency(revenueTrendLatest, "GHS"),
        deltaLabel: revenueTrendDeltaLabel,
        rangeLabel: revenueTrendRangeLabel,
        spark: revenueTrendSpark,
        forecastValue: toCurrency(toNumber(forecast.next30RevenueCents) / 100, "GHS"),
        forecastMeta,
        onRetry: fetchFinancialStats,
      },
      stockMovement: {
        path: DASHBOARD_PATHS.inventoryActivity,
        loading: stockActivityLoading,
        error: stockActivityError,
        hasData: stockActivity.length > 0,
        totals: stockActivityTotals,
        spark: stockActivitySpark,
        rangeLabel: stockActivityRangeLabel,
        velocityTotalsLabel: `Recent 6 months: ${velocityTotals.stockIn} in • ${velocityTotals.stockOut} out`,
        velocityTrend: velocityTrend.map((entry) => ({
          ...entry,
          stockIn: toNumber(entry.stockIn),
          stockOut: toNumber(entry.stockOut),
        })),
        velocityMax,
        riskCount: inventoryRisks.length,
        criticalRiskCount: criticalInventoryRisks.length,
        onRetry: fetchStockActivity,
      },
      operationalLoad: {
        path: "/admin/bookings",
        bars: operationsBars,
        max: operationsBarsMax,
        bookingForecast: toNumber(demand.bookingForecastNext30),
        peakWeekday: demand.peakWeekday || "No pattern yet",
      },
      topProducts: kpiStats?.topProducts || [],
      topRentalBookings: kpiStats?.topRentalBookings || [],
      dataFreshnessClass,
      onRetryKpi: fetchHomeKpis,
    });
    },
    [
      activeWindowConfig.sourceLabel,
      advancedAnalytics,
      advancedAnalyticsError,
      advancedAnalyticsLoading,
      avgOrderValue,
      canViewHomeKpis,
      dashboardWindow,
      dataFreshnessClass,
      directoryLoading,
      fetchFinancialStats,
      fetchHomeKpis,
      fetchStockActivity,
      financialError,
      financialLoading,
      financialStats.windowLabel,
      homeUpdatedAt,
      inventoryRiskPct,
      inventoryValue,
      kpiError,
      kpiLoading,
      kpiStats?.nextQuarterLabel,
      kpiStats?.topProducts,
      kpiStats?.topRentalBookings,
      lockedInPct,
      lockedInValue,
      netAfterExpenses,
      netDeltaLabel,
      netMarginPct,
      operationsBars,
      operationsBarsMax,
      refreshHomeDashboard,
      revenueDonutCircumference,
      revenueDonutRadius,
      revenueDeltaLabel,
      revenueMixDonut,
      revenueMixSegments,
      revenueMixTotal,
      revenueTrend.length,
      revenueTrendDeltaLabel,
      revenueTrendLatest,
      revenueTrendRangeLabel,
      revenueTrendSpark,
      stockActivity.length,
      stockActivityError,
      stockActivityLoading,
      stockActivityRangeLabel,
      stockActivitySpark,
      stockActivityTotals,
      stockForecastNote,
      totalRevenue,
      totalBookings,
      totalOrders,
      velocityMax,
      velocityTotals.stockIn,
      velocityTotals.stockOut,
      velocityTrend,
      workflowLoading,
    ]
  );

  const approvalsPanel = useMemo(
    () => ({
      loading: workflowLoading,
      items: approvalItems.map((item) => ({
        ...item,
        amountLabel: toCurrency(item.amount, "GHS"),
      })),
      emptyPath: DASHBOARD_PATHS.orders,
    }),
    [approvalItems, workflowLoading]
  );

  const teamLoadPanel = useMemo(
    () => ({
      loading: workflowLoading,
      rows: teamLoadRows,
      emptyPath: DASHBOARD_PATHS.userDirectory,
    }),
    [teamLoadRows, workflowLoading]
  );

  const customerHealthPanel = useMemo(
    () => {
      const forecastCustomer = advancedAnalytics?.customer || {};
      const hasForecastCustomerData = toNumber(forecastCustomer.total) > 0;
      const repeatRate = hasForecastCustomerData
        ? Math.max(0, Math.min(100, Math.round(toNumber(forecastCustomer.repeatRate))))
        : customerHealth.repeatRate;
      return ({
      summaryCards: [
        {
          key: "new",
          label: "New this window",
          value: customerHealth.newThisWindow,
          meta: customersDeltaLabel,
          path: DASHBOARD_PATHS.customerDirectory,
        },
        {
          key: "repeat",
          label: "Repeat rate",
          value: `${repeatRate}%`,
          meta: hasForecastCustomerData
            ? `${toNumber(forecastCustomer.repeat)} of ${toNumber(forecastCustomer.total)} customers have returned`
            : "Customers with more than one order or booking",
          path: DASHBOARD_PATHS.customerDirectory,
        },
        {
          key: "top",
          label: "Top customers",
          value: customerHealth.topCustomers.length,
          meta: "Highest current value customers",
          path: DASHBOARD_PATHS.customerDirectory,
        },
        {
          key: "inactive-vip",
          label: "Inactive VIPs",
          value: customerHealth.inactiveVipCustomers.length,
          meta: "High-value customers quiet for 30+ days",
          path: DASHBOARD_PATHS.customerDirectory,
        },
      ],
      topCustomers: customerHealth.topCustomers,
      inactiveVipCustomers: customerHealth.inactiveVipCustomers,
      getCustomerPath: (id) => buildPathWithParams(DASHBOARD_PATHS.customerDirectory, { id }),
      getCustomerValueLabel: (customer) => toCurrency(getCustomerTotalValue(customer), "GHS"),
      getInactiveMeta: (customer) =>
        customer.last_activity_at
          ? `Last active ${formatDate(customer.last_activity_at)}`
          : "No recent activity recorded",
    });
    },
    [advancedAnalytics, customerHealth, customersDeltaLabel]
  );

  const activityPanel = useMemo(
    () => ({
      canViewHomeKpis,
      activityScope,
      onScopeChange: setActivityScope,
      error: activityError,
      loading: activityLoading,
      items: recentStaffActivityWithVisual,
    }),
    [
      activityError,
      activityLoading,
      activityScope,
      canViewHomeKpis,
      recentStaffActivityWithVisual,
    ]
  );

  const purchaseQtyByLineKey = useMemo(
    () =>
      purchaseItems.reduce((map, item) => {
        const lineKey = item.lineKey || getProductLineKey(item.productId, item.variantId);
        map.set(lineKey, (map.get(lineKey) || 0) + item.quantity);
        return map;
      }, new Map()),
    [purchaseItems]
  );

  useEffect(() => {
    setSelectedVariantIds((current) => {
      const next = {};

      inventory.forEach((item) => {
        if (!isVariantParentItem(item)) return;

        const itemKey = String(item.id);
        const variants = getActiveItemVariants(item);
        if (!variants.length) return;

        const currentSelected = findVariantById(item, current[itemKey]);
        const purchaseSelected = purchaseItems.find(
          (entry) => Number(entry.productId) === Number(item.id) && Number(entry.variantId) > 0
        );
        const preferredVariant =
          currentSelected
          || findVariantById(item, purchaseSelected?.variantId)
          || variants.find((variant) => getVariantAvailableQty(variant) > 0)
          || variants[0];

        if (preferredVariant?.id) {
          next[itemKey] = Number(preferredVariant.id);
        }
      });

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (
        currentKeys.length === nextKeys.length
        && nextKeys.every((key) => Number(current[key]) === Number(next[key]))
      ) {
        return current;
      }
      return next;
    });
  }, [inventory, purchaseItems]);

  const searchedInventory = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const sorted = [...inventory].sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""))
    );
    if (!needle) return sorted;
    return sorted.filter((item) => {
      return buildProductSearchText(item).includes(needle);
    });
  }, [inventory, search]);

  const visibleInventory = useMemo(() => {
    return searchedInventory.filter((item) => {
      const quantity = getQuantity(item, purchaseQtyByLineKey);
      if (stockFilter === "rental") return isRentalItem(item);
      if (stockFilter === "in") return quantity > 0 && !isRentalItem(item);
      if (stockFilter === "out") return quantity <= 0;
      if (stockFilter === "low") return quantity <= LOW_STOCK_THRESHOLD && !isRentalItem(item);
      return true;
    });
  }, [purchaseQtyByLineKey, searchedInventory, stockFilter]);

  const filteredCustomers = useMemo(() => {
    const needle = customerSearch.trim().toLowerCase();
    const list = [...customers].sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""))
    );
    if (!needle) return list;
    return list.filter((customer) => {
      const name = String(customer?.name || "").toLowerCase();
      const phone = String(customer?.phone || "").toLowerCase();
      const email = String(customer?.email || "").toLowerCase();
      return name.includes(needle) || phone.includes(needle) || email.includes(needle);
    });
  }, [customerSearch, customers]);

  const homeQuickActions = useMemo(() => {
    const candidates = isWaterUser
      ? [
          { key: "water", label: "Water Desk", icon: faPlus, path: DASHBOARD_PATHS.water },
          { key: "profile", label: "My Profile", icon: faUser, path: "/admin/profile" },
        ]
      : isDriverUser
        ? [
            { key: "bookings", label: "Bookings", icon: faCalendarDays, path: "/admin/bookings" },
            { key: "delivery", label: "Delivery Board", icon: faTruck, path: "/admin/delivery" },
            {
              key: "customer",
              label: "Customers",
              icon: faClipboardList,
              path: DASHBOARD_PATHS.customerDirectory,
            },
          ]
      : canViewHomeKpis
        ? [
            { key: "order", label: "Create Order", icon: faPlus, path: DASHBOARD_PATHS.newOrder },
            { key: "approval", label: "Review Approvals", icon: faReceipt, path: DASHBOARD_PATHS.orderApprovals },
            { key: "customer", label: "Add Customer", icon: faClipboardList, path: DASHBOARD_PATHS.addCustomer },
          ]
        : [
            { key: "order", label: "Create Order", icon: faPlus, path: DASHBOARD_PATHS.newOrder },
            { key: "stock", label: "Record Stock", icon: faBoxesStacked, path: DASHBOARD_PATHS.inventory },
            { key: "customer", label: "Add Customer", icon: faClipboardList, path: DASHBOARD_PATHS.addCustomer },
          ];

    const filtered = candidates.filter(
      (item) => item.path === "/admin/profile" || canAccessPortalRoute(roleKey, item.path)
    );

    return filtered.length
      ? filtered
      : [{ key: "profile", label: "My Profile", icon: faUser, path: "/admin/profile" }];
  }, [canViewHomeKpis, isDriverUser, isWaterUser, roleKey]);

  const purchaseCatalog = useMemo(() => {
    const products = searchedInventory.filter(
      (item) => getQuantity(item, purchaseQtyByLineKey) > 0 && !isRentalItem(item)
    );
    return products.slice(0, 80);
  }, [purchaseQtyByLineKey, searchedInventory]);

  const purchaseCount = useMemo(
    () => purchaseItems.reduce((sum, item) => sum + item.quantity, 0),
    [purchaseItems]
  );

  const purchaseSubtotal = useMemo(
    () => purchaseItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [purchaseItems]
  );

  const addProductToPurchase = (item, variant = null) => {
    const productId = Number(item?.id);
    if (!Number.isFinite(productId) || productId <= 0) return;

    const chosenVariant = isVariantParentItem(item)
      ? variant
        || findVariantById(item, selectedVariantIds[String(productId)])
        || getActiveItemVariants(item).find((entry) => getVariantAvailableQty(entry) > 0)
        || null
      : null;
    const lineKey = getProductLineKey(productId, chosenVariant?.id);
    const maxStock = chosenVariant
      ? Math.max(0, getVariantAvailableQty(chosenVariant) - (purchaseQtyByLineKey.get(lineKey) || 0))
      : getQuantity(item, purchaseQtyByLineKey);
    if (maxStock <= 0) return;

    if (chosenVariant?.id) {
      setSelectedVariantIds((prev) => {
        if (Number(prev[String(productId)]) === Number(chosenVariant.id)) return prev;
        return { ...prev, [productId]: Number(chosenVariant.id) };
      });
    }

    setPurchaseItems((prev) => {
      const existing = prev.find(
        (row) => (row.lineKey || getProductLineKey(row.productId, row.variantId)) === lineKey
      );
      if (existing) {
        if (existing.quantity >= existing.stock) return prev;
        return prev.map((row) =>
          (row.lineKey || getProductLineKey(row.productId, row.variantId)) === lineKey
            ? { ...row, quantity: row.quantity + 1 }
            : row
        );
      }
      return [
        ...prev,
        {
          lineKey,
          productId,
          variantId: chosenVariant?.id || null,
          productName: item.name,
          variantLabel: chosenVariant ? buildVariantOptionLabel(item, chosenVariant) : "",
          name: chosenVariant ? `${item.name} / ${buildVariantOptionLabel(item, chosenVariant)}` : item.name,
          quantity: 1,
          unitPrice: chosenVariant ? getPrice(item, chosenVariant) : getPrice(item),
          stock: chosenVariant ? getVariantAvailableQty(chosenVariant) : getQuantity(item),
          currency: item.currency || "GHS",
        },
      ];
    });
  };

  const changePurchaseQuantity = (lineKey, delta) => {
    const currentLine = purchaseItems.find(
      (item) => (item.lineKey || getProductLineKey(item.productId, item.variantId)) === lineKey
    );
    const product = inventory.find((item) => Number(item.id) === Number(currentLine?.productId));
    const variant = currentLine?.variantId ? findVariantById(product, currentLine.variantId) : null;
    const maxStock = variant ? getVariantAvailableQty(variant) : product ? getQuantity(product) : Infinity;

    setPurchaseItems((prev) =>
      prev
        .map((item) => {
          if ((item.lineKey || getProductLineKey(item.productId, item.variantId)) !== lineKey) return item;
          const nextQty = Math.max(0, Math.min(maxStock, item.quantity + delta));
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removePurchaseLine = (lineKey) => {
    setPurchaseItems((prev) =>
      prev.filter((item) => (item.lineKey || getProductLineKey(item.productId, item.variantId)) !== lineKey)
    );
  };

  const applyPurchaseToLocalStock = (items) => {
    setInventory((prev) =>
      prev.map((product) => {
        const lines = items.filter((entry) => Number(entry.productId) === Number(product.id));
        if (!lines.length) return product;
        return lines.reduce(
          (nextProduct, lineItem) => applyInventoryLineQuantityDelta(nextProduct, lineItem, -1),
          product
        );
      })
    );
  };

  const submitPurchase = async () => {
    setSurfaceError("");
    setSurfaceNotice("");
    if (!selectedCustomerId) {
      setSurfaceError("Select a customer first.");
      return;
    }
    if (!purchaseItems.length) {
      setSurfaceError("Add at least one product.");
      return;
    }

    const payload = {
      customerId: Number(selectedCustomerId),
      status: INITIAL_PURCHASE_STATUS,
      items: purchaseItems.map((item) => ({
        productId: Number(item.productId),
        variantId: item.variantId || undefined,
        quantity: Number(item.quantity),
        price: Number(item.unitPrice),
      })),
      userId: user?.id,
      userName: profileName,
      userEmail: user?.email,
      source: "admin-purchase",
    };

    const queueLabel = `Purchase · ${purchaseItems.length} product(s)`;
    const queueItem = createQueueItem({
      type: "purchase",
      payload,
      label: queueLabel,
    });

    setPurchaseSubmitting(true);
    try {
      if (!isOnline) {
        queueAction(queueItem);
        applyPurchaseToLocalStock(purchaseItems);
        setPurchaseItems([]);
        setSurfaceNotice("Purchase saved offline. It will sync automatically.");
        return;
      }

      const result = await sendPurchase(payload);
      applyPurchaseToLocalStock(purchaseItems);
      setPurchaseItems([]);
      await Promise.all([
        fetchActivityFeed(),
        fetchWorkflowData(),
        canViewHomeKpis ? fetchHomeKpis() : Promise.resolve(),
        canViewHomeKpis ? fetchFinancialStats() : Promise.resolve(),
      ]);
      setSurfaceNotice(
        result?.orderNumber
          ? `Purchase synced (${result.orderNumber}).`
          : "Purchase synced."
      );
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        queueAction(queueItem);
        applyPurchaseToLocalStock(purchaseItems);
        setPurchaseItems([]);
        setSurfaceNotice("Connection lost. Purchase saved offline.");
      } else {
        setSurfaceError(error.message || "Purchase failed.");
      }
    } finally {
      setPurchaseSubmitting(false);
    }
  };

  const handleQuickStock = async (item, direction, variant = null) => {
    const quantity = quickQuantity;
    if (quantity <= 0) return;
    if (isRentalItem(item)) {
      setSurfaceError(`"${item.name}" is a rental item. Manage capacity through the Inventory editor, not stock adjustments.`);
      return;
    }

    const chosenVariant = isVariantParentItem(item)
      ? variant
        || findVariantById(item, selectedVariantIds[String(item.id)])
        || getActiveItemVariants(item).find((entry) => getVariantAvailableQty(entry) > 0)
        || null
      : null;
    if (isVariantParentItem(item) && !chosenVariant) {
      setSurfaceError(`Choose a variant for "${item.name}" before updating stock.`);
      return;
    }
    const busyKey = `${item.id}:${chosenVariant?.id || "standard"}-${direction}`;

    const movementType = direction === "in" ? "StockIn" : "StockOut";
    const delta = direction === "in" ? quantity : -quantity;
    const payload = {
      productId: item.id,
      variantId: chosenVariant?.id || undefined,
      type: movementType,
      quantity,
      notes: "Quick mobile stock update",
      reference: `MOBILE-${new Date().toISOString().slice(0, 10)}`,
      userId: user?.id,
      userName: profileName,
      userEmail: user?.email,
    };

    const queueItem = createQueueItem({
      type: "stock",
      payload,
      label: `${chosenVariant ? `${item.name} / ${buildVariantOptionLabel(item, chosenVariant)}` : item.name} · ${movementType} ${quantity}`,
    });

    setSurfaceError("");
    setSurfaceNotice("");
    setStockBusyId(busyKey);

    try {
      if (!isOnline) {
        queueAction(queueItem);
        adjustProductQuantity(item.id, delta, { variantId: chosenVariant?.id });
        setSurfaceNotice(`${chosenVariant ? buildVariantOptionLabel(item, chosenVariant) : item.name}: saved offline.`);
        return;
      }

      const result = await sendStockUpdate(payload);
      const nextStock = Number(result?.newStock);
      if (Number.isFinite(nextStock)) {
        setProductQuantity(item.id, nextStock, {
          variantId: result?.variantId || chosenVariant?.id,
          variantAvailableQty: result?.variantAvailableQty,
        });
      } else {
        adjustProductQuantity(item.id, delta, { variantId: chosenVariant?.id });
      }
      await Promise.all([
        fetchActivityFeed(),
        fetchWorkflowData(),
        canViewHomeKpis ? fetchHomeKpis() : Promise.resolve(),
      ]);
      setSurfaceNotice(
        direction === "in"
          ? `${chosenVariant ? buildVariantOptionLabel(item, chosenVariant) : item.name}: +${quantity} added.`
          : `${chosenVariant ? buildVariantOptionLabel(item, chosenVariant) : item.name}: -${quantity} removed.`
      );
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        queueAction(queueItem);
        adjustProductQuantity(item.id, delta, { variantId: chosenVariant?.id });
        setSurfaceNotice(`${chosenVariant ? buildVariantOptionLabel(item, chosenVariant) : item.name}: queued for sync.`);
      } else {
        setSurfaceError(error.message || "Stock update failed.");
      }
    } finally {
      setStockBusyId("");
    }
  };

  const clearSyncedQueue = () => {
    setQueue((prev) => prev.filter((item) => item.status !== "synced"));
  };

  const retryFailedQueue = () => {
    setQueue((prev) =>
      prev.map((item) =>
        item.status === "failed" ? { ...item, status: "pending", lastError: "" } : item
      )
    );
  };

  const renderHome = () => (
    <AdminWorkspaceHomeView
      storeModePath={DASHBOARD_PATHS.pos}
      workflowError={workflowError}
      myWorkCards={myWorkCards}
      assignedWorkItems={assignedWorkItems}
      isAssignedWorkListVisible={isAssignedWorkListVisible}
      workflowLoading={workflowLoading}
      assignedWorkFilter={assignedWorkFilter}
      expandedAssignedWorkKey={expandedAssignedWorkKey}
      onToggleAssignedWorkItem={toggleAssignedWorkItem}
      onNavigate={navigate}
      formatDate={formatDate}
      homeSummaryCards={homeSummaryCards}
      homeQuickActions={homeQuickActions}
      recommendationItems={recommendationItems}
      advancedInsightsPanel={advancedInsightsPanel}
      kpiPanel={businessKpiPanel}
      approvalsPanel={approvalsPanel}
      teamLoadPanel={teamLoadPanel}
      customerHealthPanel={customerHealthPanel}
      activityPanel={activityPanel}
      formatRelativeTime={formatRelativeTime}
      formatDateTime={formatDateTime}
    />
  );

  const renderInventory = () => (
    <section className="aw-section-grid">
      <div className="glass-card aw-panel">
        <div className="aw-toolbar">
          <SearchField
            className="aw-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search stock"
            aria-label="Search stock"
          />
          <div className="aw-qty-pills" role="tablist" aria-label="Stock filter">
            <button
              type="button"
              role="tab"
              aria-selected={stockFilter === "all"}
              className={`aw-pill ${stockFilter === "all" ? "is-active" : ""}`}
              onClick={() => setStockFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={stockFilter === "in"}
              className={`aw-pill ${stockFilter === "in" ? "is-active" : ""}`}
              onClick={() => setStockFilter("in")}
            >
              In stock
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={stockFilter === "out"}
              className={`aw-pill ${stockFilter === "out" ? "is-active" : ""}`}
              onClick={() => setStockFilter("out")}
            >
              Out of stock
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={stockFilter === "low"}
              className={`aw-pill ${stockFilter === "low" ? "is-active" : ""}`}
              onClick={() => setStockFilter("low")}
            >
              Low
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={stockFilter === "rental"}
              className={`aw-pill ${stockFilter === "rental" ? "is-active" : ""}`}
              onClick={() => setStockFilter("rental")}
            >
              Rental
            </button>
          </div>
          <div className="aw-qty-pills" role="tablist" aria-label="Quick quantity">
            {STOCK_ACTION_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={quickQuantity === value}
                className={`aw-pill ${quickQuantity === value ? "is-active" : ""}`}
                onClick={() => setQuickQuantity(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {inventoryLoading ? (
          <AnimatedLoadingState
            compact
            className="glass-card admin-module-loading"
            title="Loading stock"
            message="Preparing workspace stock actions and variant availability."
            variant="workspace"
          />
        ) : (
          <div className="aw-stock-list">
            {visibleInventory.map((item) => {
              const itemKey = String(item.id);
              const variants = getActiveItemVariants(item);
              const selectedVariant = findVariantById(item, selectedVariantIds[itemKey])
                || variants.find((variant) => getVariantAvailableQty(variant) > 0)
                || variants[0]
                || null;
              const variantBusyPrefix = `${item.id}:${selectedVariant?.id || "standard"}`;
              const outBusy = stockBusyId === `${variantBusyPrefix}-out`;
              const inBusy = stockBusyId === `${variantBusyPrefix}-in`;
              const quantity = getQuantity(item, purchaseQtyByLineKey);
              const isLow = quantity <= LOW_STOCK_THRESHOLD;
              const isRental = isRentalItem(item);
              const hasVariants = isVariantParentItem(item) && variants.length > 0;
              const selectedVariantStock = selectedVariant ? getVariantAvailableQty(selectedVariant) : 0;
              return (
                <article key={item.id} className="glass-card aw-stock-card">
                  <div className="aw-stock-meta">
                    <h3>{item.name}</h3>
                    <p>{item.sku || "No SKU"}</p>
                    {hasVariants ? (
                      <div className="aw-variant-meta">
                        <SelectField
                          value={selectedVariant?.id ? String(selectedVariant.id) : ""}
                          onChangeValue={(nextValue) =>
                            setSelectedVariantIds((prev) => ({ ...prev, [item.id]: Number(nextValue) }))
                          }
                          ariaLabel={`Choose variant for ${item.name}`}
                          inputClassName="aw-select aw-select--variant"
                        >
                          {variants.map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {buildVariantOptionLabel(item, variant)} · {getVariantAvailableQty(variant)} in stock
                            </option>
                          ))}
                        </SelectField>
                      </div>
                    ) : null}
                    {isRental ? (
                      <span className="aw-stock-badge is-rental">
                        {quantity} unit{quantity !== 1 ? "s" : ""} · Rental
                      </span>
                    ) : hasVariants ? (
                      <span className={`aw-stock-badge ${isLow ? "is-low" : ""}`}>
                        {quantity} total · {selectedVariantStock} selected
                      </span>
                    ) : (
                      <span className={`aw-stock-badge ${isLow ? "is-low" : ""}`}>
                        Qty {quantity}
                      </span>
                    )}
                  </div>
                  <div className="aw-stock-actions">
                    {isRental ? (
                      <span className="aw-muted" style={{ fontSize: "0.78rem" }}>
                        Manage via bookings
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="aw-icon-btn danger"
                          onClick={() => handleQuickStock(item, "out", selectedVariant)}
                          disabled={outBusy || (hasVariants && !selectedVariant)}
                          aria-label={`Reduce stock for ${item.name}`}
                        >
                          <AppIcon icon={faMinus} />
                        </button>
                        <button
                          type="button"
                          className="aw-icon-btn success"
                          onClick={() => handleQuickStock(item, "in", selectedVariant)}
                          disabled={inBusy || (hasVariants && !selectedVariant)}
                          aria-label={`Increase stock for ${item.name}`}
                        >
                          <AppIcon icon={faPlus} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  const renderPurchases = () => (
    <section className="aw-section-grid">
      <div className="glass-card aw-panel">
        <div className="aw-panel-header">
          <h2>Quick Purchase</h2>
        </div>
        <div className="aw-toolbar">
          <SearchField
            className="aw-search"
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            onClear={() => setCustomerSearch("")}
            placeholder="Find customer"
            aria-label="Find customer"
          />
          <SelectField
            value={selectedCustomerId}
            onChangeValue={(nextValue) => setSelectedCustomerId(String(nextValue))}
            aria-label="Select customer"
            inputClassName="aw-select"
          >
            <option value="">Choose customer</option>
            {filteredCustomers.slice(0, 100).map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </SelectField>
        </div>
        {customerError && <p className="aw-muted">{customerError}</p>}
      </div>

      <div className="glass-card aw-panel">
        <div className="aw-panel-header">
          <h2>Products</h2>
          <span className="aw-count-pill">{purchaseCatalog.length}</span>
        </div>
        <div className="aw-product-grid">
          {purchaseCatalog.map((item) => {
            const itemKey = String(item.id);
            const variants = getActiveItemVariants(item);
            const selectedVariant = findVariantById(item, selectedVariantIds[itemKey])
              || variants.find((variant) => getVariantAvailableQty(variant) > 0)
              || variants[0]
              || null;
            const hasVariants = isVariantParentItem(item) && variants.length > 0;
            const lineKey = getProductLineKey(item.id, selectedVariant?.id);
            const remainingStock = hasVariants
              ? Math.max(0, getVariantAvailableQty(selectedVariant) - (purchaseQtyByLineKey.get(lineKey) || 0))
              : getQuantity(item, purchaseQtyByLineKey);

            return (
              <div key={item.id} className="aw-product-entry">
                {hasVariants ? (
                  <SelectField
                    value={selectedVariant?.id ? String(selectedVariant.id) : ""}
                    onChangeValue={(nextValue) =>
                      setSelectedVariantIds((prev) => ({ ...prev, [item.id]: Number(nextValue) }))
                    }
                    ariaLabel={`Choose variant for ${item.name}`}
                    inputClassName="aw-select aw-select--variant"
                  >
                    {variants.map((variant) => {
                      const variantLineKey = getProductLineKey(item.id, variant.id);
                      const variantRemaining = Math.max(
                        0,
                        getVariantAvailableQty(variant) - (purchaseQtyByLineKey.get(variantLineKey) || 0)
                      );
                      return (
                        <option key={variant.id} value={variant.id} disabled={variantRemaining <= 0}>
                          {buildVariantOptionLabel(item, variant)} · {variantRemaining} left
                        </option>
                      );
                    })}
                  </SelectField>
                ) : null}
                <button
                  type="button"
                  className="aw-product-btn"
                  onClick={() => addProductToPurchase(item, selectedVariant)}
                  disabled={remainingStock <= 0}
                >
                  <span>{item.name}</span>
                  <small>
                    {toCurrency(
                      hasVariants && selectedVariant ? getPrice(item, selectedVariant) : getPrice(item),
                      item.currency || "GHS"
                    )}
                    {hasVariants ? ` · ${remainingStock} left` : ""}
                  </small>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-card aw-panel">
        <div className="aw-panel-header">
          <h2>Basket</h2>
          <span className="aw-count-pill">{purchaseCount}</span>
        </div>
        {!purchaseItems.length ? (
          <p className="aw-muted">No products selected.</p>
        ) : (
          <ul className="aw-basket-list">
            {purchaseItems.map((item) => (
              <li key={item.lineKey || getProductLineKey(item.productId, item.variantId)} className="aw-basket-item">
                <div className="aw-basket-main">
                  <strong>{item.productName || item.name}</strong>
                  <span>{toCurrency(item.unitPrice, item.currency || "GHS")}</span>
                </div>
                {item.variantLabel ? (
                  <p className="aw-basket-variant">{item.variantLabel.replace(`${item.productName || ""} / `, "")}</p>
                ) : null}
                <div className="aw-basket-actions">
                  <button
                    type="button"
                    className="aw-icon-btn danger"
                    onClick={() => changePurchaseQuantity(item.lineKey || getProductLineKey(item.productId, item.variantId), -1)}
                    aria-label={`Reduce quantity for ${item.name}`}
                  >
                    <AppIcon icon={faMinus} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    className="aw-icon-btn success"
                    onClick={() => changePurchaseQuantity(item.lineKey || getProductLineKey(item.productId, item.variantId), 1)}
                    aria-label={`Increase quantity for ${item.name}`}
                  >
                    <AppIcon icon={faPlus} />
                  </button>
                  <button
                    type="button"
                    className="aw-icon-btn"
                    onClick={() => removePurchaseLine(item.lineKey || getProductLineKey(item.productId, item.variantId))}
                    aria-label={`Remove ${item.name}`}
                  >
                    <AppIcon icon={faTrash} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="aw-purchase-footer">
          <strong>{toCurrency(purchaseSubtotal, "GHS")}</strong>
          <button
            type="button"
            className="aw-primary-btn"
            onClick={submitPurchase}
            disabled={purchaseSubmitting}
          >
            {purchaseSubmitting ? "Saving..." : isOnline ? "Save purchase" : "Save offline"}
          </button>
        </div>
      </div>
    </section>
  );

  const renderOffline = () => (
    <section className="aw-section-grid">
      <SyncReviewPanel
        title="Offline sync review"
        description="Review local POS, payment, inventory, and booking actions before retrying or closing them."
        items={sharedSyncQueue.items}
        summary={sharedSyncQueue}
        loading={sharedSyncQueue.loading}
        error={sharedSyncQueue.error || sharedQueuedRetryError || sharedQueuedCancelError}
        onRefresh={sharedSyncQueue.refresh}
        onRetry={retrySharedQueuedAction}
        onCancel={cancelSharedQueuedAction}
        onResolve={resolveSharedQueuedAction}
        retryingId={sharedQueuedRetryingId}
        cancellingId={sharedQueuedCancellingId}
        resolvingId={sharedQueuedResolvingId}
      />
      <div className="glass-card aw-panel">
        <div className="aw-panel-header">
          <h2>Queue</h2>
          <span className="aw-count-pill">{pendingQueue.length}</span>
        </div>
        <div className="aw-toolbar">
          <button
            type="button"
            className="aw-secondary-btn"
            onClick={() => syncQueue()}
            disabled={syncingQueue}
          >
            <AppIcon icon={faCloudArrowUp} />
            {syncingQueue ? "Syncing..." : "Sync now"}
          </button>
          <button type="button" className="aw-secondary-btn" onClick={retryFailedQueue}>
            <AppIcon icon={faRotateRight} />
            Retry failed
          </button>
          <button type="button" className="aw-secondary-btn" onClick={clearSyncedQueue}>
            <AppIcon icon={faTrash} />
            Clear synced
          </button>
        </div>
        {!queue.length ? (
          <p className="aw-muted">No offline actions saved.</p>
        ) : (
          <ul className="aw-queue-list">
            {queue.map((item) => (
              <li key={item.id} className={`aw-queue-item ${item.status}`}>
                <div>
                  <strong>{item.label}</strong>
                  <p>{formatDateTime(item.createdAt)}</p>
                </div>
                <div className="aw-queue-status">
                  <span className={`aw-status-chip ${item.status}`}>
                    {item.status}
                  </span>
                  {item.lastError && <small>{item.lastError}</small>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );

  return (
    <div className="aw-shell">
      <header className="aw-topbar">
        <div className="aw-title-block">
          <h1>{sectionTitle}</h1>
          <p>{sectionSubtitle}</p>
        </div>
        <div className="aw-actions">
          <span className={`aw-online-pill ${isOnline ? "online" : "offline"}`}>
            {isOnline ? "Online" : "Offline"}
          </span>
          {totalOverdueCount > 0 && (
            <span className="aw-overdue-badge" role="status" aria-live="polite">
              {totalOverdueCount} overdue
            </span>
          )}
          <button
            type="button"
            className="aw-secondary-btn"
            onClick={() => syncQueue()}
            disabled={syncingQueue}
          >
            <AppIcon icon={faRotateRight} />
            Sync
          </button>
          <button type="button" className="aw-secondary-btn" onClick={logout}>
            <AppIcon icon={faArrowRightFromBracket} />
            Logout
          </button>
        </div>
      </header>

      {(surfaceNotice || surfaceError || inventoryError) && (
        <section className="aw-feedback">
          {surfaceNotice && (
            <InlineNotice tone="success" compact title="Workspace updated" message={surfaceNotice} />
          )}
          {surfaceError && <InlineNotice tone="error" compact message={surfaceError} />}
          {inventoryError && <InlineNotice tone="warning" compact message={inventoryError} />}
        </section>
      )}

      {activeSection === "home" && renderHome()}
      {activeSection === "inventory" && renderInventory()}
      {activeSection === "purchases" && renderPurchases()}
      {activeSection === "offline" && renderOffline()}
    </div>
  );
}

export default AdminWorkspace;
