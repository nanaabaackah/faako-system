import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./AdminWorkspace.css";
import { useNavigate } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faArrowRightFromBracket,
  faCircleCheck,
  faCloudArrowUp,
  faMagnifyingGlass,
  faMinus,
  faPlus,
  faRotateRight,
  faTrash,
} from "/src/icons/iconSet";
import { useAuth } from "../../components/AuthContext/AuthContext";
import {
  createQueueItem,
  loadCustomerSnapshot,
  loadInventorySnapshot,
  loadOfflineQueue,
  saveCustomerSnapshot,
  saveInventorySnapshot,
  saveOfflineQueue,
} from "../../utils/offlineQueue";
import { ADMIN_QUICK_ACTIONS } from "../../utils/adminQuickActions";
import SearchField from "../../components/SearchField/SearchField";

const STOCK_ACTION_OPTIONS = [1, 5, 10];
const LOW_STOCK_THRESHOLD = 5;
const APPROVAL_ORDER_MIN = 2000;
const APPROVAL_BOOKING_MIN = 3000;

const normalizeRole = (value) => String(value || "").trim().toLowerCase();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getQuantity = (item) => {
  const raw = item?.quantity ?? item?.stock ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getPrice = (item) => {
  const parsed = Number(item?.price);
  return Number.isFinite(parsed) ? parsed : 0;
};

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

const isLikelyOfflineError = (error) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const message = String(error?.message || "").toLowerCase();
  return message.includes("network") || message.includes("failed to fetch");
};

const INITIAL_PURCHASE_STATUS = "paid";

const SECTION_CONFIG = {
  home: { title: "Control Hub", subtitle: "Simple daily flow for store staff." },
  inventory: { title: "Stock", subtitle: "Fast count updates from phone." },
  purchases: { title: "Purchases", subtitle: "Quick checkout from inventory." },
  offline: { title: "Offline Sync", subtitle: "Queued actions and retry status." },
  advanced: { title: "System Admin", subtitle: "Advanced monitoring and controls." },
};

function AdminWorkspace({ section = "home" }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const roleKey = normalizeRole(user?.role);
  const isSystemAdmin = roleKey === "admin";
  const isManager = roleKey === "manager";
  const canViewHomeKpis = roleKey === "admin" || roleKey === "manager";

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

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [quickQuantity, setQuickQuantity] = useState(1);
  const [stockBusyId, setStockBusyId] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);

  const [adminViewMode, setAdminViewMode] = useState("simple");
  const [surfaceError, setSurfaceError] = useState("");
  const [surfaceNotice, setSurfaceNotice] = useState("");
  const [kpiStats, setKpiStats] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState("");
  const [directoryStats, setDirectoryStats] = useState({
    customers: 0,
    vendors: 0,
    avgLeadTime: 0,
    leadTimeCoverage: 0,
  });
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [approvalItems, setApprovalItems] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalsError, setApprovalsError] = useState("");

  const profileName =
    user?.fullName ||
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Team member";

  const viewModeStorageKey = useMemo(
    () => `reebs_admin_view_mode_${user?.id || "guest"}`,
    [user?.id]
  );

  const activeSection = section in SECTION_CONFIG ? section : "home";
  const sectionConfig = SECTION_CONFIG[activeSection];

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
    if (!quiet) {
      setInventoryLoading(true);
      setInventoryError("");
    }
    try {
      const response = await fetch("/.netlify/functions/inventory");
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
  }, []);

  const loadCustomers = useCallback(async () => {
    setCustomerError("");
    try {
      const response = await fetch("/.netlify/functions/customers");
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
  }, []);

  const setProductQuantity = useCallback((productId, nextQty) => {
    const safeQty = Math.max(0, Number(nextQty) || 0);
    setInventory((prev) =>
      prev.map((item) =>
        Number(item.id) === Number(productId)
          ? { ...item, quantity: safeQty, stock: safeQty }
          : item
      )
    );
  }, []);

  const adjustProductQuantity = useCallback((productId, delta) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (Number(item.id) !== Number(productId)) return item;
        const nextQty = Math.max(0, getQuantity(item) + delta);
        return { ...item, quantity: nextQty, stock: nextQty };
      })
    );
  }, []);

  const queueAction = useCallback((queueItem) => {
    setQueue((prev) => [...prev, queueItem]);
  }, []);

  const sendStockUpdate = useCallback(
    async (payload) => postJson("/.netlify/functions/stock", payload),
    [postJson]
  );

  const sendPurchase = useCallback(
    async (payload) => postJson("/.netlify/functions/createOrder", payload),
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

  const fetchHomeKpis = useCallback(async () => {
    if (!canViewHomeKpis) {
      setKpiStats(null);
      setKpiError("");
      return;
    }
    setKpiLoading(true);
    setKpiError("");
    try {
      const response = await fetch(`/.netlify/functions/orderStats?ts=${Date.now()}`);
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
  }, [canViewHomeKpis, normalizeKpiStats]);

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
      const [customersRes, vendorsRes] = await Promise.all([
        fetch("/.netlify/functions/customers"),
        fetch("/.netlify/functions/vendors"),
      ]);
      const [customersData, vendorsData] = await Promise.all([
        customersRes.json().catch(() => null),
        vendorsRes.json().catch(() => null),
      ]);
      if (!customersRes.ok) {
        throw new Error(customersData?.error || "Failed to load customers.");
      }
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
        customers: Array.isArray(customersData) ? customersData.length : 0,
        vendors: vendorRows.length,
        avgLeadTime,
        leadTimeCoverage: leadTimes.length,
      });
    } catch (error) {
      setDirectoryError(error.message || "Unable to load directory KPIs.");
    } finally {
      setDirectoryLoading(false);
    }
  }, [canViewHomeKpis]);

  const fetchApprovals = useCallback(async () => {
    if (!canViewHomeKpis) {
      setApprovalItems([]);
      setApprovalsError("");
      return;
    }
    setApprovalsLoading(true);
    setApprovalsError("");
    try {
      const [ordersRes, bookingsRes] = await Promise.all([
        fetch("/.netlify/functions/orders"),
        fetch("/.netlify/functions/bookings"),
      ]);
      const [ordersData, bookingsData] = await Promise.all([
        ordersRes.json().catch(() => null),
        bookingsRes.json().catch(() => null),
      ]);
      if (!ordersRes.ok) throw new Error(ordersData?.error || "Failed to load orders.");
      if (!bookingsRes.ok) throw new Error(bookingsData?.error || "Failed to load bookings.");

      const nextItems = [];
      const orders = Array.isArray(ordersData) ? ordersData : [];
      orders.forEach((order) => {
        const status = String(order.status || "").toLowerCase();
        const amount = Number(order.total || 0);
        if (!Number.isFinite(amount) || amount < APPROVAL_ORDER_MIN) return;
        if (status !== "pending") return;
        nextItems.push({
          key: `order-${order.id}`,
          type: "order",
          id: order.id,
          title: order.orderNumber || `Order #${order.id}`,
          meta: order.customerName ? `Customer: ${order.customerName}` : "High-value order",
          amount,
          date: order.orderDate,
          href: "/admin/purchases",
        });
      });

      const bookings = Array.isArray(bookingsData) ? bookingsData : [];
      bookings.forEach((booking) => {
        const status = String(booking.status || "").toLowerCase();
        const amount = Number(booking.totalAmount || 0) / 100;
        if (!Number.isFinite(amount) || amount < APPROVAL_BOOKING_MIN) return;
        if (status !== "pending") return;
        nextItems.push({
          key: `booking-${booking.id}`,
          type: "booking",
          id: booking.id,
          title: `Booking #${booking.id}`,
          meta: booking.customerName ? `Client: ${booking.customerName}` : "High-value booking",
          amount,
          date: booking.eventDate,
          href: "/admin/bookings",
        });
      });

      nextItems.sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      });
      setApprovalItems(nextItems.slice(0, 6));
    } catch (error) {
      setApprovalsError(error.message || "Unable to load approvals.");
    } finally {
      setApprovalsLoading(false);
    }
  }, [canViewHomeKpis]);

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
    [isOnline, loadInventory, queue, sendPurchase, sendStockUpdate, syncingQueue]
  );

  useEffect(() => {
    document.body.classList.add("admin-theme", "aw-theme");
    return () => {
      document.body.classList.remove("admin-theme", "aw-theme");
    };
  }, []);

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
    if (typeof window === "undefined" || !isSystemAdmin) {
      setAdminViewMode("simple");
      return;
    }
    try {
      const stored = window.localStorage.getItem(viewModeStorageKey);
      if (stored === "advanced" || stored === "simple") {
        setAdminViewMode(stored);
      }
    } catch {
      setAdminViewMode("simple");
    }
  }, [isSystemAdmin, viewModeStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !isSystemAdmin) return;
    try {
      window.localStorage.setItem(viewModeStorageKey, adminViewMode);
    } catch {
      // ignore
    }
  }, [adminViewMode, isSystemAdmin, viewModeStorageKey]);

  useEffect(() => {
    loadInventory();
    loadCustomers();
  }, [loadCustomers, loadInventory]);

  useEffect(() => {
    if (!canViewHomeKpis) return;
    fetchHomeKpis();
    fetchDirectoryKpis();
    fetchApprovals();
  }, [canViewHomeKpis, fetchApprovals, fetchDirectoryKpis, fetchHomeKpis]);

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
  const syncedQueueCount = useMemo(
    () => queue.filter((item) => item.status === "synced").length,
    [queue]
  );

  const topProducts = useMemo(() => kpiStats?.topProducts || [], [kpiStats]);
  const kpiLowStockItems = useMemo(() => kpiStats?.lowStockItems || [], [kpiStats]);
  const topBookedRental = useMemo(() => kpiStats?.topRentalBookings?.[0], [kpiStats]);
  const operatingExpensesWindow =
    kpiStats?.operatingExpensesWindow ?? kpiStats?.operatingExpenses ?? 0;
  const operatingExpensesDisplay = kpiStats?.operatingExpenses ?? 0;
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
  const avgLeadTime = directoryStats?.avgLeadTime ?? 0;
  const avgLeadTimeLabel = avgLeadTime ? `${avgLeadTime} days` : "—";
  const leadTimeCoverage = directoryStats?.leadTimeCoverage ?? 0;
  const lowStockCount = kpiStats?.lowStockCount ?? kpiLowStockItems.length;
  const conflictsCount = kpiStats?.conflicts?.length || 0;
  const lockedInValue = kpiStats?.lockedInNextQuarter ?? 0;
  const netMarginPctRaw = totalRevenue > 0 ? Math.round((netAfterExpenses / totalRevenue) * 100) : 0;
  const netMarginPct = Math.max(0, Math.min(100, netMarginPctRaw));
  const inventoryRiskPct = inventory.length
    ? Math.min(100, Math.round((lowStockCount / Math.max(1, inventory.length)) * 100))
    : 0;
  const lockedInPct = totalRevenue > 0 ? Math.min(100, Math.round((lockedInValue / totalRevenue) * 100)) : 0;
  const leadCoveragePct = directoryStats?.vendors
    ? Math.min(100, Math.round((leadTimeCoverage / Math.max(1, directoryStats.vendors)) * 100))
    : 0;
  const revenueMixSegments = useMemo(
    () => [
      { key: "retail", label: "Retail", value: Math.max(0, retailRevenue), color: "#3b82f6" },
      { key: "rental", label: "Rental", value: Math.max(0, rentalRevenue), color: "#14b8a6" },
      { key: "expenses", label: "Expenses", value: Math.max(0, operatingExpensesWindow), color: "#f59e0b" },
    ],
    [retailRevenue, rentalRevenue, operatingExpensesWindow]
  );
  const revenueMixTotal = useMemo(
    () => revenueMixSegments.reduce((sum, segment) => sum + segment.value, 0),
    [revenueMixSegments]
  );
  const revenueDonutRadius = 44;
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
  const operationsBars = useMemo(
    () => [
      { key: "orders", label: "Orders", value: kpiStats?.orders ?? 0, color: "#3b82f6" },
      { key: "bookings", label: "Bookings", value: kpiStats?.bookings ?? 0, color: "#14b8a6" },
      { key: "low-stock", label: "Low stock", value: lowStockCount, color: "#f59e0b" },
      { key: "approvals", label: "Approvals", value: approvalItems.length, color: "#ef4444" },
      { key: "queue", label: "Queue pending", value: pendingQueue.length, color: "#8b5cf6" },
    ],
    [approvalItems.length, kpiStats?.bookings, kpiStats?.orders, lowStockCount, pendingQueue.length]
  );
  const operationsBarsMax = useMemo(
    () => Math.max(1, ...operationsBars.map((entry) => entry.value)),
    [operationsBars]
  );
  const conflictText = useMemo(() => {
    const conflicts = kpiStats?.conflicts || [];
    if (!conflicts.length) return "No inventory conflicts detected.";
    const first = conflicts[0];
    const bookingIds = Array.isArray(first.booking_ids)
      ? first.booking_ids.map((id) => `#${id}`).join(", ")
      : "";
    const shortDate = first.event_date ? formatDate(first.event_date) : "";
    const moreCount = conflicts.length > 1 ? ` + ${conflicts.length - 1} more conflict(s)` : "";
    return `Product #${first.product_id} (${first.product_name || "Item"}) needs ${first.total_quantity} on ${shortDate} with only ${first.product_stock ?? 0} in stock. Bookings: ${bookingIds}${moreCount}`;
  }, [kpiStats]);

  const searchedInventory = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const sorted = [...inventory].sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""))
    );
    if (!needle) return sorted;
    return sorted.filter((item) => {
      const name = String(item?.name || "").toLowerCase();
      const sku = String(item?.sku || "").toLowerCase();
      const barcode = String(item?.barcode || "").toLowerCase();
      return name.includes(needle) || sku.includes(needle) || barcode.includes(needle);
    });
  }, [inventory, search]);

  const visibleInventory = useMemo(() => {
    return searchedInventory.filter((item) => {
      const quantity = getQuantity(item);
      if (stockFilter === "in") return quantity > 0;
      if (stockFilter === "out") return quantity <= 0;
      if (stockFilter === "low") return quantity <= LOW_STOCK_THRESHOLD;
      return true;
    });
  }, [searchedInventory, stockFilter]);

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

  const purchaseCatalog = useMemo(() => {
    const products = searchedInventory.filter((item) => getQuantity(item) > 0);
    return products.slice(0, 80);
  }, [searchedInventory]);

  const purchaseCount = useMemo(
    () => purchaseItems.reduce((sum, item) => sum + item.quantity, 0),
    [purchaseItems]
  );

  const purchaseSubtotal = useMemo(
    () => purchaseItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [purchaseItems]
  );

  const addProductToPurchase = (item) => {
    const maxStock = getQuantity(item);
    if (maxStock <= 0) return;
    setPurchaseItems((prev) => {
      const existing = prev.find((row) => row.productId === item.id);
      if (existing) {
        if (existing.quantity >= maxStock) return prev;
        return prev.map((row) =>
          row.productId === item.id ? { ...row, quantity: row.quantity + 1 } : row
        );
      }
      return [
        ...prev,
        {
          productId: item.id,
          name: item.name,
          quantity: 1,
          unitPrice: getPrice(item),
          currency: item.currency || "GHS",
        },
      ];
    });
  };

  const changePurchaseQuantity = (productId, delta) => {
    const product = inventory.find((item) => Number(item.id) === Number(productId));
    const maxStock = product ? getQuantity(product) : Infinity;

    setPurchaseItems((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = Math.max(0, Math.min(maxStock, item.quantity + delta));
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removePurchaseLine = (productId) => {
    setPurchaseItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const applyPurchaseToLocalStock = (items) => {
    setInventory((prev) =>
      prev.map((product) => {
        const line = items.find((entry) => Number(entry.productId) === Number(product.id));
        if (!line) return product;
        const nextQty = Math.max(0, getQuantity(product) - Number(line.quantity || 0));
        return { ...product, quantity: nextQty, stock: nextQty };
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

  const handleQuickStock = async (item, direction) => {
    const quantity = quickQuantity;
    if (quantity <= 0) return;

    const movementType = direction === "in" ? "StockIn" : "StockOut";
    const delta = direction === "in" ? quantity : -quantity;
    const payload = {
      productId: item.id,
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
      label: `${item.name} · ${movementType} ${quantity}`,
    });

    setSurfaceError("");
    setSurfaceNotice("");
    setStockBusyId(`${item.id}-${direction}`);

    try {
      if (!isOnline) {
        queueAction(queueItem);
        adjustProductQuantity(item.id, delta);
        setSurfaceNotice(`${item.name}: saved offline.`);
        return;
      }

      const result = await sendStockUpdate(payload);
      const nextStock = Number(result?.newStock);
      if (Number.isFinite(nextStock)) {
        setProductQuantity(item.id, nextStock);
      } else {
        adjustProductQuantity(item.id, delta);
      }
      setSurfaceNotice(
        direction === "in"
          ? `${item.name}: +${quantity} added.`
          : `${item.name}: -${quantity} removed.`
      );
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        queueAction(queueItem);
        adjustProductQuantity(item.id, delta);
        setSurfaceNotice(`${item.name}: queued for sync.`);
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
    <section className="aw-section-grid">
      <div className="aw-home-summary-grid">
        <article className="aw-home-summary-card">
          <p className="aw-home-kpi-label">Items</p>
          <strong>{inventory.length}</strong>
          <span>Tracked products</span>
        </article>
        <article className="aw-home-summary-card">
          <p className="aw-home-kpi-label">Low stock</p>
          <strong>{inventoryLowStockItems.length}</strong>
          <span>{inventoryLowStockItems.length ? "Needs action" : "Healthy"}</span>
        </article>
        <article className="aw-home-summary-card">
          <p className="aw-home-kpi-label">Queue</p>
          <strong>{pendingQueue.length}</strong>
          <span>{failedQueueCount} failed</span>
        </article>
        <article className="aw-home-summary-card">
          <p className="aw-home-kpi-label">Status</p>
          <strong>{isOnline ? "Online" : "Offline"}</strong>
          <span>{syncingQueue ? "Syncing now" : "Ready"}</span>
        </article>
      </div>

      {canViewHomeKpis ? (
        <>
          <div className="aw-panel aw-home-kpi-panel">
            <div className="aw-panel-header">
              <h2>Business KPI Dashboard</h2>
              <button
                type="button"
                className="aw-secondary-btn"
                onClick={() => {
                  fetchHomeKpis();
                  fetchDirectoryKpis();
                  fetchApprovals();
                }}
                disabled={kpiLoading || directoryLoading || approvalsLoading}
              >
                <AppIcon icon={faRotateRight} />
                Refresh KPI
              </button>
            </div>
            {kpiLoading && <p className="aw-muted">Loading KPI data...</p>}
            {!kpiLoading && kpiError && <p className="aw-feedback-error">{kpiError}</p>}
            {!kpiLoading && !kpiError && (
              <>
                <div className="aw-home-kpi-grid">
                  <article className="aw-home-kpi-card aw-home-kpi-card-hero">
                    <p className="aw-home-kpi-label">Revenue</p>
                    <strong>{toCurrency(totalRevenue, "GHS")}</strong>
                    <span>Retail {revenueSplit.retailPct}% • Rental {revenueSplit.rentalPct}%</span>
                  </article>
                  <article className="aw-home-kpi-card aw-home-kpi-card-hero">
                    <p className="aw-home-kpi-label">Net after expenses</p>
                    <strong>{toCurrency(netAfterExpenses, "GHS")}</strong>
                    <span>{netMarginPctRaw}% margin</span>
                    <div className="aw-home-kpi-meter">
                      <span style={{ width: `${netMarginPct}%` }} />
                    </div>
                  </article>
                  <article className="aw-home-kpi-card aw-home-kpi-card-hero">
                    <p className="aw-home-kpi-label">Inventory value</p>
                    <strong>{toCurrency(inventoryValue, "GHS")}</strong>
                    <span>{inventoryRiskPct}% low-stock risk</span>
                    <div className="aw-home-kpi-meter is-warning">
                      <span style={{ width: `${Math.max(8, 100 - inventoryRiskPct)}%` }} />
                    </div>
                  </article>
                  <article className="aw-home-kpi-card aw-home-kpi-card-hero">
                    <p className="aw-home-kpi-label">Locked-in next quarter</p>
                    <strong>{toCurrency(lockedInValue, "GHS")}</strong>
                    <span>{kpiStats?.nextQuarterLabel || "Next quarter"}</span>
                    <div className="aw-home-kpi-meter is-accent">
                      <span style={{ width: `${lockedInPct}%` }} />
                    </div>
                  </article>
                </div>

                <div className="aw-home-kpi-chart-grid">
                  <article className="aw-home-kpi-chart-card">
                    <div className="aw-home-kpi-chart-head">
                      <h3>Revenue mix</h3>
                      <span>Retail, rental, expenses</span>
                    </div>
                    <div className="aw-home-kpi-donut-wrap">
                      <div className="aw-home-kpi-donut-shell">
                        <svg viewBox="0 0 120 120" role="img" aria-label="Revenue composition">
                          <circle
                            className="aw-home-kpi-donut-track"
                            cx="60"
                            cy="60"
                            r={revenueDonutRadius}
                          />
                          {revenueMixDonut.map((segment) => (
                            <circle
                              key={segment.key}
                              cx="60"
                              cy="60"
                              r={revenueDonutRadius}
                              fill="none"
                              stroke={segment.color}
                              strokeWidth="12"
                              strokeLinecap="round"
                              strokeDasharray={`${segment.dash} ${revenueDonutCircumference - segment.dash}`}
                              strokeDashoffset={segment.offset}
                              transform="rotate(-90 60 60)"
                            />
                          ))}
                        </svg>
                        <div className="aw-home-kpi-donut-center">
                          <strong>{toCurrency(totalRevenue, "GHS")}</strong>
                          <span>Total revenue</span>
                        </div>
                      </div>
                      <ul className="aw-home-kpi-legend">
                        {revenueMixSegments.map((segment) => {
                          const percentage = revenueMixTotal
                            ? Math.round((segment.value / revenueMixTotal) * 100)
                            : 0;
                          return (
                            <li key={segment.key}>
                              <span style={{ backgroundColor: segment.color }} />
                              <b>{segment.label}</b>
                              <em>{percentage}%</em>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </article>

                  <article className="aw-home-kpi-chart-card">
                    <div className="aw-home-kpi-chart-head">
                      <h3>Operational load</h3>
                      <span>Key work queues right now</span>
                    </div>
                    <ul className="aw-home-kpi-bars">
                      {operationsBars.map((entry) => {
                        const widthPct = Math.round((entry.value / operationsBarsMax) * 100);
                        return (
                          <li key={entry.key} className="aw-home-kpi-bar-row">
                            <div className="aw-home-kpi-bar-label">
                              <span>{entry.label}</span>
                              <strong>{entry.value}</strong>
                            </div>
                            <div className="aw-home-kpi-bar-track">
                              <span
                                style={{
                                  width: `${entry.value > 0 ? Math.max(10, widthPct) : 0}%`,
                                  backgroundColor: entry.color,
                                }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                </div>

                <div className="aw-home-kpi-grid aw-home-kpi-grid-tight">
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Sales</p>
                    <strong>{kpiStats?.orders ?? 0}</strong>
                    <span>Orders placed</span>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Units sold</p>
                    <strong>{kpiStats?.units ?? 0}</strong>
                    <span>Items shipped</span>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Bookings</p>
                    <strong>{kpiStats?.bookings ?? 0}</strong>
                    <span>{toCurrency(kpiStats?.bookingRevenue ?? 0, "GHS")}</span>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Operating expenses</p>
                    <strong>{toCurrency(operatingExpensesDisplay, "GHS")}</strong>
                    <span>{kpiStats?.expenseWindowLabel || "Last 30 days"}</span>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Maintenance requests</p>
                    <strong>{kpiStats?.maintenanceOpen ?? 0}</strong>
                    <span>{toCurrency(kpiStats?.maintenanceCost ?? 0, "GHS")}</span>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Customers</p>
                    <strong>{directoryStats.customers ?? 0}</strong>
                    <span>
                      {directoryError
                        ? "Directory unavailable"
                        : directoryLoading
                          ? "Loading directory..."
                          : "CRM records"}
                    </span>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Vendors</p>
                    <strong>{directoryStats.vendors ?? 0}</strong>
                    <span>
                      {directoryError
                        ? "Directory unavailable"
                        : directoryLoading
                          ? "Loading directory..."
                          : "Suppliers listed"}
                    </span>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Avg lead time</p>
                    <strong>{avgLeadTimeLabel}</strong>
                    <span>
                      {directoryError
                        ? "Directory unavailable"
                        : `${leadTimeCoverage} vendor${leadTimeCoverage === 1 ? "" : "s"} tracked`}
                    </span>
                    <div className="aw-home-kpi-meter is-neutral">
                      <span style={{ width: `${leadCoveragePct}%` }} />
                    </div>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Low stock items</p>
                    <strong>{lowStockCount}</strong>
                    <span>{lowStockCount > 0 ? "Needs reorder" : "All above reorder level"}</span>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Cash flow projection</p>
                    <strong>{toCurrency(lockedInValue, "GHS")}</strong>
                    <span>Confirmed bookings for {kpiStats?.nextQuarterLabel || "next quarter"}</span>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Inventory conflicts</p>
                    <strong>{conflictsCount}</strong>
                    <span>{conflictsCount ? "Conflicts detected" : "No conflicts"}</span>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Retail revenue split</p>
                    <strong>{revenueSplit.retailPct}%</strong>
                    <span>{toCurrency(retailRevenue, "GHS")}</span>
                  </article>
                  <article className="aw-home-kpi-card">
                    <p className="aw-home-kpi-label">Rental revenue split</p>
                    <strong>{revenueSplit.rentalPct}%</strong>
                    <span>{toCurrency(rentalRevenue, "GHS")}</span>
                  </article>
                </div>
              </>
            )}
          </div>

          <div className="aw-panel">
            <div className="aw-panel-header">
              <h2>KPI Detail</h2>
            </div>
            <div className="aw-home-kpi-grid aw-home-kpi-grid-tight">
              <article className="aw-home-kpi-card">
                <p className="aw-home-kpi-label">Popular products</p>
                {!topProducts.length ? (
                  <p className="aw-muted">No product data yet.</p>
                ) : (
                  <ul className="aw-queue-list">
                    {topProducts.slice(0, 5).map((item) => (
                      <li key={`${item.id}-${item.sku || "sku"}`} className="aw-queue-item">
                        <div>
                          <strong>{item.name || item.sku || "Product"}</strong>
                          <p>{item.sku || "No SKU"}</p>
                        </div>
                        <span className="aw-status-chip pending">{item.units || 0} units</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
              <article className="aw-home-kpi-card">
                <p className="aw-home-kpi-label">Top booked rental</p>
                {topBookedRental ? (
                  <>
                    <strong>{topBookedRental.name || "Untitled"}</strong>
                    <p className="aw-muted">
                      {topBookedRental.units || 0} bookings • {toCurrency(topBookedRental.revenue || 0, "GHS")}
                    </p>
                  </>
                ) : (
                  <p className="aw-muted">No recent rental bookings.</p>
                )}
              </article>
              <article className="aw-home-kpi-card">
                <p className="aw-home-kpi-label">Stock velocity</p>
                {!kpiStats?.velocity?.length ? (
                  <p className="aw-muted">No stock movement data.</p>
                ) : (
                  <ul className="aw-queue-list">
                    {kpiStats.velocity.map((row) => (
                      <li key={row.label} className="aw-queue-item">
                        <div>
                          <strong>{row.label}</strong>
                          <p>In: {row.stockIn} • Out: {row.stockOut}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
              <article className="aw-home-kpi-card">
                <p className="aw-home-kpi-label">Conflict summary</p>
                <p className="aw-muted">{conflictText}</p>
              </article>
            </div>
          </div>

          <div className="aw-panel">
            <div className="aw-panel-header">
              <h2>Approvals queue</h2>
              <span className="aw-count-pill">{approvalItems.length} waiting</span>
            </div>
            {approvalsLoading && <p className="aw-muted">Loading approvals...</p>}
            {!approvalsLoading && approvalsError && <p className="aw-feedback-error">{approvalsError}</p>}
            {!approvalsLoading && !approvalsError && !approvalItems.length && (
              <p className="aw-muted">No approvals waiting.</p>
            )}
            {!approvalsLoading && !approvalsError && approvalItems.length > 0 && (
              <ul className="aw-queue-list">
                {approvalItems.map((item) => (
                  <li key={item.key} className="aw-queue-item">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.meta}</p>
                      <p>Due {formatDate(item.date)}</p>
                    </div>
                    <div className="aw-queue-status">
                      <span className="aw-status-chip pending">{toCurrency(item.amount, "GHS")}</span>
                      <button type="button" className="aw-link-btn" onClick={() => navigate(item.href)}>
                        Open
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="aw-panel">
          <p className="aw-muted">
            Home KPI dashboard is restricted to system admins and managers.
          </p>
        </div>
      )}

      <div className="aw-panel">
        <div className="aw-panel-header">
          <h2>Quick Stock</h2>
          <button type="button" className="aw-link-btn" onClick={() => navigate("/admin/inventory")}>
            Open stock
          </button>
        </div>
        {inventoryLoading ? (
          <p className="aw-muted">Loading stock...</p>
        ) : inventoryLowStockItems.length ? (
          <div className="aw-stock-list">
            {inventoryLowStockItems.slice(0, 6).map((item) => {
              const outBusy = stockBusyId === `${item.id}-out`;
              const inBusy = stockBusyId === `${item.id}-in`;
              return (
                <article key={item.id} className="aw-stock-card">
                  <div>
                    <h3>{item.name}</h3>
                    <p>Qty {getQuantity(item)}</p>
                  </div>
                  <div className="aw-stock-actions">
                    <button
                      type="button"
                      className="aw-icon-btn danger"
                      onClick={() => handleQuickStock(item, "out")}
                      disabled={outBusy}
                      aria-label={`Reduce stock for ${item.name}`}
                    >
                      <AppIcon icon={faMinus} />
                    </button>
                    <button
                      type="button"
                      className="aw-icon-btn success"
                      onClick={() => handleQuickStock(item, "in")}
                      disabled={inBusy}
                      aria-label={`Increase stock for ${item.name}`}
                    >
                      <AppIcon icon={faPlus} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="aw-muted">No low-stock alerts.</p>
        )}
      </div>

      {isSystemAdmin && adminViewMode === "advanced" && (
        <div className="aw-panel">
          <div className="aw-panel-header">
            <h2>Admin Signal</h2>
          </div>
          <div className="aw-kpi-grid">
            <article className="aw-kpi">
              <p className="aw-kpi-label">Failed Sync</p>
              <strong>{failedQueueCount}</strong>
            </article>
            <article className="aw-kpi">
              <p className="aw-kpi-label">Synced</p>
              <strong>{syncedQueueCount}</strong>
            </article>
            <article className="aw-kpi">
              <p className="aw-kpi-label">Stock Snapshot</p>
              <strong>{usingInventorySnapshot ? "Cached" : "Live"}</strong>
            </article>
            <article className="aw-kpi">
              <p className="aw-kpi-label">Customer Snapshot</p>
              <strong>{usingCustomerSnapshot ? "Cached" : "Live"}</strong>
            </article>
          </div>
        </div>
      )}
    </section>
  );

  const renderInventory = () => (
    <section className="aw-section-grid">
      <div className="aw-panel">
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
          <p className="aw-muted">Loading stock...</p>
        ) : (
          <div className="aw-stock-list">
            {visibleInventory.map((item) => {
              const outBusy = stockBusyId === `${item.id}-out`;
              const inBusy = stockBusyId === `${item.id}-in`;
              const quantity = getQuantity(item);
              const isLow = quantity <= LOW_STOCK_THRESHOLD;
              return (
                <article key={item.id} className="aw-stock-card">
                  <div className="aw-stock-meta">
                    <h3>{item.name}</h3>
                    <p>{item.sku || "No SKU"}</p>
                    <span className={`aw-stock-badge ${isLow ? "is-low" : ""}`}>
                      Qty {quantity}
                    </span>
                  </div>
                  <div className="aw-stock-actions">
                    <button
                      type="button"
                      className="aw-icon-btn danger"
                      onClick={() => handleQuickStock(item, "out")}
                      disabled={outBusy}
                      aria-label={`Reduce stock for ${item.name}`}
                    >
                      <AppIcon icon={faMinus} />
                    </button>
                    <button
                      type="button"
                      className="aw-icon-btn success"
                      onClick={() => handleQuickStock(item, "in")}
                      disabled={inBusy}
                      aria-label={`Increase stock for ${item.name}`}
                    >
                      <AppIcon icon={faPlus} />
                    </button>
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
      <div className="aw-panel">
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
          <select
            className="aw-select"
            value={selectedCustomerId}
            onChange={(event) => setSelectedCustomerId(event.target.value)}
            aria-label="Select customer"
          >
            <option value="">Choose customer</option>
            {filteredCustomers.slice(0, 100).map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        {customerError && <p className="aw-muted">{customerError}</p>}
      </div>

      <div className="aw-panel">
        <div className="aw-panel-header">
          <h2>Products</h2>
          <span className="aw-count-pill">{purchaseCatalog.length}</span>
        </div>
        <div className="aw-product-grid">
          {purchaseCatalog.map((item) => (
            <button
              key={item.id}
              type="button"
              className="aw-product-btn"
              onClick={() => addProductToPurchase(item)}
            >
              <span>{item.name}</span>
              <small>{toCurrency(getPrice(item), item.currency || "GHS")}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="aw-panel">
        <div className="aw-panel-header">
          <h2>Basket</h2>
          <span className="aw-count-pill">{purchaseCount}</span>
        </div>
        {!purchaseItems.length ? (
          <p className="aw-muted">No products selected.</p>
        ) : (
          <ul className="aw-basket-list">
            {purchaseItems.map((item) => (
              <li key={item.productId} className="aw-basket-item">
                <div className="aw-basket-main">
                  <strong>{item.name}</strong>
                  <span>{toCurrency(item.unitPrice, item.currency || "GHS")}</span>
                </div>
                <div className="aw-basket-actions">
                  <button
                    type="button"
                    className="aw-icon-btn danger"
                    onClick={() => changePurchaseQuantity(item.productId, -1)}
                    aria-label={`Reduce quantity for ${item.name}`}
                  >
                    <AppIcon icon={faMinus} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    className="aw-icon-btn success"
                    onClick={() => changePurchaseQuantity(item.productId, 1)}
                    aria-label={`Increase quantity for ${item.name}`}
                  >
                    <AppIcon icon={faPlus} />
                  </button>
                  <button
                    type="button"
                    className="aw-icon-btn"
                    onClick={() => removePurchaseLine(item.productId)}
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
      <div className="aw-panel">
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

  const renderAdvanced = () => (
    <section className="aw-section-grid">
      <div className="aw-panel">
        <div className="aw-panel-header">
          <h2>Admin Controls</h2>
        </div>
        {isSystemAdmin ? (
          <div className="aw-admin-toggle">
            <button
              type="button"
              className={`aw-pill ${adminViewMode === "simple" ? "is-active" : ""}`}
              onClick={() => setAdminViewMode("simple")}
            >
              Simple
            </button>
            <button
              type="button"
              className={`aw-pill ${adminViewMode === "advanced" ? "is-active" : ""}`}
              onClick={() => setAdminViewMode("advanced")}
            >
              Advanced
            </button>
          </div>
        ) : (
          <p className="aw-muted">Manager view with direct access to KPI-linked modules.</p>
        )}
      </div>

      <div className="aw-panel">
        <div className="aw-panel-header">
          <h2>Legacy Modules</h2>
        </div>
        <div className="aw-link-grid">
          {ADMIN_QUICK_ACTIONS.map((item) => (
            <button
              key={item.path}
              type="button"
              className="aw-link-card"
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="aw-panel">
        <div className="aw-panel-header">
          <h2>System Health</h2>
        </div>
        <div className="aw-kpi-grid">
          <article className="aw-kpi">
            <p className="aw-kpi-label">Queue pending</p>
            <strong>{pendingQueue.length}</strong>
          </article>
          <article className="aw-kpi">
            <p className="aw-kpi-label">Queue failed</p>
            <strong>{failedQueueCount}</strong>
          </article>
            <article className="aw-kpi">
              <p className="aw-kpi-label">Low stock</p>
              <strong>{inventoryLowStockItems.length}</strong>
            </article>
          <article className="aw-kpi">
            <p className="aw-kpi-label">Snapshot mode</p>
            <strong>{usingInventorySnapshot || usingCustomerSnapshot ? "On" : "Off"}</strong>
          </article>
        </div>
      </div>
    </section>
  );

  return (
    <div className="aw-shell">
      <header className="aw-topbar">
        <div className="aw-title-block">
          <p className="aw-eyebrow">REEBS ERP</p>
          <h1>{sectionConfig.title}</h1>
          <p>{sectionConfig.subtitle}</p>
        </div>
        <div className="aw-actions">
          <span className={`aw-online-pill ${isOnline ? "online" : "offline"}`}>
            {isOnline ? "Online" : "Offline"}
          </span>
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
            Sign out
          </button>
        </div>
      </header>

      <section className="aw-user-strip">
        <div>
          <strong>{profileName}</strong>
          <p>{isSystemAdmin ? "System admin" : isManager ? "Manager" : "Store user"}</p>
        </div>
        <div className="aw-user-strip-right">
          <span className="aw-status-chip pending">{pendingQueue.length} pending</span>
          <button
            type="button"
            className="aw-link-btn"
            onClick={() => loadInventory({ quiet: false })}
          >
            Refresh stock
          </button>
        </div>
      </section>

      {(surfaceNotice || surfaceError || inventoryError) && (
        <section className="aw-feedback">
          {surfaceNotice && (
            <p className="aw-feedback-success">
              <AppIcon icon={faCircleCheck} />
              {surfaceNotice}
            </p>
          )}
          {surfaceError && <p className="aw-feedback-error">{surfaceError}</p>}
          {inventoryError && <p className="aw-feedback-note">{inventoryError}</p>}
        </section>
      )}

      {activeSection === "home" && renderHome()}
      {activeSection === "inventory" && renderInventory()}
      {activeSection === "purchases" && renderPurchases()}
      {activeSection === "offline" && renderOffline()}
      {activeSection === "advanced" && renderAdvanced()}

    </div>
  );
}

export default AdminWorkspace;
