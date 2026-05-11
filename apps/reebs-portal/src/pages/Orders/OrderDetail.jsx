import React, { useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import { KpiCard } from "@faako/ui";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import "./OrderDetail.css";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { InlineNotice } from "../../components/InlineNotice/InlineNotice";
import { AppIcon } from "../../components/Icon/Icon";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { canAccessPrivilegedPortalArea } from "../../utils/adminAccess";
import { faChevronLeft, faChevronRight } from "../../icons/iconSet";
import FulfillmentPanel from "./components/FulfillmentPanel";
import LineItemEditor from "./components/LineItemEditor";
import OrderTimeline from "./components/OrderTimeline";
import PaymentLedger from "./components/PaymentLedger";
import ReceiptViewer from "./components/ReceiptViewer";
import useOrder from "./hooks/useOrder";
import useOrderPayments from "./hooks/useOrderPayments";
import {
  formatCurrencyFromCents,
  formatDateTime,
  formatStatusLabel,
  getOrderAmountPaidCents,
  getOrderTotalCents,
  getOrdersStatusClass,
} from "./orderUi";

function DetailRow({ label, value }) {
  return (
    <div className="bubble-card orders-detail-row">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const getSafeOrdersReturnTo = (value) =>
  typeof value === "string" && value.startsWith("/admin/orders") ? value : "/admin/orders";

function StockMovementsPanel({ movements = [] }) {
  const safeMovements = Array.isArray(movements) ? movements : [];
  return (
    <section className="glass-card orders-panel orders-stock-panel">
      <div className="orders-panel-header">
        <div>
          <h3>Stock movements</h3>
          <span>{safeMovements.length} linked</span>
        </div>
      </div>
      <div className="orders-stock-list">
        {safeMovements.length ? (
          safeMovements.map((movement) => (
            <article key={movement.id} className="bubble-card orders-stock-card">
              <div>
                <strong>{movement.productName || movement.sku || "Inventory item"}</strong>
                <span>{formatStatusLabel(movement.movementType || movement.type, "Movement")}</span>
              </div>
              <div>
                <strong>{Number(movement.quantity || 0)}</strong>
                <time>{formatDateTime(movement.date || movement.createdAt)}</time>
              </div>
            </article>
          ))
        ) : (
          <p className="orders-empty">No stock movement linked.</p>
        )}
      </div>
    </section>
  );
}

function LinkedRecordsPanel({ order }) {
  const expenses = Array.isArray(order?.expenses) ? order.expenses : [];
  return (
    <section className="glass-card orders-panel orders-linked-panel">
      <div className="orders-panel-header">
        <div>
          <h3>Linked records</h3>
          <span>Booking, expenses, documents</span>
        </div>
      </div>
      <div className="orders-linked-grid">
        <div className="bubble-card orders-linked-card">
          <span>Booking</span>
          {order?.linkedBooking?.id ? (
            <Link to={`/admin/bookings?id=${order.linkedBooking.id}`}>
              Booking #{order.linkedBooking.id}
            </Link>
          ) : (
            <strong>None</strong>
          )}
        </div>
        <div className="bubble-card orders-linked-card">
          <span>Expenses</span>
          <strong>{expenses.length}</strong>
        </div>
        <div className="bubble-card orders-linked-card">
          <span>Receipts</span>
          <strong>{Array.isArray(order?.receipts) ? order.receipts.length : 0}</strong>
        </div>
      </div>
      {expenses.length > 0 && (
        <div className="orders-linked-expenses">
          {expenses.map((expense) => (
            <article key={expense.id} className="expenses-card orders-linked-expense">
              <strong>{expense.category || "Expense"}</strong>
              <span>{formatCurrencyFromCents(Number(expense.amount || 0) * 100)}</span>
              <p>{expense.description || "-"}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canUseInvoicing = canAccessPrivilegedPortalArea(String(user?.role || "").toLowerCase());
  const { order, setOrder, loading, error, refetch } = useOrder(id);
  const paymentsHook = useOrderPayments(id);
  const navigationState =
    location.state && typeof location.state === "object" ? location.state : {};

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const metrics = useMemo(() => {
    const totalCents = getOrderTotalCents(order);
    const paidCents = getOrderAmountPaidCents({
      ...order,
      payments: paymentsHook.payments.length ? paymentsHook.payments : order?.payments,
    });
    return {
      totalCents,
      paidCents,
      balanceCents: Math.max(totalCents - paidCents, 0),
      itemCount: Array.isArray(order?.items) ? order.items.length : 0,
    };
  }, [order, paymentsHook.payments]);

  const orderPager = useMemo(() => {
    const sequence = Array.isArray(navigationState.orderSequence)
      ? navigationState.orderSequence
          .filter((item) => item?.id)
          .map((item) => ({
            id: item.id,
            orderNumber: item.orderNumber || `#${item.id}`,
            customerName: item.customerName || "Customer",
          }))
      : [];
    const currentIndex = sequence.findIndex((item) => String(item.id) === String(id));
    return {
      sequence,
      currentIndex,
      current: currentIndex >= 0 ? sequence[currentIndex] : null,
      previous: currentIndex > 0 ? sequence[currentIndex - 1] : null,
      next: currentIndex >= 0 && currentIndex < sequence.length - 1 ? sequence[currentIndex + 1] : null,
      position: currentIndex >= 0 ? currentIndex + 1 : 1,
      returnTo: getSafeOrdersReturnTo(navigationState.returnTo),
    };
  }, [id, navigationState.orderSequence, navigationState.returnTo]);

  const goToPagedOrder = (targetOrder) => {
    if (!targetOrder?.id) return;
    navigate(`/admin/orders/${encodeURIComponent(targetOrder.id)}`, {
      state: {
        ...navigationState,
        currentOrderId: targetOrder.id,
        orderSequence: orderPager.sequence,
        returnTo: orderPager.returnTo,
      },
    });
  };

  const refreshAll = async () => {
    const orderController = new AbortController();
    const paymentsController = new AbortController();
    await Promise.all([
      refetch(orderController.signal),
      paymentsHook.refetch(paymentsController.signal),
    ]);
  };

  const handleFulfillmentUpdated = (payload) => {
    setOrder((current) => (current ? { ...current, ...payload } : payload));
    refreshAll();
  };

  return (
    <div className="orders-page">
      <Helmet>
        <title>{order?.orderNumber ? `${order.orderNumber} | Orders` : "Order Detail"}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="orders-shell">
        <AdminBreadcrumb
          items={[
            { label: "Orders", to: "/admin/orders" },
            { label: order?.orderNumber || "Detail" },
          ]}
        />

        <AdminPageHeader
          eyebrow="Order"
          title={order?.orderNumber || "Order detail"}
          subtitle={
            order
              ? `${order.customerName || "Customer"} · ${formatStatusLabel(order.source || order.purchaseChannel, "Manual")}`
              : "Loading order"
          }
          actionsClassName="admin-header-actions"
          actions={
            <div className="orders-detail-header-actions">
              <button type="button" className="orders-secondary" onClick={() => navigate(orderPager.returnTo)}>
                Back to orders
              </button>
              {order?.id && canUseInvoicing && (
                <Link to={`/admin/invoicing?type=orders&id=${order.id}`} className="orders-primary">
                  Generate receipt
                </Link>
              )}
            </div>
          }
        />

        {orderPager.sequence.length > 1 && orderPager.currentIndex >= 0 && (
          <nav className="glass-card orders-detail-pager" aria-label="Order detail pagination">
            <button
              type="button"
              className="orders-secondary orders-detail-pager-button"
              onClick={() => goToPagedOrder(orderPager.previous)}
              disabled={!orderPager.previous}
              aria-label={
                orderPager.previous
                  ? `Previous order, ${orderPager.previous.orderNumber}`
                  : "No previous order"
              }
            >
              <AppIcon icon={faChevronLeft} />
              <span>Previous</span>
            </button>
            <div className="orders-detail-pager-meta" aria-live="polite">
              <span>
                Order {orderPager.position} of {orderPager.sequence.length}
              </span>
              <strong>{orderPager.current?.orderNumber || order?.orderNumber || `#${id}`}</strong>
              <small>{orderPager.current?.customerName || order?.customerName || "Customer"}</small>
            </div>
            <button
              type="button"
              className="orders-secondary orders-detail-pager-button"
              onClick={() => goToPagedOrder(orderPager.next)}
              disabled={!orderPager.next}
              aria-label={orderPager.next ? `Next order, ${orderPager.next.orderNumber}` : "No next order"}
            >
              <span>Next</span>
              <AppIcon icon={faChevronRight} />
            </button>
          </nav>
        )}

        {loading && <InlineNotice tone="loading" title="Loading order" message="Pulling the latest order record." />}
        {!loading && error && <InlineNotice tone="error" title="Order unavailable" message={error} />}

        {!loading && !error && order && (
          <>
            <section className="orders-detail-kpis" aria-label="Order totals">
              <KpiCard
                className="bubble-card orders-kpi"
                label="Grand total"
                value={formatCurrencyFromCents(metrics.totalCents)}
                detail={formatStatusLabel(order.status, "Pending")}
              />
              <KpiCard
                className="bubble-card orders-kpi"
                label="Amount paid"
                value={formatCurrencyFromCents(metrics.paidCents)}
                detail={formatStatusLabel(order.paymentStatus, "Unpaid")}
                tone="success"
              />
              <KpiCard
                className="bubble-card orders-kpi"
                label="Balance due"
                value={formatCurrencyFromCents(metrics.balanceCents)}
                detail={`${metrics.itemCount} items`}
                tone={metrics.balanceCents > 0 ? "warning" : "success"}
              />
            </section>

            <section className="orders-detail-grid">
              <section className="glass-card orders-panel orders-summary-panel">
                <div className="orders-panel-header">
                  <div>
                    <h3>Order summary</h3>
                    <span>{formatDateTime(order.orderDate || order.createdAt)}</span>
                  </div>
                  <span className={`orders-status-pill orders-status-pill--compact ${getOrdersStatusClass(order.status)}`}>
                    {formatStatusLabel(order.status, "Pending")}
                  </span>
                </div>
                <div className="orders-detail-rows">
                  <DetailRow label="Source" value={formatStatusLabel(order.source, "Manual Admin Entry")} />
                  <DetailRow label="Channel" value={order.purchaseChannel || "-"} />
                  <DetailRow label="Created by" value={order.createdByName || order.assignedUserName || "Staff"} />
                  <DetailRow label="Last updated" value={formatDateTime(order.lastModifiedAt || order.updatedAt)} />
                  <DetailRow label="Customer notes" value={order.notes} />
                  <DetailRow label="Internal notes" value={order.internalNotes} />
                </div>
              </section>

              <section className="glass-card orders-panel orders-customer-panel">
                <div className="orders-panel-header">
                  <div>
                    <h3>Customer</h3>
                    <span>{order.customer?.id ? `#${order.customer.id}` : "Profile"}</span>
                  </div>
                </div>
                <div className="orders-detail-rows">
                  <DetailRow label="Name" value={order.customer?.name || order.customerName} />
                  <DetailRow label="Phone" value={order.customer?.phone || order.customerPhone} />
                  <DetailRow label="Email" value={order.customer?.email || order.customerEmail} />
                </div>
              </section>

              <LineItemEditor items={order.items} stockMovements={order.stockMovements} />

              <PaymentLedger
                order={order}
                payments={paymentsHook.payments.length ? paymentsHook.payments : order.payments}
                loading={paymentsHook.loading}
                error={paymentsHook.error}
                onRecordPayment={paymentsHook.recordPayment}
                onPaymentSaved={refreshAll}
                draftScope={{
                  organizationId: user?.organizationId,
                  actorId: user?.id,
                }}
              />

              <FulfillmentPanel order={order} onUpdated={handleFulfillmentUpdated} />

              <ReceiptViewer receipts={order.receipts} />

              <StockMovementsPanel movements={order.stockMovements} />

              <LinkedRecordsPanel order={order} />

              <OrderTimeline events={order.events} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
