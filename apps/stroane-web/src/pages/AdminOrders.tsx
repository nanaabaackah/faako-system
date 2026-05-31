import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineCheckCircle,
  HiOutlineClipboardList,
  HiOutlineRefresh,
  HiOutlineSearch,
} from "react-icons/hi";
import {
  adminOrderApi,
  type AdminOrderDetail,
  type AdminOrderFilters,
  type AdminOrderSummary,
} from "../api/adminOrders";
import { useAdminPortal } from "../context/AdminPortalContext";
import { formatCurrency } from "../data/products";
import useSEOMeta from "../hooks/useSEOMeta";
import { portalUrl } from "../config/appSurface";
import "../styles/pages/AdminOrders.css";

const ORDER_STATUS_OPTIONS = [
  { value: "", label: "All order statuses" },
  { value: "payment_pending", label: "Payment pending" },
  { value: "paid", label: "Paid" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "All payment statuses" },
  { value: "payment_pending", label: "Payment pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "abandoned", label: "Abandoned" },
  { value: "not_started", label: "Not started" },
];

const FULFILLMENT_STATUS_OPTIONS = [
  { value: "", label: "All fulfillment" },
  { value: "paid", label: "Paid" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const QUICK_ACTIONS = [
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancel" },
];

const formatStatusLabel = (value = "") =>
  value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const getBadgeClass = (status = "") =>
  `admin-orders-badge admin-orders-badge--${status.replace(/_/g, "-") || "neutral"}`;

const canFulfill = (order?: AdminOrderDetail | null) => {
  if (!order) return false;
  return order.paymentStatus === "paid" || order.status === "paid" || Boolean(order.paidAt);
};

const AdminOrders: React.FC = () => {
  const { session } = useAdminPortal();
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetail | null>(null);
  const [filters, setFilters] = useState<AdminOrderFilters>({});
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({
    deliveryMethod: "",
    expectedDeliveryDate: "",
    adminDeliveryNotes: "",
    internalNotes: "",
  });

  const isAdmin = session?.role === "ADMIN";
  const selectedCanFulfill = canFulfill(selectedOrder);

  useSEOMeta({
    title: "Admin orders | Stroane",
    description: "Private Stroane order management.",
    canonical: portalUrl("/admin/orders"),
    noIndex: true,
  });

  const loadOrders = useCallback(
    async (nextFilters = filters) => {
      if (!session) return;
      setLoading(true);
      setError("");
      try {
        const nextOrders = await adminOrderApi.listOrders(session, nextFilters);
        setOrders(nextOrders);
        if (!selectedOrder && nextOrders[0]) {
          const detail = await adminOrderApi.getOrder(session, nextOrders[0].id);
          setSelectedOrder(detail);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load orders.");
      } finally {
        setLoading(false);
      }
    },
    [filters, selectedOrder, session]
  );

  const loadOrderDetail = useCallback(
    async (orderId: string) => {
      if (!session) return;
      setDetailLoading(true);
      setError("");
      try {
        const detail = await adminOrderApi.getOrder(session, orderId);
        setSelectedOrder(detail);
        setDraft({
          deliveryMethod: detail.delivery.method || "",
          expectedDeliveryDate: toDateInputValue(detail.delivery.expectedDeliveryDate),
          adminDeliveryNotes: detail.delivery.adminNotes || "",
          internalNotes: detail.internalNotes || "",
        });
      } catch (detailError) {
        setError(detailError instanceof Error ? detailError.message : "Unable to load order.");
      } finally {
        setDetailLoading(false);
      }
    },
    [session]
  );

  useEffect(() => {
    if (session) {
      loadOrders();
    }
  }, [loadOrders, session]);

  useEffect(() => {
    if (selectedOrder) {
      setDraft({
        deliveryMethod: selectedOrder.delivery.method || "",
        expectedDeliveryDate: toDateInputValue(selectedOrder.delivery.expectedDeliveryDate),
        adminDeliveryNotes: selectedOrder.delivery.adminNotes || "",
        internalNotes: selectedOrder.internalNotes || "",
      });
    }
  }, [selectedOrder]);

  const filteredTotal = useMemo(() => orders.length, [orders]);

  const updateFilters = (key: keyof AdminOrderFilters, value: string) => {
    const nextFilters = { ...filters, [key]: value || undefined };
    setFilters(nextFilters);
    loadOrders(nextFilters);
  };

  const runStatusAction = async (status: string) => {
    if (!session || !selectedOrder || !isAdmin) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await adminOrderApi.updateOrder(session, selectedOrder.id, { status });
      setSelectedOrder(updated);
      setNotice(`Order updated to ${formatStatusLabel(updated.fulfillmentStatus)}.`);
      await loadOrders(filters);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update order.");
    } finally {
      setSaving(false);
    }
  };

  const saveFulfillmentFields = async () => {
    if (!session || !selectedOrder || !isAdmin) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await adminOrderApi.updateOrder(session, selectedOrder.id, {
        deliveryMethod: draft.deliveryMethod,
        expectedDeliveryDate: draft.expectedDeliveryDate || null,
        adminDeliveryNotes: draft.adminDeliveryNotes,
        internalNotes: draft.internalNotes,
      });
      setSelectedOrder(updated);
      setNotice("Order notes saved.");
      await loadOrders(filters);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to save order notes.");
    } finally {
      setSaving(false);
    }
  };

  if (!session) return null;

  return (
    <section className="admin-orders-page">
        <div className="admin-orders-shell">
          <header className="admin-orders-head">
            <div>
              <span className="admin-orders-kicker">
                <HiOutlineClipboardList aria-hidden="true" />
                Stroane admin
              </span>
              <h1>Orders</h1>
              <p>Review paid orders, fulfillment notes, and lightweight delivery status.</p>
            </div>
          </header>

          <div className="admin-orders-toolbar">
            <label className="admin-orders-search">
              <HiOutlineSearch aria-hidden="true" />
              <input
                value={filters.search || ""}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadOrders(filters);
                }}
                placeholder="Search orders, customers, phone, email"
              />
            </label>
            <select
              value={filters.status || ""}
              onChange={(event) => updateFilters("status", event.target.value)}
            >
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={filters.paymentStatus || ""}
              onChange={(event) => updateFilters("paymentStatus", event.target.value)}
            >
              {PAYMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={filters.fulfillmentStatus || ""}
              onChange={(event) => updateFilters("fulfillmentStatus", event.target.value)}
            >
              {FULFILLMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => loadOrders(filters)} disabled={loading}>
              <HiOutlineRefresh aria-hidden="true" />
              Refresh
            </button>
          </div>

          {error ? <p className="admin-orders-error">{error}</p> : null}
          {notice ? <p className="admin-orders-notice">{notice}</p> : null}

          <div className="admin-orders-grid">
            <div className="admin-orders-list" aria-live="polite">
              <div className="admin-orders-list__meta">
                <span>{loading ? "Loading orders..." : `${filteredTotal} order${filteredTotal === 1 ? "" : "s"}`}</span>
              </div>
              {!loading && !orders.length ? (
                <div className="admin-orders-empty">
                  <h2>No orders found</h2>
                  <p>Try another search or filter. Paid checkout orders will appear here.</p>
                </div>
              ) : null}
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  className={`admin-orders-row${
                    selectedOrder?.id === order.id ? " admin-orders-row--active" : ""
                  }`}
                  onClick={() => loadOrderDetail(order.id)}
                >
                  <span>
                    <strong>{order.orderNumber}</strong>
                    <small>{order.customerName}</small>
                  </span>
                  <span>
                    <strong>{formatCurrency(order.total)}</strong>
                    <small>{formatDate(order.createdAt)}</small>
                  </span>
                  <span className={getBadgeClass(order.paymentStatus)}>
                    {formatStatusLabel(order.paymentStatus)}
                  </span>
                  <span className={getBadgeClass(order.fulfillmentStatus)}>
                    {formatStatusLabel(order.fulfillmentStatus)}
                  </span>
                </button>
              ))}
            </div>

            <aside className="admin-orders-detail">
              {detailLoading ? (
                <div className="admin-orders-empty">
                  <h2>Loading order</h2>
                  <p>Fetching the latest customer-safe order details.</p>
                </div>
              ) : selectedOrder ? (
                <>
                  <div className="admin-orders-detail__head">
                    <div>
                      <span className="admin-orders-kicker">Order detail</span>
                      <h2>{selectedOrder.orderNumber}</h2>
                      <p>{selectedOrder.customer.name}</p>
                    </div>
                    <span className={getBadgeClass(selectedOrder.fulfillmentStatus)}>
                      {formatStatusLabel(selectedOrder.fulfillmentStatus)}
                    </span>
                  </div>

                  <div className="admin-orders-summary">
                    <span>
                      <small>Total</small>
                      <strong>{formatCurrency(selectedOrder.total)}</strong>
                    </span>
                    <span>
                      <small>Payment</small>
                      <strong>{formatStatusLabel(selectedOrder.payment.status)}</strong>
                    </span>
                    <span>
                      <small>Paystack ref</small>
                      <strong>{selectedOrder.payment.reference || "Not set"}</strong>
                    </span>
                  </div>

                  <section className="admin-orders-section">
                    <h3>Customer</h3>
                    <dl>
                      <div>
                        <dt>Email</dt>
                        <dd>{selectedOrder.customer.email}</dd>
                      </div>
                      <div>
                        <dt>Phone</dt>
                        <dd>{selectedOrder.customer.phone}</dd>
                      </div>
                      <div>
                        <dt>Business</dt>
                        <dd>{selectedOrder.customer.businessName || "Not provided"}</dd>
                      </div>
                      <div>
                        <dt>Preferred contact</dt>
                        <dd>{formatStatusLabel(selectedOrder.customer.preferredContactMethod)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="admin-orders-section">
                    <h3>Items</h3>
                    <ul className="admin-orders-items">
                      {selectedOrder.items.map((item) => (
                        <li key={item.id}>
                          <span>
                            <strong>{item.productName}</strong>
                            <small>{item.sku || item.productSlug}</small>
                          </span>
                          <span>
                            {item.quantity} x {formatCurrency(item.unitPrice)}
                          </span>
                          <strong>{formatCurrency(item.lineTotal)}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="admin-orders-section">
                    <h3>Delivery</h3>
                    <p>{selectedOrder.delivery.address}</p>
                    {selectedOrder.delivery.customerNotes ? (
                      <p className="admin-orders-muted">{selectedOrder.delivery.customerNotes}</p>
                    ) : null}
                    <div className="admin-orders-form-grid">
                      <label>
                        <span>Method</span>
                        <input
                          value={draft.deliveryMethod}
                          onChange={(event) =>
                            setDraft({ ...draft, deliveryMethod: event.target.value })
                          }
                          disabled={!isAdmin}
                          placeholder="Pickup, dispatch, courier..."
                        />
                      </label>
                      <label>
                        <span>Expected date</span>
                        <input
                          type="date"
                          value={draft.expectedDeliveryDate}
                          onChange={(event) =>
                            setDraft({ ...draft, expectedDeliveryDate: event.target.value })
                          }
                          disabled={!isAdmin}
                        />
                      </label>
                    </div>
                    <label className="admin-orders-textarea">
                      <span>Delivery notes</span>
                      <textarea
                        value={draft.adminDeliveryNotes}
                        onChange={(event) =>
                          setDraft({ ...draft, adminDeliveryNotes: event.target.value })
                        }
                        disabled={!isAdmin}
                        placeholder="Internal delivery coordination notes"
                      />
                    </label>
                    <label className="admin-orders-textarea">
                      <span>Internal notes</span>
                      <textarea
                        value={draft.internalNotes}
                        onChange={(event) =>
                          setDraft({ ...draft, internalNotes: event.target.value })
                        }
                        disabled={!isAdmin}
                        placeholder="Staff-only notes. Not sent to the customer."
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-orders-save"
                      disabled={!isAdmin || saving}
                      onClick={saveFulfillmentFields}
                    >
                      Save notes
                    </button>
                  </section>

                  <section className="admin-orders-section">
                    <h3>Status actions</h3>
                    {!selectedCanFulfill ? (
                      <p className="admin-orders-warning">
                        Fulfillment actions unlock after Paystack-confirmed payment.
                      </p>
                    ) : null}
                    {!isAdmin ? (
                      <p className="admin-orders-warning">
                        Viewer access is read-only. Ask an admin to update this order.
                      </p>
                    ) : null}
                    <div className="admin-orders-actions">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.value}
                          type="button"
                          disabled={!isAdmin || saving || (action.value !== "cancelled" && !selectedCanFulfill)}
                          onClick={() => runStatusAction(action.value)}
                        >
                          {action.value === "completed" ? (
                            <HiOutlineCheckCircle aria-hidden="true" />
                          ) : null}
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <div className="admin-orders-empty">
                  <h2>Select an order</h2>
                  <p>Choose an order from the list to review payment and fulfillment details.</p>
                </div>
              )}
            </aside>
          </div>
        </div>
    </section>
  );
};

export default AdminOrders;
