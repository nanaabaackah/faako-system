import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SYNC_STATES,
  buildScopedDraftKey,
  clearLocalDraft,
  createIndexedDbQueueStorage,
  incrementRetryMetadata,
  listLocalDrafts,
  readLocalDraft,
  useOnlineStatus,
  writeLocalDraft,
} from "@faako/offline-sync";
import { DateField, FilterBar, SelectField } from "@faako/ui";
import "./OrdersList.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { InlineNotice } from "../../components/InlineNotice/InlineNotice";
import { AppIcon } from "../../components/Icon/Icon";
import SearchField from "../../components/SearchField/SearchField";
import TablePagination from "../../components/TablePagination/TablePagination";
import { canAccessPrivilegedPortalArea } from "../../utils/adminAccess";
import {
  faPlus,
  faReceipt,
  faRotateRight,
  faTableCells,
  faWallet,
} from "../../icons/iconSet";
import {
  formatCurrencyFromCents,
  formatStatusLabel,
  FULFILLMENT_STATUS_FILTER_OPTIONS,
  getOrderLifecycleStatusLabel,
  getOrderLifecycleStatusValue,
  getOrderAmountPaidCents,
  getOrderBalanceCents,
  getOrderTotalCents,
  getOrdersStatusClass,
  majorToCents,
  matchesOrderLifecycleStatusFilter,
  normalizeStatusKey,
  ORDER_SORT_OPTIONS,
  ORDER_SOURCE_ALL_OPTION,
  ORDER_STATUS_FILTER_OPTIONS,
  ORDER_STATUS_FILTER_VALUES,
  ORDER_VIEW_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_FILTER_OPTIONS,
} from "../Orders/orderUi";
import {
  buildQueuedOrderPayment,
  getManualPaymentFailureState,
  getQueuedPaymentNotice,
  isQueuedOrderPaymentForScope,
} from "../Orders/offlineManualPaymentQueue";

const normalizeStatus = (status) => {
  const normalized = normalizeStatusKey(status);
  return normalized === "canceled" ? "cancelled" : normalized;
};

const normalizeOrderStatusFilter = (value) => {
  const normalized = normalizeStatus(value);
  return ORDER_STATUS_FILTER_VALUES.has(normalized) ? normalized : "all";
};

const ORDER_VIEW_ICONS = {
  list: faTableCells,
  cards: faReceipt,
  ledger: faWallet,
};

const getOrderCardStatusClass = (status) => {
  const normalized = normalizeStatus(status) || "pending";
  return `orders-status-pill--${normalized}`;
};

const buildOrdersSearch = ({ query = "", status = "all" } = {}) => {
  const params = new URLSearchParams();
  const trimmedQuery = String(query || "").trim();
  const normalizedStatus = normalizeOrderStatusFilter(status);
  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }
  if (normalizedStatus !== "all") {
    params.set("status", normalizedStatus);
  }
  const next = params.toString();
  return next ? `?${next}` : "";
};

const normalizeOrderItems = (order) => {
  let items =
    order?.items ??
    order?.lineItems ??
    order?.orderItems ??
    order?.products ??
    [];
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items) && items && typeof items === "object") {
    if (Array.isArray(items.items)) {
      items = items.items;
    } else if (Array.isArray(items.lineItems)) {
      items = items.lineItems;
    }
  }
  if (!Array.isArray(items)) items = [];
  return { ...order, items };
};

const getPaymentStage = (order) => {
  const paymentStatus = normalizeStatus(order?.paymentStatus);
  if (["refund_pending", "refunded"].includes(paymentStatus)) return "refunds";
  if (["partial", "partially_paid"].includes(paymentStatus)) return "partially_paid";
  if (["paid", "overpaid"].includes(paymentStatus)) return "paid";
  if (getOrderTotalCents(order) > 0 && getOrderBalanceCents(order) <= 0) {
    return "paid";
  }
  return "unpaid";
};

const PAYMENT_CARD_CATEGORIES = [
  { id: "unpaid", label: "Unpaid" },
  { id: "partially_paid", label: "Partially paid" },
  { id: "paid", label: "Paid" },
  { id: "refunds", label: "Refunds" },
];

const PAYMENT_ACTION_INITIAL_FORM = {
  amount: "",
  method: "cash",
  provider: "",
  transactionReference: "",
  phoneNumber: "",
  notes: "",
};

const hasPaymentActionDraft = (form) =>
  Boolean(
    String(form.amount || "").trim() ||
      String(form.provider || "").trim() ||
      String(form.transactionReference || "").trim() ||
      String(form.phoneNumber || "").trim() ||
      String(form.notes || "").trim() ||
      (form.method || "cash") !== "cash"
  );

const sanitizePaymentActionDraft = (value) => ({
  amount: String(value?.amount || "").slice(0, 32),
  method: ["cash", "mobile_money", "bank_transfer", "card", "other"].includes(value?.method)
    ? value.method
    : "cash",
  provider: String(value?.provider || "").slice(0, 80),
  transactionReference: String(value?.transactionReference || "").slice(0, 120),
  phoneNumber: String(value?.phoneNumber || "").slice(0, 40),
  notes: String(value?.notes || "").slice(0, 240),
  targetStage: value?.targetStage === "paid" ? "paid" : "partially_paid",
});

const MOBILE_VIEW_QUERY = "(max-width: 720px)";

const getIsMobileView = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_VIEW_QUERY).matches;

function OrdersList() {
  const { user } = useAuth();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const restoredPaymentActionDraftRef = useRef(false);
  const paymentActionDraftWriteTimerRef = useRef(null);
  const paymentActionDraftSkipWriteRef = useRef(false);
  const paymentQueueSyncingRef = useRef(false);
  const paymentQueueStorage = useMemo(() => createIndexedDbQueueStorage(), []);
  const roleKey = String(user?.role || "").trim().toLowerCase();
  const canAccessInvoicing = canAccessPrivilegedPortalArea(roleKey);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [isMobileView, setIsMobileView] = useState(getIsMobileView);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [sortKey, setSortKey] = useState("recent");
  const [draggingOrderId, setDraggingOrderId] = useState(null);
  const [dragOverCategory, setDragOverCategory] = useState("");
  const [stateNotice, setStateNotice] = useState(null);
  const [paymentAction, setPaymentAction] = useState(null);
  const [paymentForm, setPaymentForm] = useState(PAYMENT_ACTION_INITIAL_FORM);
  const [paymentFormTouched, setPaymentFormTouched] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState(null);
  const [paymentDraftNotice, setPaymentDraftNotice] = useState(null);
  const [paymentQueueNotice, setPaymentQueueNotice] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const loadOrders = useCallback(async (signal) => {
    const fallbackController = signal ? null : new AbortController();
    const fetchSignal = signal || fallbackController.signal;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders?compact=1&limit=500", {
        signal: fetchSignal,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch orders.");
      }
      const data = await response.json();
      const rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      setOrders(rows.map(normalizeOrderItems));
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Failed to load orders", err);
      setError("We couldn't load orders right now.");
    } finally {
      if (!fetchSignal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadOrders(controller.signal);
    return () => controller.abort();
  }, [loadOrders]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextQuery = params.get("q") || "";
    const nextStatus = normalizeOrderStatusFilter(params.get("status"));
    setQuery((current) => (current === nextQuery ? current : nextQuery));
    setStatusFilter((current) => (current === nextStatus ? current : nextStatus));
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderId = params.get("id");
    if (!orderId || loading) return;

    const nextSearch = buildOrdersSearch({
      query: params.get("q") || "",
      status: params.get("status") || "all",
    });
    navigate(`/admin/orders/${encodeURIComponent(orderId)}${nextSearch}`, { replace: true });
  }, [loading, location.search, navigate]);

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = orders.filter((order) => {
      if (!matchesOrderLifecycleStatusFilter(order, statusFilter)) {
        return false;
      }
      const paymentStatus = normalizeStatus(order.paymentStatus || "");
      if (paymentFilter !== "all" && paymentStatus !== paymentFilter) {
        return false;
      }
      const fulfillmentStatus = normalizeStatus(order.fulfillmentStatus || "");
      if (fulfillmentFilter !== "all" && fulfillmentStatus !== fulfillmentFilter) {
        return false;
      }
      const orderSource = String(order.source || "").trim().toLowerCase();
      if (sourceFilter !== "all" && orderSource !== sourceFilter) {
        return false;
      }
      if (dateFrom || dateTo) {
        const orderDate = new Date(order.orderDate || order.createdAt || 0);
        if (Number.isNaN(orderDate.getTime())) return false;
        if (dateFrom) {
          const start = new Date(dateFrom);
          start.setHours(0, 0, 0, 0);
          if (orderDate < start) return false;
        }
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          if (orderDate > end) return false;
        }
      }
      if (!needle) return true;
      return (
        order.orderNumber?.toLowerCase().includes(needle) ||
        order.customerName?.toLowerCase().includes(needle) ||
        order.customerPhone?.toLowerCase().includes(needle) ||
        order.status?.toLowerCase().includes(needle) ||
        order.paymentStatus?.toLowerCase().includes(needle) ||
        order.fulfillmentStatus?.toLowerCase().includes(needle) ||
        order.source?.toLowerCase().includes(needle)
      );
    });
    return list;
  }, [
    dateFrom,
    dateTo,
    fulfillmentFilter,
    orders,
    paymentFilter,
    query,
    sourceFilter,
    statusFilter,
  ]);

  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    list.sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return new Date(a.orderDate || 0).getTime() - new Date(b.orderDate || 0).getTime();
        case "highest":
          return getOrderTotalCents(b) - getOrderTotalCents(a);
        case "balance":
          return getOrderBalanceCents(b) - getOrderBalanceCents(a);
        case "customer":
          return String(a.customerName || "").localeCompare(String(b.customerName || ""), undefined, {
            sensitivity: "base",
          });
        case "recent":
        default:
          return new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime();
      }
    });
    return list;
  }, [filteredOrders, sortKey]);

  const cardCategories = useMemo(() => {
    const columns = PAYMENT_CARD_CATEGORIES.map((category) => ({
      ...category,
      items: [],
      totalCents: 0,
    }));
    const columnMap = new Map(columns.map((col) => [col.id, col]));
    sortedOrders.forEach((order) => {
      const stage = getPaymentStage(order);
      const column = columnMap.get(stage);
      if (!column) return;
      column.items.push(order);
      column.totalCents += getOrderTotalCents(order);
    });
    columns.forEach((col) => {
      col.items.sort(
        (a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime()
      );
    });
    return columns;
  }, [sortedOrders]);

  const pageCount = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paginatedOrders = useMemo(() => {
    const start = clampedPage * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, clampedPage, pageSize]);

  const detailOrderSequence = useMemo(
    () =>
      sortedOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber || `#${order.id}`,
        customerName: order.customerName || "Walk-in customer",
      })),
    [sortedOrders]
  );

  const dashboardStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredOrders.reduce(
      (stats, order) => {
        const orderDate = new Date(order.orderDate || order.createdAt || 0);
        const orderDay = new Date(orderDate);
        orderDay.setHours(0, 0, 0, 0);
        const paymentStatus = normalizeStatus(order.paymentStatus || "");
        const orderStatus = normalizeStatus(order.status || "");
        stats.total += 1;
        if (!Number.isNaN(orderDay.getTime()) && orderDay.getTime() === today.getTime()) {
          stats.today += 1;
        }
        if (["unpaid", "pending", "pending_payment"].includes(paymentStatus || orderStatus)) {
          stats.pendingPayment += 1;
        }
        if (["partial", "partially_paid"].includes(paymentStatus || orderStatus)) {
          stats.partiallyPaid += 1;
        }
        if (paymentStatus === "paid" || paymentStatus === "overpaid") {
          stats.paid += 1;
        }
        if (["completed", "fulfilled", "delivered"].includes(orderStatus)) {
          stats.completed += 1;
        }
        if (["cancelled", "refunded"].includes(orderStatus) || paymentStatus === "refunded") {
          stats.cancelled += 1;
        }
        stats.salesCents += getOrderTotalCents(order);
        stats.outstandingCents += getOrderBalanceCents(order);
        return stats;
      },
      {
        total: 0,
        today: 0,
        pendingPayment: 0,
        partiallyPaid: 0,
        paid: 0,
        completed: 0,
        cancelled: 0,
        salesCents: 0,
        outstandingCents: 0,
      }
    );
  }, [filteredOrders]);

  const sourceOptions = useMemo(() => {
    const sources = new Set();
    orders.forEach((order) => {
      const source = String(order.source || "").trim();
      if (source) sources.add(source);
    });
    return [...sources].sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const activeViewMode = isMobileView ? "ledger" : viewMode;
  const availableViewOptions = isMobileView
    ? ORDER_VIEW_OPTIONS.filter((option) => option.key === "ledger")
    : ORDER_VIEW_OPTIONS;
  const renderOrdersPagination = (header = false) => (
    <TablePagination
      total={sortedOrders.length}
      pageIndex={clampedPage}
      pageSize={pageSize}
      pageCount={pageCount}
      onPrevious={() => setPage((p) => Math.max(0, p - 1))}
      onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
      header={header}
    />
  );

  useEffect(() => {
    setPage(0);
  }, [
    dateFrom,
    dateTo,
    fulfillmentFilter,
    paymentFilter,
    query,
    sourceFilter,
    sortKey,
    statusFilter,
    viewMode,
    orders.length,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(MOBILE_VIEW_QUERY);
    const handleChange = () => {
      setIsMobileView(mediaQuery.matches);
    };
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const viewReceipt = (order) => {
    if (!order?.id || !canAccessInvoicing) return;
    navigate(`/admin/invoicing?type=orders&id=${order.id}`);
  };

  const openOrderDetail = (order) => {
    if (!order?.id) return;
    navigate(`/admin/orders/${encodeURIComponent(order.id)}`, {
      state: {
        returnTo: `${location.pathname}${location.search}`,
        orderSequence: detailOrderSequence,
        currentOrderId: order.id,
      },
    });
  };

  const handleCardDragStart = (event, order) => {
    if (!order?.id) {
      event.preventDefault();
      return;
    }
    setDraggingOrderId(order.id);
    setStateNotice(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(order.id));
  };

  const getPaymentActionDraftKey = useCallback(
    (orderId) =>
      buildScopedDraftKey({
        sourceApp: "reebs-portal",
        organizationId: user?.organizationId,
        actorId: user?.id,
        draftType: "order-payment-action",
        recordId: orderId,
      }),
    [user?.id, user?.organizationId]
  );

  const clearPaymentActionDraft = useCallback(
    (orderId = paymentAction?.order?.id) => {
      clearLocalDraft(getPaymentActionDraftKey(orderId));
      setPaymentDraftNotice(null);
    },
    [getPaymentActionDraftKey, paymentAction?.order?.id]
  );

  const closePaymentAction = useCallback(({ clearDraft = true } = {}) => {
    if (clearDraft) clearPaymentActionDraft(paymentAction?.order?.id);
    setPaymentAction(null);
    setPaymentForm(PAYMENT_ACTION_INITIAL_FORM);
    setPaymentFormTouched(false);
    setPaymentNotice(null);
    setPaymentDraftNotice(null);
    setPaymentSaving(false);
  }, [clearPaymentActionDraft, paymentAction?.order?.id]);

  const updatePaymentField = (field, value) => {
    setPaymentForm((current) => ({ ...current, [field]: value }));
    setPaymentFormTouched(true);
  };

  const openPaymentAction = (order, targetStage) => {
    const balanceCents = getOrderBalanceCents(order);
    if (balanceCents <= 0) {
      setStateNotice({
        tone: "info",
        title: "No balance due",
        message: "This order has no outstanding balance to record.",
      });
      return;
    }
    setStateNotice(null);
    setPaymentNotice(null);
    setPaymentDraftNotice(null);
    setPaymentAction({ order, targetStage });
    const draft = readLocalDraft(getPaymentActionDraftKey(order.id));
    if (draft?.data) {
      const restored = sanitizePaymentActionDraft(draft.data);
      setPaymentForm({
        ...PAYMENT_ACTION_INITIAL_FORM,
        ...restored,
      });
      setPaymentFormTouched(true);
      setPaymentDraftNotice({
        type: "restored",
        savedAt: draft.savedAt || "",
      });
      paymentActionDraftSkipWriteRef.current = true;
      return;
    }
    setPaymentForm({
      ...PAYMENT_ACTION_INITIAL_FORM,
      amount: targetStage === "paid" ? (balanceCents / 100).toFixed(2) : "",
    });
    setPaymentFormTouched(false);
  };

  useEffect(() => {
    if (restoredPaymentActionDraftRef.current || loading || paymentAction) return;
    if (!user?.organizationId || !user?.id || !orders.length) return;

    const draft = listLocalDrafts()
      .find((entry) => (
        entry?.metadata?.sourceApp === "reebs-portal" &&
        entry?.metadata?.draftType === "order-payment-action" &&
        String(entry?.metadata?.organizationId) === String(user.organizationId) &&
        String(entry?.metadata?.actorId) === String(user.id) &&
        orders.some((order) => String(order.id) === String(entry?.metadata?.recordId))
      ));

    restoredPaymentActionDraftRef.current = true;
    if (!draft?.data) return;

    const restored = sanitizePaymentActionDraft(draft.data);
    const order = orders.find((item) => String(item.id) === String(draft.metadata.recordId));
    if (!order?.id) return;

    setPaymentAction({ order, targetStage: restored.targetStage });
    setPaymentForm({
      ...PAYMENT_ACTION_INITIAL_FORM,
      ...restored,
    });
    setPaymentFormTouched(true);
    setPaymentDraftNotice({
      type: "restored",
      savedAt: draft.savedAt || "",
    });
    paymentActionDraftSkipWriteRef.current = true;
  }, [loading, orders, paymentAction, user?.id, user?.organizationId]);

  useEffect(() => {
    if (!paymentAction?.order?.id) return undefined;
    const draftKey = getPaymentActionDraftKey(paymentAction.order.id);
    if (!draftKey) return undefined;
    if (paymentActionDraftSkipWriteRef.current) {
      paymentActionDraftSkipWriteRef.current = false;
      return undefined;
    }

    if (paymentActionDraftWriteTimerRef.current) {
      clearTimeout(paymentActionDraftWriteTimerRef.current);
    }

    paymentActionDraftWriteTimerRef.current = setTimeout(() => {
      if (paymentFormTouched && hasPaymentActionDraft(paymentForm)) {
        const saved = writeLocalDraft(
          draftKey,
          {
            ...sanitizePaymentActionDraft(paymentForm),
            targetStage: paymentAction.targetStage,
          },
          {
            metadata: {
              sourceApp: "reebs-portal",
              organizationId: user?.organizationId,
              actorId: user?.id,
              draftType: "order-payment-action",
              recordId: paymentAction.order.id,
            },
          }
        );
        if (saved) {
          setPaymentDraftNotice({
            type: "saved",
            savedAt: saved.savedAt || "",
          });
        }
      } else if (paymentFormTouched && !hasPaymentActionDraft(paymentForm)) {
        clearPaymentActionDraft(paymentAction.order.id);
      }
    }, 250);

    return () => clearTimeout(paymentActionDraftWriteTimerRef.current);
  }, [
    clearPaymentActionDraft,
    getPaymentActionDraftKey,
    paymentAction,
    paymentForm,
    paymentFormTouched,
    user?.id,
    user?.organizationId,
  ]);

  const loadQueuedOrderPayments = useCallback(async () => {
    if (!user?.organizationId || !user?.id) {
      setPaymentQueueNotice(null);
      return [];
    }

    try {
      const queued = (await paymentQueueStorage.list()).filter((item) =>
        isQueuedOrderPaymentForScope(item, {
          organizationId: user.organizationId,
          actorId: user.id,
        })
      );
      setPaymentQueueNotice(getQueuedPaymentNotice(queued));
      return queued;
    } catch (queueError) {
      setPaymentQueueNotice({
        status: SYNC_STATES.FAILED,
        tone: "error",
        title: "Sync failed",
        message: queueError.message || "Unable to read the local manual payment queue.",
      });
      return [];
    }
  }, [paymentQueueStorage, user?.id, user?.organizationId]);

  const syncQueuedOrderPayment = useCallback(async (queueItem) => {
    await paymentQueueStorage.updateStatus(queueItem.id, SYNC_STATES.SYNCING, {
      lastAttemptAt: new Date().toISOString(),
    });
    setPaymentQueueNotice({
      status: SYNC_STATES.SYNCING,
      tone: "loading",
      title: "Syncing",
      message: "Submitting queued manual payment. The server will validate the order, balance, receipt, and permissions.",
    });

    try {
      const response = await fetch("/api/orderPayments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": queueItem.payload?.idempotencyKey || queueItem.id,
        },
        body: JSON.stringify(queueItem.payload?.payment || {}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Queued manual payment could not sync.");
      }

      await paymentQueueStorage.remove(queueItem.id);
      const receiptNumber = payload?.receipt?.receiptNumber || "";
      setStateNotice({
        tone: "success",
        title: "Payment synced",
        message: receiptNumber
          ? `Queued payment synced. Final receipt ${receiptNumber} was created by the server.`
          : "Queued payment synced. Final payment records were created by the server.",
      });
      return true;
    } catch (queueError) {
      const message = queueError.message || "Queued manual payment could not sync.";
      const failureState = getManualPaymentFailureState(message);
      await paymentQueueStorage.updateStatus(queueItem.id, failureState.status, {
        conflictStatus: failureState.conflictStatus,
        retry: incrementRetryMetadata(queueItem.retry, {
          now: new Date(),
          lastError: message,
        }),
        lastAttemptAt: new Date().toISOString(),
      });
      setPaymentQueueNotice({
        status: failureState.status,
        tone: "error",
        title: failureState.status === SYNC_STATES.NEEDS_REVIEW ? "Needs review" : "Sync failed",
        message:
          failureState.status === SYNC_STATES.NEEDS_REVIEW
            ? `${message} Review before retrying to avoid duplicate or invalid payment records.`
            : message,
      });
      return false;
    }
  }, [paymentQueueStorage]);

  const syncQueuedOrderPayments = useCallback(async () => {
    if (!isOnline || paymentQueueSyncingRef.current || !user?.organizationId || !user?.id) return;
    paymentQueueSyncingRef.current = true;
    try {
      const queued = await loadQueuedOrderPayments();
      const pending = queued.filter((item) => item.status === SYNC_STATES.PENDING);
      let syncedCount = 0;
      for (const queueItem of pending) {
        const didSync = await syncQueuedOrderPayment(queueItem);
        if (didSync) syncedCount += 1;
      }
      if (syncedCount) {
        const refreshController = new AbortController();
        await loadOrders(refreshController.signal);
      }
      await loadQueuedOrderPayments();
    } finally {
      paymentQueueSyncingRef.current = false;
    }
  }, [
    isOnline,
    loadOrders,
    loadQueuedOrderPayments,
    syncQueuedOrderPayment,
    user?.id,
    user?.organizationId,
  ]);

  const queueOfflineOrderPayment = useCallback(async (paymentPayload) => {
    const order = paymentAction?.order;
    if (!order?.id || !user?.organizationId || !user?.id) {
      setPaymentNotice({
        tone: "error",
        title: "Payment not queued",
        message: "Sign in again before saving an offline payment.",
      });
      return false;
    }

    await paymentQueueStorage.put(
      buildQueuedOrderPayment({
        organizationId: user.organizationId,
        actorId: user.id,
        order,
        payment: paymentPayload,
        source: "orders-board-payment-action",
      })
    );
    clearPaymentActionDraft(order.id);
    setStateNotice({
      tone: "success",
      title: "Offline payment saved",
      message: "Pending sync. No final receipt number has been generated.",
    });
    closePaymentAction({ clearDraft: false });
    await loadQueuedOrderPayments();
    return true;
  }, [
    clearPaymentActionDraft,
    closePaymentAction,
    loadQueuedOrderPayments,
    paymentAction?.order,
    paymentQueueStorage,
    user?.id,
    user?.organizationId,
  ]);

  useEffect(() => {
    loadQueuedOrderPayments();
  }, [loadQueuedOrderPayments]);

  useEffect(() => {
    if (isOnline) {
      syncQueuedOrderPayments();
    }
  }, [isOnline, syncQueuedOrderPayments]);

  const handlePaymentActionSubmit = async (event) => {
    event.preventDefault();
    if (!paymentAction?.order?.id) return;

    const amountCents = majorToCents(paymentForm.amount);
    const balanceCents = getOrderBalanceCents(paymentAction.order);
    if (amountCents <= 0) {
      setPaymentNotice({
        tone: "error",
        title: "Payment amount required",
        message: "Enter an amount greater than zero.",
      });
      return;
    }
    if (amountCents > balanceCents) {
      setPaymentNotice({
        tone: "error",
        title: "Amount exceeds balance",
        message: `The outstanding balance is ${formatCurrencyFromCents(balanceCents)}.`,
      });
      return;
    }
    if (paymentAction.targetStage === "paid" && amountCents < balanceCents) {
      setPaymentNotice({
        tone: "error",
        title: "Full balance required",
        message: "To move an order to Paid, record the full outstanding balance.",
      });
      return;
    }
    if (paymentAction.targetStage === "partially_paid" && amountCents >= balanceCents) {
      setPaymentNotice({
        tone: "error",
        title: "Use the Paid column",
        message: "A full-balance payment will move the order to Paid instead.",
      });
      return;
    }

    const controller = new AbortController();
    setPaymentSaving(true);
    setPaymentNotice(null);
    const paymentPayload = {
      orderId: paymentAction.order.id,
      amountCents,
      method: paymentForm.method,
      provider: paymentForm.provider || null,
      transactionReference: paymentForm.transactionReference || null,
      phoneNumber: paymentForm.phoneNumber || null,
      notes: paymentForm.notes || null,
    };
    try {
      if (!isOnline) {
        await queueOfflineOrderPayment(paymentPayload);
        return;
      }

      const response = await fetch("/api/orderPayments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentPayload),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Payment could not be recorded.");
      }

      const refreshController = new AbortController();
      await loadOrders(refreshController.signal);
      setStateNotice({
        tone: "success",
        title: "Payment recorded",
        message: `Receipt ${payload?.receipt?.receiptNumber || ""} is linked to the order.`.trim(),
      });
      closePaymentAction();
    } catch (err) {
      if (err.name === "AbortError") return;
      setPaymentNotice({
        tone: "error",
        title: "Payment not recorded",
        message: err.message || "Try again after checking the order balance.",
      });
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleCardDrop = async (event, categoryId) => {
    event.preventDefault();
    const orderId = event.dataTransfer.getData("text/plain") || draggingOrderId;
    const order = orders.find((item) => String(item.id) === String(orderId));
    setDragOverCategory("");
    setDraggingOrderId(null);
    if (!order) return;
    if (getPaymentStage(order) === categoryId) return;
    if (["paid", "partially_paid"].includes(categoryId)) {
      openPaymentAction(order, categoryId);
      return;
    }
    if (categoryId === "unpaid") {
      setStateNotice({
        tone: "info",
        title: "Use refund or reversal actions",
        message: "Paid or partially paid orders need a refund/reversal record before they can move back to Unpaid.",
      });
      return;
    }
    if (categoryId === "refunds") {
      setStateNotice({
        tone: "info",
        title: "Use refund actions",
        message: "Refunds need a recorded refund/reversal so payments, receipts, accounting, and audit logs stay aligned.",
      });
      return;
    }
    setStateNotice({
      tone: "info",
      title: "Use payment actions",
      message: "Payment columns are controlled by recorded payments, refunds, and receipts. Open the order to record the payment action.",
    });
  };

  return (
    <div className="orders-page">
      <div className="orders-shell">
        <AdminBreadcrumb items={[{ label: "Orders" }]} />
        <AdminPageHeader
          title="Orders"
          subtitle="Review recent orders and jump into creation."
          actionsClassName="admin-header-actions"
          actions={
            <>
              <button
                type="button"
                className="orders-secondary"
                onClick={() => loadOrders()}
                aria-label="Refresh orders"
                title="Refresh orders"
                disabled={loading}
              >
                <AppIcon icon={faRotateRight} />
              </button>
              {!isMobileView ? (
                <Link to="/admin/orders/new" className="orders-create">
                  <AppIcon icon={faPlus} />
                  New order
                </Link>
              ) : null}
            </>
          }
        />

        <section className="orders-kpi-strip" aria-label="Order dashboard">
          <article className="bubble-card orders-kpi">
            <span className="orders-label">Pending payment</span>
            <strong>{dashboardStats.pendingPayment}</strong>
            <span className="orders-sub">{dashboardStats.partiallyPaid} partially paid</span>
          </article>
          <article className="bubble-card orders-kpi">
            <span className="orders-label">Paid orders</span>
            <strong>{dashboardStats.paid}</strong>
            <span className="orders-sub">{dashboardStats.completed} completed</span>
          </article>
          <article className="bubble-card orders-kpi">
            <span className="orders-label">Total shop sales</span>
            <strong>{formatCurrencyFromCents(dashboardStats.salesCents)}</strong>
            <span className="orders-sub">Grand total</span>
          </article>
          <article className="bubble-card orders-kpi">
            <span className="orders-label">Outstanding</span>
            <strong>{formatCurrencyFromCents(dashboardStats.outstandingCents)}</strong>
            <span className="orders-sub">Amount due</span>
          </article>
        </section>

        <section className="orders-results-panel">

          <FilterBar className="orders-toolbar" aria-label="Order controls">
            <div className="orders-toolbar-filters">
              <SelectField
                label="Status"
                fieldClassName="orders-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {ORDER_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectField>
              <SelectField
                label="Payment"
                fieldClassName="orders-select"
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
              >
                {PAYMENT_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectField>
              <SelectField
                label="Fulfillment"
                fieldClassName="orders-select"
                value={fulfillmentFilter}
                onChange={(event) => setFulfillmentFilter(event.target.value)}
              >
                {FULFILLMENT_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectField>
              <SelectField
                label="Source"
                fieldClassName="orders-select"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value={ORDER_SOURCE_ALL_OPTION.value}>{ORDER_SOURCE_ALL_OPTION.label}</option>
                {sourceOptions.map((source) => (
                  <option key={source} value={source.toLowerCase()}>
                    {source}
                  </option>
                ))}
              </SelectField>
              <DateField
                label="From"
                fieldClassName="orders-select"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                ariaLabel="Filter orders from date"
              />
              <DateField
                label="To"
                fieldClassName="orders-select"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                ariaLabel="Filter orders to date"
                min={dateFrom || undefined}
              />
            </div>
            <div className="orders-toolbar-search-row">
              <label className="orders-search">
                Search
                <SearchField
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onClear={() => setQuery("")}
                  placeholder="Order #, customer, phone, source"
                  aria-label="Search orders"
                />
              </label>
              <SelectField
                label="Sort"
                fieldClassName="orders-select orders-sort-select"
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value)}
              >
                {ORDER_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectField>
              {!isMobileView && (
                <div className="admin-view-toggle orders-view-tabs" role="tablist" aria-label="Order views">
                  {availableViewOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      role="tab"
                      aria-selected={activeViewMode === option.key}
                      tabIndex={activeViewMode === option.key ? 0 : -1}
                      className={`admin-chip ${activeViewMode === option.key ? "is-active" : ""}`}
                      onClick={() => setViewMode(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FilterBar>

          {loading && <InlineNotice tone="loading" title="Loading orders" compact />}
          {!loading && error && <InlineNotice tone="error" title="Orders unavailable" message={error} compact />}
          {stateNotice && (
            <InlineNotice
              tone={stateNotice.tone}
              title={stateNotice.title}
              message={stateNotice.message}
              compact
              onDismiss={() => setStateNotice(null)}
              dismissLabel="Dismiss order action notice"
            />
          )}
          {paymentQueueNotice && (
            <InlineNotice
              tone={paymentQueueNotice.tone}
              title={paymentQueueNotice.title}
              message={paymentQueueNotice.message}
              compact
              onDismiss={() => setPaymentQueueNotice(null)}
              dismissLabel="Dismiss payment sync notice"
            />
          )}

          {!loading && !error && activeViewMode === "list" && (
            <>
              <div className="orders-table-wrapper">
                {renderOrdersPagination(true)}
                <table className="orders-table orders-table--shop">
                  <thead>
                    <tr>
                      <th className="table-row-index">#</th>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Fulfillment</th>
                      <th>Source</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th aria-label="Receipt" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map((order, index) => (
                      <tr
                        key={order.id}
                        onClick={() => openOrderDetail(order)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openOrderDetail(order);
                          }
                        }}
                      >
                        <td className="table-row-index">{clampedPage * pageSize + index + 1}</td>
                        <td>{order.orderNumber || `#${order.id}`}</td>
                        <td>{order.customerName || "-"}</td>
                        <td>{order.customerPhone || "-"}</td>
                        <td className="orders-status-cell">
                          <span className={`orders-status-pill orders-status-pill--compact ${getOrdersStatusClass(getOrderLifecycleStatusValue(order))}`}>
                            {getOrderLifecycleStatusLabel(order)}
                          </span>
                        </td>
                        <td className="orders-status-cell">
                          <span className={`orders-status-pill orders-status-pill--compact ${getOrdersStatusClass(order.paymentStatus)}`}>
                            {formatStatusLabel(order.paymentStatus, "Unpaid")}
                          </span>
                        </td>
                        <td className="orders-status-cell">
                          <span className={`orders-status-pill orders-status-pill--compact ${getOrdersStatusClass(order.fulfillmentStatus || order.deliveryMethod)}`}>
                            {formatStatusLabel(order.fulfillmentStatus || order.deliveryMethod, "Pickup")}
                          </span>
                        </td>
                        <td>{order.source || order.purchaseChannel || "-"}</td>
                        <td>{formatCurrencyFromCents(getOrderTotalCents(order))}</td>
                        <td>{formatCurrencyFromCents(getOrderAmountPaidCents(order))}</td>
                        <td>{formatCurrencyFromCents(getOrderBalanceCents(order))}</td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <div className="orders-row-actions">
                            {canAccessInvoicing && (
                              <button
                                type="button"
                                className="orders-secondary orders-row-action orders-row-action--icon"
                                onClick={() => viewReceipt(order)}
                                aria-label={`Open receipt for ${order.orderNumber || `order ${order.id}`}`}
                                title="Receipt"
                              >
                                <AppIcon icon={faReceipt} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredOrders.length && (
                      <tr>
                        <td colSpan={12} className="orders-empty">
                          No orders match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {sortedOrders.length > 0 && (
                    <tfoot className="admin-table-footer">
                      <tr className="orders-total-row">
                        <td className="admin-table-summary-cell is-count">
                          <span className="admin-table-summary-value">{paginatedOrders.length} orders</span>
                        </td>
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell is-empty" />
                        <td className="admin-table-summary-cell">
                          <span className="admin-table-summary-value">{formatCurrencyFromCents(dashboardStats.salesCents)}</span>
                        </td>
                        <td className="admin-table-summary-cell">
                          <span className="admin-table-summary-value">{formatCurrencyFromCents(dashboardStats.salesCents - dashboardStats.outstandingCents)}</span>
                        </td>
                        <td className="admin-table-summary-cell">
                          <span className="admin-table-summary-value">{formatCurrencyFromCents(dashboardStats.outstandingCents)}</span>
                        </td>
                        <td className="admin-table-summary-cell is-empty" />
                      </tr>
                    </tfoot>
                  )}
                </table>
                {renderOrdersPagination()}
              </div>
            </>
          )}

          {!loading && !error && activeViewMode === "cards" && (
            <>
              <div className="orders-card-categories" aria-label="Orders by category">
                {!sortedOrders.length && <p className="orders-empty">No orders match your filters.</p>}
                {sortedOrders.length > 0 && cardCategories.map((column) => (
                  <section
                    key={column.id}
                    className={`orders-card-category ${dragOverCategory === column.id ? "is-drag-over" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDragEnter={() => setDragOverCategory(column.id)}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setDragOverCategory("");
                      }
                    }}
                    onDrop={(event) => handleCardDrop(event, column.id)}
                  >
                    <div className="orders-card-category-head">
                      <h4>{column.label}</h4>
                      <span>{column.items.length}</span>
                    </div>

                    <div className="orders-card-category-list">
                      {column.items.length ? (
                        column.items.map((order) => {
                          const totalCents = getOrderTotalCents(order);
                          const balanceCents = getOrderBalanceCents(order);
                          const customerName = order.customerName || "Walk-in customer";
                          const orderStatusLabel = formatStatusLabel(order.status, "Pending");

                          return (
                            <article
                              key={order.id}
                              className={`bubble-card orders-card ${draggingOrderId === order.id ? "is-dragging" : ""}`}
                              role="button"
                              tabIndex={0}
                              draggable
                              onDragStart={(event) => handleCardDragStart(event, order)}
                              onDragEnd={() => {
                                setDraggingOrderId(null);
                                setDragOverCategory("");
                              }}
                              onClick={() => openOrderDetail(order)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  openOrderDetail(order);
                                }
                              }}
                            >
                              <span
                                className={`orders-pill orders-status-pill orders-status-pill--card ${getOrderCardStatusClass(order.status)}`}
                              >
                                {orderStatusLabel}
                              </span>
                              <div className="orders-card-main">
                                <h4>{customerName}</h4>
                                <span className="orders-card-amount">{formatCurrencyFromCents(totalCents)}</span>
                              </div>

                              {balanceCents > 0 && (
                                <div className="orders-card-foot">
                                  <span className="orders-card-due">
                                    Due {formatCurrencyFromCents(balanceCents)}
                                  </span>
                                </div>
                              )}
                            </article>
                          );
                        })
                      ) : (
                        <p className="orders-empty">No orders here.</p>
                      )}
                    </div>
                    <div className="orders-card-category-foot">
                      <span>Total</span>
                      <strong>{formatCurrencyFromCents(column.totalCents)}</strong>
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}

          {!loading && !error && activeViewMode === "ledger" && (
            <>
              {!isMobileView && renderOrdersPagination(true)}
              <div className="orders-ledger-list" aria-label="Order payment ledger">
                {!paginatedOrders.length && <p className="orders-empty">No ledger rows match your filters.</p>}
                {paginatedOrders.map((order) => (
                  <article
                    key={order.id}
                    className="bubble-card orders-ledger-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openOrderDetail(order)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openOrderDetail(order);
                      }
                    }}
                    aria-label={`Open ${order.orderNumber || `order ${order.id}`}`}
                  >
                    <div className="orders-ledger-main">
                      <span className={`orders-status-pill orders-status-pill--compact ${getOrdersStatusClass(order.paymentStatus)}`}>
                        {formatStatusLabel(order.paymentStatus, "Unpaid")}
                      </span>
                      <div className="orders-ledger-copy">
                        <h4>{order.customerName || "Walk-in customer"}</h4>
                        <p>
                          <span>{order.orderNumber || `#${order.id}`}</span>
                          {order.customerPhone && (
                            <span className="orders-ledger-phone"> · {order.customerPhone}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="orders-ledger-money">
                      <div className="orders-ledger-money-total">
                        <span>Total</span>
                        <strong>{formatCurrencyFromCents(getOrderTotalCents(order))}</strong>
                      </div>
                      <div className="orders-ledger-money-paid">
                        <span>Paid</span>
                        <strong>{formatCurrencyFromCents(getOrderAmountPaidCents(order))}</strong>
                      </div>
                      <div className={`orders-ledger-money-balance ${getOrderBalanceCents(order) > 0 ? "" : "is-zero"}`}>
                        <span>Balance</span>
                        <strong>{formatCurrencyFromCents(getOrderBalanceCents(order))}</strong>
                      </div>
                    </div>
                    <div className="orders-row-actions">
                      {canAccessInvoicing && (
                        <button
                          type="button"
                          className="orders-secondary orders-row-action orders-row-action--icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            viewReceipt(order);
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                          aria-label={`Open receipt for ${order.orderNumber || `order ${order.id}`}`}
                          title="Receipt"
                        >
                          <AppIcon icon={faReceipt} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {renderOrdersPagination()}
            </>
          )}
        </section>

        {paymentAction && (
          <div
            className="admin-modal orders-payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="orders-payment-modal-title"
            onClick={paymentSaving ? undefined : closePaymentAction}
          >
            <div
              className="admin-modal-panel orders-payment-modal-panel"
              onClick={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <p className="orders-eyebrow">Payment action</p>
                  <h2 id="orders-payment-modal-title">
                    Move to {paymentAction.targetStage === "paid" ? "Paid" : "Partially paid"}
                  </h2>
                  <span className="admin-modal-meta">
                    {paymentAction.order.orderNumber || `Order ${paymentAction.order.id}`} · Balance{" "}
                    {formatCurrencyFromCents(getOrderBalanceCents(paymentAction.order))}
                  </span>
                </div>
                <button
                  type="button"
                  className="orders-secondary"
                  onClick={closePaymentAction}
                  disabled={paymentSaving}
                >
                  Close
                </button>
              </header>

              <InlineNotice
                tone="info"
                title="Record payment first"
                message="The order will move columns after the server creates the payment, receipt, accounting, and audit records."
                compact
              />
              {paymentNotice && (
                <InlineNotice
                  tone={paymentNotice.tone}
                  title={paymentNotice.title}
                  message={paymentNotice.message}
                  compact
                  onDismiss={() => setPaymentNotice(null)}
                  dismissLabel="Dismiss payment notice"
                />
              )}
              {paymentDraftNotice && (
                <InlineNotice
                  tone={paymentDraftNotice.type === "saved" && isOnline ? "success" : "info"}
                  title={
                    paymentDraftNotice.type === "restored"
                      ? "Unsaved local draft restored"
                      : isOnline
                        ? "Draft saved locally"
                        : "Offline"
                  }
                  message={
                    paymentDraftNotice.type === "restored"
                      ? "Review the payment draft before submitting. The server will still validate the final payment."
                      : isOnline
                        ? "Online - ready to submit. Final payment and receipt records are still created by the server."
                        : "Payment draft saved locally. Submit only after the connection is stable."
                  }
                  compact
                />
              )}

              <form className="orders-payment-modal-form" onSubmit={handlePaymentActionSubmit}>
                <label className="orders-payment-field">
                  Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(event) => updatePaymentField("amount", event.target.value)}
                    required
                  />
                </label>
                <label className="orders-payment-field">
                  Method
                  <SelectField
                    value={paymentForm.method}
                    onChange={(event) => updatePaymentField("method", event.target.value)}
                  >
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                </label>
                {paymentForm.method === "mobile_money" && (
                  <>
                    <label className="orders-payment-field">
                      Provider
                      <input
                        value={paymentForm.provider}
                        onChange={(event) => updatePaymentField("provider", event.target.value)}
                        placeholder="MTN, Telecel, AT"
                      />
                    </label>
                    <label className="orders-payment-field">
                      MoMo phone
                      <input
                        value={paymentForm.phoneNumber}
                        onChange={(event) => updatePaymentField("phoneNumber", event.target.value)}
                      />
                    </label>
                  </>
                )}
                <label className="orders-payment-field">
                  Reference
                  <input
                    value={paymentForm.transactionReference}
                    onChange={(event) => updatePaymentField("transactionReference", event.target.value)}
                  />
                </label>
                <label className="orders-payment-field orders-payment-field--wide">
                  Notes
                  <textarea
                    rows="3"
                    value={paymentForm.notes}
                    onChange={(event) => updatePaymentField("notes", event.target.value)}
                  />
                </label>
                <div className="orders-payment-actions">
                  <button type="submit" className="orders-primary" disabled={paymentSaving}>
                    {paymentSaving ? "Saving..." : isOnline ? "Save payment" : "Save offline payment"}
                  </button>
                  <button
                    type="button"
                    className="orders-secondary"
                    onClick={closePaymentAction}
                    disabled={paymentSaving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default OrdersList;
