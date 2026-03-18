/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./OrdersList.css";
import { Link, useNavigate } from "react-router-dom";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import { useAuth } from "../../components/AuthContext/AuthContext";
import SearchField from "../../components/SearchField/SearchField";

const formatCurrency = (amount, currency = "GHS") => {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch (err) {
    return `£${Number(amount || 0).toFixed(2)}`;
  }
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

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatUser = (name) => name || "Admin";
const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeStatus = (status) => {
  if (typeof status !== "string") return "";
  const normalized = status.trim().toLowerCase();
  return normalized === "canceled" ? "cancelled" : normalized;
};

const isPickupOrder = (deliveryMethod) =>
  String(deliveryMethod || "").toLowerCase().includes("pickup");

const WINDOW_LABELS = {
  "9am-11am": "9:00am - 11:00am",
  "11am-1pm": "11:00am - 1:00pm",
  "1pm-3pm": "1:00pm - 3:00pm",
  "3pm-5pm": "3:00pm - 5:00pm",
  "5pm-7pm": "5:00pm - 7:00pm",
};

const formatWindow = (value) => {
  if (!value) return "-";
  return WINDOW_LABELS[value] || value;
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

const getFulfillmentDetails = (order) => {
  const pickup = isPickupOrder(order?.deliveryMethod);
  const details = pickup ? order?.pickupDetails : order?.deliveryDetails;
  const fallbackDate = pickup ? null : order?.deliveryDate || null;
  return {
    pickup,
    date: details?.date || fallbackDate,
    window: details?.window || null,
    address: details?.address || null,
    contact: details?.contact || null,
    notes: details?.notes || null,
  };
};

const getTimelineStage = (order) => {
  const status = normalizeStatus(order?.status);
  const details = getFulfillmentDetails(order);
  const hasDeliveryDate = Boolean(details.date);
  const pickup = isPickupOrder(order?.deliveryMethod);

  if (["cancelled", "canceled"].includes(status)) return "cancelled";
  if (["fulfilled", "delivered", "completed"].includes(status)) return "delivered";
  if (status === "paid" && hasDeliveryDate) return pickup ? "pickup" : "delivery";
  if (status === "paid") return "receipt";
  return "received";
};

const MOBILE_VIEW_QUERY = "(max-width: 720px)";

const getIsMobileView = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_VIEW_QUERY).matches;

function OrdersList() {
  const { user } = useAuth();
  const roleKey = String(user?.role || "").trim().toLowerCase();
  const canAccessInvoicing = roleKey === "admin" || roleKey === "manager";
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode] = useState("cards"); // cards only
  const [isMobileView, setIsMobileView] = useState(getIsMobileView);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });
  const viewStorageKey = useMemo(
    () => `reebs_orders_views_${user?.id || "guest"}`,
    [user?.id]
  );
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState("all");
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailEditOpen, setDetailEditOpen] = useState(false);
  const [detailEditSaving, setDetailEditSaving] = useState(false);
  const [detailEditError, setDetailEditError] = useState("");
  const [detailEditForm, setDetailEditForm] = useState({
    date: "",
    window: "",
    notes: "",
  });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const itemsFetchAttempted = useRef(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    const handleClickAway = (event) => {
      if (!event.target.closest(".bookings-menu")) {
        setOpenMenuId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, []);

  useEffect(() => {
    if (!openMenuId) return undefined;

    const closeOnLayoutChange = () => {
      setOpenMenuId(null);
      setMenuPosition(null);
    };

    window.addEventListener("resize", closeOnLayoutChange);
    window.addEventListener("scroll", closeOnLayoutChange, true);

    return () => {
      window.removeEventListener("resize", closeOnLayoutChange);
      window.removeEventListener("scroll", closeOnLayoutChange, true);
    };
  }, [openMenuId]);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/.netlify/functions/orders");
        if (!response.ok) {
          throw new Error("Failed to fetch orders.");
        }
        const data = await response.json();
        setOrders(Array.isArray(data) ? data.map(normalizeOrderItems) : []);
      } catch (err) {
        console.error("Failed to load orders", err);
        setError("We couldn't load orders right now.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(viewStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setSavedViews(parsed);
      }
    } catch (err) {
      console.warn("Failed to load order views", err);
    }
  }, [viewStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(viewStorageKey, JSON.stringify(savedViews));
    } catch (err) {
      console.warn("Failed to save order views", err);
    }
  }, [savedViews, viewStorageKey]);

  useEffect(() => {
    if (!detailOrder) return;
    const details = getFulfillmentDetails(detailOrder);
    setDetailEditForm({
      date: details.date || "",
      window: details.window || "",
      notes: details.notes || "",
    });
    setDetailEditOpen(false);
    setDetailEditError("");
  }, [detailOrder]);

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = orders.filter((order) => {
      const orderStatus = normalizeStatus(order.status || "");
      if (statusFilter !== "all" && orderStatus !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        order.orderNumber?.toLowerCase().includes(needle) ||
        order.customerName?.toLowerCase().includes(needle) ||
        order.status?.toLowerCase().includes(needle)
      );
    });
    return list;
  }, [orders, query, statusFilter]);

  const sortValue = (order, key) => {
    switch (key) {
      case "id":
        return Number(order.id) || 0;
      case "orderNumber":
        return (order.orderNumber || "").toLowerCase();
      case "customerName":
        return (order.customerName || "").toLowerCase();
      case "assignedUserName":
        return (order.assignedUserName || "").toLowerCase();
      case "status":
        return (order.status || "").toLowerCase();
      case "deliveryMethod":
        return (order.deliveryMethod || "").toLowerCase();
      case "total":
        return toNumber(order.total);
      case "orderDate":
        return new Date(order.orderDate || 0).getTime();
      case "deliveryDate":
        return new Date(order.deliveryDate || 0).getTime();
      case "lastModifiedAt":
        return new Date(order.lastModifiedAt || 0).getTime();
      default:
        return order[key] ?? "";
    }
  };

  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    const { key, direction } = sortConfig;
    list.sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      if (va < vb) return direction === "asc" ? -1 : 1;
      if (va > vb) return direction === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredOrders, sortConfig]);

  const kanbanColumns = useMemo(() => {
    const columns = [
      { id: "received", label: "Order received", items: [] },
      { id: "receipt", label: "Receipt sent", items: [] },
      { id: "delivery", label: "Delivery pending", items: [] },
      { id: "pickup", label: "Pickup date", items: [] },
      { id: "cancelled", label: "Cancelled", items: [] },
      { id: "delivered", label: "Delivered", items: [] },
    ];
    const columnMap = new Map(columns.map((col) => [col.id, col]));
    sortedOrders.forEach((order) => {
      const stage = getTimelineStage(order);
      columnMap.get(stage)?.items.push(order);
    });
    columns.forEach((col) => {
      col.items.sort(
        (a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime()
      );
    });
    return columns;
  }, [sortedOrders]);

  const detailIndex = useMemo(() => {
    if (!detailOrder) return -1;
    return sortedOrders.findIndex((order) => order.id === detailOrder.id);
  }, [detailOrder, sortedOrders]);

  const canGoPrevDetail = detailIndex > 0;
  const canGoNextDetail = detailIndex >= 0 && detailIndex < sortedOrders.length - 1;

  const goPrevDetail = () => {
    if (!canGoPrevDetail) return;
    setDetailOrder(sortedOrders[detailIndex - 1]);
  };

  const goNextDetail = () => {
    if (!canGoNextDetail) return;
    setDetailOrder(sortedOrders[detailIndex + 1]);
  };

  const pageCount = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paginatedOrders = useMemo(() => {
    const start = clampedPage * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, clampedPage, pageSize]);

  useEffect(() => {
    setPage(0);
  }, [query, statusFilter, viewMode, orders.length]);

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

  useEffect(() => {
    if (!detailOrder?.id) return undefined;
    const orderId = detailOrder.id;
    const hasItems = Array.isArray(detailOrder.items) && detailOrder.items.length > 0;
    if (hasItems || itemsFetchAttempted.current.has(orderId)) return undefined;
    itemsFetchAttempted.current.add(orderId);
    const controller = new AbortController();
    const fetchItems = async () => {
      try {
        const response = await fetch(`/.netlify/functions/orders?orderId=${orderId}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        const normalized = normalizeOrderItems(data);
        if (normalized?.id !== orderId) return;
        if (!Array.isArray(normalized.items) || normalized.items.length === 0) return;
        setOrders((prev) =>
          prev.map((order) => (order.id === orderId ? { ...order, items: normalized.items } : order))
        );
        setDetailOrder((prev) =>
          prev && prev.id === orderId ? { ...prev, items: normalized.items } : prev
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Order item fetch failed", err);
        }
      }
    };
    fetchItems();
    return () => controller.abort();
  }, [detailOrder]);

  const totalAmount = useMemo(() => {
    return sortedOrders.reduce((sum, order) => sum + toNumber(order.total), 0);
  }, [sortedOrders]);

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortIndicator = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const viewReceipt = (order) => {
    if (!order?.id || !canAccessInvoicing) return;
    navigate(`/admin/invoicing?type=orders&id=${order.id}`);
    setOpenMenuId(null);
  };

  const buildMenuPosition = (rect) => {
    if (!rect || typeof window === "undefined") return null;
    const width = 320;
    const gutter = 12;
    const initialTop = rect.bottom + 8;
    const maxBelow = window.innerHeight - initialTop - gutter;
    const maxAbove = rect.top - gutter - 8;
    let maxHeight = Math.min(420, Math.max(160, maxBelow));
    let top = initialTop;
    if (maxBelow < 160 && maxAbove > maxBelow) {
      maxHeight = Math.min(420, Math.max(160, maxAbove));
      top = Math.max(gutter, rect.top - maxHeight - 8);
    }
    let left = rect.left;
    if (left + width > window.innerWidth - gutter) {
      left = rect.right - width;
    }
    left = Math.min(Math.max(gutter, left), window.innerWidth - width - gutter);
    return { top, left, maxHeight };
  };

  const toggleOrderMenu = (menuId, event) => {
    const rect = event?.currentTarget?.getBoundingClientRect();
    if (openMenuId === menuId) {
      setOpenMenuId(null);
      setMenuPosition(null);
      return;
    }
    setOpenMenuId(menuId);
    setMenuPosition(rect ? buildMenuPosition(rect) : null);
  };

  const updateOrderStatus = async (order, nextStatus) => {
    if (!order?.id) return;
    setStatusUpdatingId(order.id);
    setError("");
    try {
      const response = await fetch("/.netlify/functions/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: order.id,
          status: nextStatus,
          userId: user?.id,
          userName:
            user?.fullName ||
            user?.name ||
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            undefined,
          userEmail: user?.email,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update order.");
      }
      setOrders((prev) =>
        prev.map((row) =>
          row.id === order.id ? { ...row, status: payload.status || nextStatus } : row
        )
      );
      setDetailOrder((prev) =>
        prev && prev.id === order.id ? { ...prev, status: payload.status || nextStatus } : prev
      );
    } catch (err) {
      console.error("Order status update failed", err);
      setError(err.message || "Failed to update order.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const applySavedView = (view) => {
    setQuery(view?.query || "");
    setStatusFilter(view?.statusFilter || "all");
  };

  const handleViewChange = (event) => {
    const nextId = event.target.value;
    setActiveViewId(nextId);
    if (nextId === "all") {
      applySavedView({ query: "", statusFilter: "all" });
      return;
    }
    const view = savedViews.find((item) => item.id === nextId);
    if (view) applySavedView(view);
  };

  const handleSaveView = () => {
    if (typeof window === "undefined") return;
    const name = window.prompt("Name this view");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedViews((prev) => {
      const existing = prev.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        const next = prev.map((item) =>
          item.id === existing.id ? { ...item, query, statusFilter } : item
        );
        setActiveViewId(existing.id);
        return next;
      }
      const nextId = `view-${Date.now()}`;
      setActiveViewId(nextId);
      return [...prev, { id: nextId, name: trimmed, query, statusFilter }];
    });
  };

  const handleDeleteView = () => {
    if (activeViewId === "all") return;
    setSavedViews((prev) => prev.filter((item) => item.id !== activeViewId));
    setActiveViewId("all");
    applySavedView({ query: "", statusFilter: "all" });
  };

  const saveOrderDetails = async () => {
    if (!detailOrder?.id) return;
    setDetailEditSaving(true);
    setDetailEditError("");
    try {
      const existingDetails =
        detailOrder.pickupDetails && typeof detailOrder.pickupDetails === "object"
          ? detailOrder.pickupDetails
          : detailOrder.deliveryDetails && typeof detailOrder.deliveryDetails === "object"
          ? detailOrder.deliveryDetails
          : {};
      const pickupDetails = {
        ...existingDetails,
        date: detailEditForm.date,
        window: detailEditForm.window,
        notes: detailEditForm.notes,
      };
      const response = await fetch("/.netlify/functions/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: detailOrder.id,
          pickupDetails,
          userId: user?.id,
          userName:
            user?.fullName ||
            user?.name ||
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            undefined,
          userEmail: user?.email,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update order.");
      }
      const nextPickup = payload?.pickupDetails || pickupDetails;
      const nextDeliveryMethod = payload?.deliveryMethod || "pickup";
      const nextLastModified = payload?.lastModifiedAt || detailOrder.lastModifiedAt;
      setOrders((prev) =>
        prev.map((row) =>
          row.id === detailOrder.id
            ? {
                ...row,
                pickupDetails: nextPickup,
                deliveryMethod: nextDeliveryMethod,
                lastModifiedAt: nextLastModified,
              }
            : row
        )
      );
      setDetailOrder((prev) =>
        prev && prev.id === detailOrder.id
          ? {
              ...prev,
              pickupDetails: nextPickup,
              deliveryMethod: nextDeliveryMethod,
              lastModifiedAt: nextLastModified,
            }
          : prev
      );
      setDetailEditOpen(false);
    } catch (err) {
      console.error("Order update failed", err);
      setDetailEditError(err.message || "Failed to update order.");
    } finally {
      setDetailEditSaving(false);
    }
  };

  return (
    <div className="orders-page">
      <div className="orders-shell">
        <AdminBreadcrumb items={[{ label: "Orders" }]} />
        <header className="orders-header">
          <div>
            <p className="orders-eyebrow">Orders</p>
            <h1>Order Ledger</h1>
            <p className="orders-subtitle">Review recent orders and jump into creation.</p>
          </div>
          {!isMobileView && (
            <Link to="/admin/orders/new" className="orders-create">
              Create order
            </Link>
          )}
        </header>

        <section className="orders-panel">
          <div className="orders-panel-header">
            <div>
              <h3>All orders</h3>
              <span>{orders.length} total</span>
            </div>
            <label className="orders-search">
              Search
              <SearchField
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery("")}
                placeholder="Order #, customer, status"
                aria-label="Search orders"
              />
            </label>
          </div>
          <div className="orders-controls">
            <div className="orders-control-group">
              <label className="orders-select">
                Status
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="cancelled">Canceled</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            </div>
            <div className="orders-view-controls">
              <label className="orders-select">
                Saved view
                <select value={activeViewId} onChange={handleViewChange}>
                  <option value="all">All orders</option>
                  {savedViews.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="orders-view-actions">
                <button type="button" className="orders-view-btn" onClick={handleSaveView}>
                  Save view
                </button>
                {activeViewId !== "all" && (
                  <button type="button" className="orders-view-btn orders-view-btn--ghost" onClick={handleDeleteView}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading && <p className="orders-status">Loading orders...</p>}
          {!loading && error && <p className="orders-error">{error}</p>}

          {!loading && !error && viewMode === "table" && (
            <div className="orders-table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("orderNumber")}>
                        Order <span className="sort-indicator">{sortIndicator("orderNumber")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("customerName")}>
                        Customer <span className="sort-indicator">{sortIndicator("customerName")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("assignedUserName")}>
                        Assigned to <span className="sort-indicator">{sortIndicator("assignedUserName")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("status")}>
                        Status <span className="sort-indicator">{sortIndicator("status")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("orderDate")}>
                        Order date <span className="sort-indicator">{sortIndicator("orderDate")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("deliveryDate")}>
                        Delivery <span className="sort-indicator">{sortIndicator("deliveryDate")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("deliveryMethod")}>
                        Fulfillment <span className="sort-indicator">{sortIndicator("deliveryMethod")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => requestSort("total")}>
                        Total <span className="sort-indicator">{sortIndicator("total")}</span>
                      </button>
                    </th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setDetailOrder(order)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDetailOrder(order);
                        }
                      }}
                    >
                      <td>{order.orderNumber || `#${order.id}`}</td>
                      <td>{order.customerName || "-"}</td>
                      <td>{formatUser(order.assignedUserName)}</td>
                      <td className={`orders-status-pill ${order.status || "pending"}`}>
                        {order.status || "pending"}
                      </td>
                      <td>{formatDate(order.orderDate)}</td>
                      <td>{formatDate(order.deliveryDate)}</td>
                      <td className="orders-fulfillment">{(order.deliveryMethod || "delivery").toUpperCase()}</td>
                      <td>{formatCurrency(order.total)}</td>
                      <td>
                        {!isMobileView && (
                          <div
                            className="bookings-menu inventory-menu"
                            onClick={(e) => e.stopPropagation()}
                          >
                          <button
                            type="button"
                            className="bookings-edit"
                            aria-haspopup="true"
                            aria-expanded={openMenuId === `table-${order.id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleOrderMenu(`table-${order.id}`, event);
                            }}
                          >
                            ⋮
                          </button>
                          <div
                            className={`bookings-menu-list ${openMenuId === `table-${order.id}` ? "open" : ""}`}
                            style={openMenuId === `table-${order.id}` ? menuPosition : undefined}
                          >
                            {canAccessInvoicing && (
                              <button
                                type="button"
                                onClick={() => viewReceipt(order)}
                              >
                                Generate invoice
                              </button>
                            )}
                              <button type="button">Edit</button>
                              <button type="button">Mark fulfilled</button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredOrders.length && (
                    <tr>
                      <td colSpan={8} className="orders-empty">
                        No orders match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="orders-total-row">
                    <td colSpan={7}>Total</td>
                    <td>{formatCurrency(totalAmount)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <div className="table-pagination">
                <span>
                  Showing {sortedOrders.length === 0 ? 0 : clampedPage * pageSize + 1}-
                  {Math.min(sortedOrders.length, (clampedPage + 1) * pageSize)} of {sortedOrders.length}
                </span>
                <div className="table-pagination-controls">
                  <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0}>
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={clampedPage >= pageCount - 1}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && viewMode === "cards" && (
            <>
              <div className="orders-card-grid">
                {!sortedOrders.length && <p className="orders-empty">No orders match your filters.</p>}
                {paginatedOrders.map((order) => (
                  <div
                    key={order.id}
                    className="orders-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailOrder(order)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setDetailOrder(order);
                      }
                    }}
                  >
                    <div className="orders-card-head">
                      <span className={`orders-pill orders-status-pill ${order.status || "pending"}`}>
                        {order.status || "pending"}
                      </span>
                      {!isMobileView && (
                        <div
                          className="bookings-menu inventory-menu"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="bookings-edit"
                            aria-haspopup="true"
                            aria-expanded={openMenuId === `card-${order.id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleOrderMenu(`card-${order.id}`, event);
                            }}
                          >
                            ⋮
                          </button>
                          <div
                            className={`bookings-menu-list ${openMenuId === `card-${order.id}` ? "open" : ""}`}
                            style={openMenuId === `card-${order.id}` ? menuPosition : undefined}
                          >
                            {canAccessInvoicing && (
                              <button
                                type="button"
                                onClick={() => viewReceipt(order)}
                              >
                                Generate invoice
                              </button>
                            )}
                            <button type="button">Edit</button>
                            <button type="button">Mark fulfilled</button>
                          </div>
                        </div>
                      )}
                    </div>
                    <h4>{order.orderNumber || `#${order.id}`}</h4>
                    <p className="orders-card-meta">{order.customerName || "-"}</p>
                    <p className="orders-card-meta">
                      {formatDate(order.orderDate)} ·{" "}
                      {(() => {
                        const details = getFulfillmentDetails(order);
                        const label = details.pickup ? "Pickup" : "Delivery";
                        const dateLabel = details.date ? formatDate(details.date) : "Not scheduled";
                        return `${label} ${dateLabel}`;
                      })()}
                    </p>
                    <p className="orders-card-meta">Fulfillment: {(order.deliveryMethod || "delivery").toUpperCase()}</p>
                    <p className="orders-card-meta">Assigned: {formatUser(order.assignedUserName)}</p>
                    <p className="orders-card-amount">{formatCurrency(order.total)}</p>
                  </div>
                ))}
              </div>
              <div className="table-pagination">
                <span>
                  Showing {sortedOrders.length === 0 ? 0 : clampedPage * pageSize + 1}-
                  {Math.min(sortedOrders.length, (clampedPage + 1) * pageSize)} of {sortedOrders.length}
                </span>
                <div className="table-pagination-controls">
                  <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0}>
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={clampedPage >= pageCount - 1}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}

          {!loading && !error && viewMode === "kanban" && (
            <div className="orders-kanban">
              {kanbanColumns.map((column) => (
                <div key={column.id} className="orders-kanban-column">
                  <div className="orders-kanban-header">
                    <h4>{column.label}</h4>
                    <span>{column.items.length}</span>
                  </div>
                  {column.items.length ? (
                    column.items.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        className="orders-kanban-card"
                        onClick={() => setDetailOrder(order)}
                      >
                        <div className="orders-kanban-card-head">
                          <span className={`orders-pill orders-status-pill ${order.status || "pending"}`}>
                            {order.status || "pending"}
                          </span>
                          <span className="orders-kanban-amount">{formatCurrency(order.total)}</span>
                        </div>
                        <h5>{order.orderNumber || `#${order.id}`}</h5>
                        <p className="orders-kanban-meta">{order.customerName || "-"}</p>
                        <p className="orders-kanban-meta">
                          Ordered {formatDate(order.orderDate)} ·{" "}
                          {(order.deliveryMethod || "delivery").toUpperCase()}
                        </p>
                        {getFulfillmentDetails(order).date && (
                          <p className="orders-kanban-meta">
                            {getFulfillmentDetails(order).pickup ? "Pickup" : "Delivery"}{" "}
                            {formatDate(getFulfillmentDetails(order).date)}
                          </p>
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="orders-empty">No orders here.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {detailOrder && (
          <div className="orders-detail-modal" role="dialog" aria-modal="true">
            <div className="orders-detail-panel">
              <header>
                <div>
                  <p className="orders-eyebrow">Order detail</p>
                  <div className="orders-detail-title">
                    <h2>{detailOrder.orderNumber || `#${detailOrder.id}`}</h2>
                    <span className={`orders-status-pill orders-status-pill--compact ${detailOrder.status || "pending"}`}>
                      {detailOrder.status || "pending"}
                    </span>
                  </div>
                  <p className="orders-card-meta">{detailOrder.customerName || "-"}</p>
                </div>
                <div className="orders-detail-actions">
                  <div className="detail-nav">
                    <button
                      type="button"
                      className="detail-nav-button"
                      onClick={goPrevDetail}
                      disabled={!canGoPrevDetail}
                      aria-label="Previous order"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      className="detail-nav-button"
                      onClick={goNextDetail}
                      disabled={!canGoNextDetail}
                      aria-label="Next order"
                    >
                      ▶
                    </button>
                  </div>
                  {!isMobileView && (
                    <>
                      <button
                        type="button"
                        className="orders-action"
                        onClick={() => setDetailEditOpen((prev) => !prev)}
                        disabled={detailEditSaving}
                      >
                        {detailEditOpen ? "Cancel edit" : "Edit order"}
                      </button>
                      <button
                        type="button"
                        className="orders-action"
                        onClick={() => updateOrderStatus(detailOrder, "paid")}
                        disabled={
                          statusUpdatingId === detailOrder.id ||
                          ["paid", "fulfilled", "delivered", "completed", "cancelled", "canceled"].includes(
                            normalizeStatus(detailOrder.status)
                          )
                        }
                      >
                        {statusUpdatingId === detailOrder.id ? "Updating..." : "Accept"}
                      </button>
                      <button
                        type="button"
                        className="orders-action orders-action-primary"
                        onClick={() => updateOrderStatus(detailOrder, "fulfilled")}
                        disabled={
                          statusUpdatingId === detailOrder.id ||
                          ["fulfilled", "delivered", "completed", "cancelled", "canceled"].includes(
                            normalizeStatus(detailOrder.status)
                          )
                        }
                      >
                        {statusUpdatingId === detailOrder.id ? "Updating..." : "Confirm"}
                      </button>
                    </>
                  )}
                  <button className="admin-close" onClick={() => setDetailOrder(null)} aria-label="Close detail">
                    Close
                  </button>
                </div>
              </header>
              {isMobileView && (
                <div className="orders-detail-mobile-actions">
                  <button
                    type="button"
                    className="orders-action"
                    onClick={() => setDetailEditOpen((prev) => !prev)}
                    disabled={detailEditSaving}
                  >
                    {detailEditOpen ? "Cancel edit" : "Edit order"}
                  </button>
                  <button
                    type="button"
                    className="orders-action"
                    onClick={() => updateOrderStatus(detailOrder, "paid")}
                    disabled={
                      statusUpdatingId === detailOrder.id ||
                      ["paid", "fulfilled", "delivered", "completed", "cancelled", "canceled"].includes(
                        normalizeStatus(detailOrder.status)
                      )
                    }
                  >
                    {statusUpdatingId === detailOrder.id ? "Updating..." : "Accept"}
                  </button>
                  <button
                    type="button"
                    className="orders-action orders-action-primary"
                    onClick={() => updateOrderStatus(detailOrder, "fulfilled")}
                    disabled={
                      statusUpdatingId === detailOrder.id ||
                      ["fulfilled", "delivered", "completed", "cancelled", "canceled"].includes(
                        normalizeStatus(detailOrder.status)
                      )
                    }
                  >
                    {statusUpdatingId === detailOrder.id ? "Updating..." : "Confirm"}
                  </button>
                </div>
              )}
              <div className="orders-detail-body">
                <p>Total: {formatCurrency(detailOrder.total)}</p>
                <p>Fulfillment: {(detailOrder.deliveryMethod || "delivery").toUpperCase()}</p>
                <p>Order date: {formatDate(detailOrder.orderDate)}</p>
                {detailEditOpen ? (
                  <div className="orders-detail-edit">
                    <label>
                      Pickup date
                      <input
                        type="date"
                        value={detailEditForm.date}
                        onChange={(event) =>
                          setDetailEditForm((prev) => ({ ...prev, date: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Pickup window
                      <select
                        value={detailEditForm.window}
                        onChange={(event) =>
                          setDetailEditForm((prev) => ({ ...prev, window: event.target.value }))
                        }
                      >
                        <option value="">Select a window</option>
                        {Object.entries(WINDOW_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Notes
                      <textarea
                        rows="3"
                        value={detailEditForm.notes}
                        onChange={(event) =>
                          setDetailEditForm((prev) => ({ ...prev, notes: event.target.value }))
                        }
                      />
                    </label>
                    {detailEditError && <p className="orders-error">{detailEditError}</p>}
                    <div className="orders-detail-edit-actions">
                      <button
                        type="button"
                        className="orders-action orders-action-primary"
                        onClick={saveOrderDetails}
                        disabled={detailEditSaving}
                      >
                        {detailEditSaving ? "Saving..." : "Save changes"}
                      </button>
                      <button
                        type="button"
                        className="orders-action"
                        onClick={() => setDetailEditOpen(false)}
                        disabled={detailEditSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const details = getFulfillmentDetails(detailOrder);
                    const label = details.pickup ? "Pickup" : "Delivery";
                    return (
                      <>
                        <p>{label} date: {details.date ? formatDate(details.date) : "-"}</p>
                        <p>{label} window: {formatWindow(details.window)}</p>
                        {!details.pickup && (
                          <>
                            <p>Address: {details.address || "-"}</p>
                            <p>Contact: {details.contact || "-"}</p>
                          </>
                        )}
                        {details.notes && <p>Notes: {details.notes}</p>}
                      </>
                    );
                  })()
                )}
                <p>Assigned To: {formatUser(detailOrder.assignedUserName)}</p>
                <p>Last updated: {formatDateTime(detailOrder.lastModifiedAt)}</p>
                <div className="orders-detail-items">
                  <p className="orders-detail-items-title">Items</p>
                  {Array.isArray(detailOrder.items) && detailOrder.items.length > 0 ? (
                    <ul className="orders-detail-list">
                      {detailOrder.items.map((item) => (
                        <li key={item.id || `${item.productId}-${item.sku}`}>
                          {item.imageUrl && (
                            <span className="orders-detail-thumb">
                              <img src={item.imageUrl} alt={item.productName || item.sku || "Item"} />
                            </span>
                          )}
                          <div>
                            <p className="orders-detail-item-name">{item.productName || `Product ${item.productId}`}</p>
                            <p className="orders-detail-item-meta">
                              SKU {item.sku || "N/A"} · Qty {item.quantity}
                            </p>
                          </div>
                          <div className="orders-detail-item-total">
                            <span>{formatCurrency((item.unitPrice || 0) / 100)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="orders-empty">No items found for this order.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default OrdersList;
