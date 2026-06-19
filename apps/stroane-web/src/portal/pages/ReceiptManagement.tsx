import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  HiOutlineClipboardCheck,
  HiOutlineDocumentText,
  HiOutlineDownload,
  HiOutlineMail,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSave,
} from "react-icons/hi";
import {
  ERPIconAction,
  ERPFormNotice,
  ERPModal,
  ERPPrimaryAction,
  ERPSecondaryAction,
  ERPStatusBadge,
  ERPTablePagination,
  ERPTableSearch,
  ERPTextareaField,
  SelectField,
} from "@faako/ui";
import { portalUrl } from "../../config/appSurface";
import useSEOMeta from "../../hooks/useSEOMeta";
import { useAdminPortal } from "../context/AdminPortalContext";
import { adminOrdersApi, type AdminOrder } from "../api/adminOrders";
import {
  adminReceiptsApi,
  type AdminReceipt,
  type AdminReceiptFilters,
  type AdminReceiptSummary,
} from "../api/adminReceipts";
import "../styles/receipt-management.css";

const RECEIPT_PAGE_SIZE = 12;

const EMPTY_SUMMARY: AdminReceiptSummary = {
  totalReceipts: 0,
  issuedReceipts: 0,
  sentReceipts: 0,
  downloadedReceipts: 0,
  totalValue: 0,
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "issued", label: "Issued" },
  { value: "void", label: "Void" },
];

const getSelectValue = (value: string | string[]) =>
  Array.isArray(value) ? value[0] || "" : value;

const formatMoney = (value: number, currency = "GHS") =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatDate = (value?: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatLabel = (value = "") =>
  value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ||
  "Not set";

const getReceiptTone = (status = ""): "neutral" | "success" | "warning" | "danger" | "info" => {
  if (status === "issued") return "success";
  if (status === "void") return "danger";
  return "neutral";
};

const getPaymentTone = (status = ""): "neutral" | "success" | "warning" | "danger" | "info" => {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "success") return "success";
  if (normalized === "failed" || normalized === "abandoned") return "danger";
  if (normalized === "payment_pending" || normalized === "pending") return "warning";
  return "neutral";
};

const saveReceiptHtml = (receipt: AdminReceipt, html: string) => {
  if (typeof document === "undefined") return;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${receipt.receiptNumber || "stroane-receipt"}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const ReceiptManagement: React.FC = () => {
  const { session } = useAdminPortal();
  const canManageReceipts = String(session?.role || "").toUpperCase() === "ADMIN";
  const [receipts, setReceipts] = useState<AdminReceipt[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [summary, setSummary] = useState<AdminReceiptSummary>(EMPTY_SUMMARY);
  const [filters, setFilters] = useState<AdminReceiptFilters>({
    search: "",
    status: "",
    limit: 180,
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState("");
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(() => new Set());
  const [draftOrderId, setDraftOrderId] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [receiptAction, setReceiptAction] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useSEOMeta({
    title: "Receipts | Stroane operations",
    description: "Create, download, and resend Stroane order receipts.",
    canonical: portalUrl("/admin/receipts"),
    noIndex: true,
  });

  const pageCount = Math.max(1, Math.ceil(receipts.length / RECEIPT_PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedReceipts = useMemo(
    () =>
      receipts.slice(
        clampedPageIndex * RECEIPT_PAGE_SIZE,
        clampedPageIndex * RECEIPT_PAGE_SIZE + RECEIPT_PAGE_SIZE
      ),
    [clampedPageIndex, receipts]
  );
  const selectedReceipt = useMemo(
    () => receipts.find((receipt) => receipt.id === selectedReceiptId) || null,
    [receipts, selectedReceiptId]
  );

  const orderOptions = useMemo(
    () => [
      { value: "", label: ordersLoading ? "Loading orders..." : "Select an order" },
      ...orders.map((order) => ({
        value: order.id,
        label: `${order.orderNumber} - ${order.customer.name} - ${formatMoney(
          order.total,
          order.currency
        )}`,
      })),
    ],
    [orders, ordersLoading]
  );

  const loadReceipts = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const data = await adminReceiptsApi.listReceipts(session, filters);
      setReceipts(data.receipts);
      setSummary(data.summary);
      setPageIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load receipts.");
    } finally {
      setLoading(false);
    }
  }, [filters, session]);

  const loadOrders = useCallback(async () => {
    if (!session) return;
    setOrdersLoading(true);
    try {
      const data = await adminOrdersApi.listOrders(session, { limit: 200 });
      setOrders(data.orders.filter((order) => order.status !== "cancelled"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load order choices.");
    } finally {
      setOrdersLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const receiptIds = new Set(receipts.map((receipt) => receipt.id));
    setSelectedReceiptIds((current) => {
      const next = new Set(Array.from(current).filter((receiptId) => receiptIds.has(receiptId)));
      return next.size === current.size ? current : next;
    });
    if (selectedReceiptId && !receiptIds.has(selectedReceiptId)) setSelectedReceiptId("");
  }, [receipts, selectedReceiptId]);

  const updateFilter = <Key extends keyof AdminReceiptFilters>(
    key: Key,
    value: AdminReceiptFilters[Key]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const replaceReceipt = (receipt: AdminReceipt) => {
    setReceipts((current) =>
      current.map((item) => (item.id === receipt.id ? receipt : item))
    );
  };

  const toggleReceiptSelection = useCallback((receiptId: string) => {
    setSelectedReceiptIds((current) => {
      const next = new Set(current);
      if (next.has(receiptId)) {
        next.delete(receiptId);
      } else {
        next.add(receiptId);
      }
      return next;
    });
  }, []);

  const toggleReceiptPageSelection = useCallback(() => {
    setSelectedReceiptIds((current) => {
      const next = new Set(current);
      const allPageSelected =
        paginatedReceipts.length > 0 &&
        paginatedReceipts.every((receipt) => next.has(receipt.id));
      paginatedReceipts.forEach((receipt) => {
        if (allPageSelected) {
          next.delete(receipt.id);
        } else {
          next.add(receipt.id);
        }
      });
      return next;
    });
  }, [paginatedReceipts]);

  const handleCreateReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    if (!draftOrderId) {
      setError("Select an order before creating a receipt.");
      return;
    }

    setSaving(true);
    setNotice("");
    setError("");
    try {
      const data = await adminReceiptsApi.createReceipt(session, {
        orderId: draftOrderId,
        notes: draftNotes,
      });
      setReceipts((current) => [data.receipt, ...current.filter((item) => item.id !== data.receipt.id)]);
      setSelectedReceiptId(data.receipt.id);
      setDraftOrderId("");
      setDraftNotes("");
      setCreateOpen(false);
      setNotice(`Receipt ${data.receipt.receiptNumber} created.`);
      await loadReceipts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create receipt.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadReceipt = async (receipt: AdminReceipt) => {
    if (!session) return;
    setReceiptAction(`download:${receipt.id}`);
    setError("");
    try {
      const html = await adminReceiptsApi.downloadReceipt(session, receipt.id);
      saveReceiptHtml(receipt, html);
      replaceReceipt({ ...receipt, downloadedAt: new Date().toISOString() });
      setNotice(`Receipt ${receipt.receiptNumber} downloaded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download receipt.");
    } finally {
      setReceiptAction("");
    }
  };

  const handleResendReceipt = async (receipt: AdminReceipt) => {
    if (!session) return;
    setReceiptAction(`resend:${receipt.id}`);
    setError("");
    setNotice("");
    try {
      const data = await adminReceiptsApi.resendReceipt(session, receipt.id);
      replaceReceipt(data.receipt);
      setNotice(
        data.notification.sent
          ? `Receipt ${receipt.receiptNumber} resent.`
          : `Receipt email skipped: ${data.notification.reason || data.notification.status}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend receipt.");
    } finally {
      setReceiptAction("");
    }
  };

  return (
    <div className="stroane-receipts">
      <header className="stroane-receipts__head">
        <div>
          <span>Receipt hub</span>
          <h1>Receipts</h1>
          <p>Create and manage customer-safe receipts for paid and manually reconciled orders.</p>
        </div>
        <div className="stroane-receipts__head-actions">
          <ERPSecondaryAction
            type="button"
            icon={<HiOutlineRefresh />}
            onClick={() => void loadReceipts()}
            disabled={loading}
          >
            Refresh
          </ERPSecondaryAction>
          <ERPPrimaryAction
            type="button"
            icon={<HiOutlinePlus />}
            onClick={() => setCreateOpen(true)}
            disabled={!canManageReceipts || !orders.length}
          >
            New receipt
          </ERPPrimaryAction>
        </div>
      </header>

      <section className="stroane-receipts__kpis" aria-label="Receipt KPIs">
        <article className="bubble-card" data-tone="info">
          <HiOutlineMail aria-hidden="true" />
          <span>Receipt Revenue</span>
          <strong>{formatMoney(summary.totalValue)}</strong>
        </article>
        <article className="bubble-card">
          <HiOutlineDocumentText aria-hidden="true" />
          <span>Total receipts</span>
          <strong>{summary.totalReceipts}</strong>
        </article>
        <article className="bubble-card" data-tone="success">
          <HiOutlineClipboardCheck aria-hidden="true" />
          <span>Issued</span>
          <strong>{summary.issuedReceipts}</strong>
        </article>
        <article className="bubble-card" data-tone="info">
          <HiOutlineMail aria-hidden="true" />
          <span>Sent</span>
          <strong>{summary.sentReceipts}</strong>
        </article>
      </section>

      {notice ? (
        <ERPFormNotice tone="success" onDismiss={() => setNotice("")}>
          {notice}
        </ERPFormNotice>
      ) : null}
      {error ? (
        <ERPFormNotice tone="danger" onDismiss={() => setError("")}>
          {error}
        </ERPFormNotice>
      ) : null}

      <section className="stroane-receipts__table-panel">
        <div className="stroane-receipts__toolbar">
          <ERPTableSearch
            value={filters.search || ""}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search receipt, order, customer, reference..."
          />
          <SelectField
            fieldClassName="stroane-receipts__filter"
            label="Status"
            value={filters.status || ""}
            ariaLabel="Filter by receipt status"
            onChangeValue={(value) => updateFilter("status", getSelectValue(value))}
            options={STATUS_OPTIONS}
          />
        </div>

        {selectedReceiptIds.size ? (
          <div className="stroane-receipts__bulk-bar" role="region" aria-label="Selected receipts">
            <span>
              <strong>{selectedReceiptIds.size}</strong> selected
            </span>
            <ERPSecondaryAction size="sm" onClick={() => setSelectedReceiptIds(new Set())}>
              Clear selection
            </ERPSecondaryAction>
          </div>
        ) : null}

        <div className="stroane-receipts__admin-table admin-table admin-table-scroll">
          <ERPTablePagination
            className="stroane-receipts__pagination"
            pageIndex={clampedPageIndex}
            pageCount={pageCount}
            pageSize={RECEIPT_PAGE_SIZE}
            totalItems={receipts.length}
            itemLabel="receipts"
            onPageChange={setPageIndex}
          />
          <table className="stroane-receipts__table">
            <colgroup>
              <col className="stroane-receipts__col-select" />
              <col className="stroane-receipts__col-number" />
              <col className="stroane-receipts__col-customer" />
              <col className="stroane-receipts__col-receipt" />
              <col className="stroane-receipts__col-order" />
              <col className="stroane-receipts__col-payment" />
              <col className="stroane-receipts__col-issued" />
              <col className="stroane-receipts__col-total" />
              <col className="stroane-receipts__col-status" />
              <col className="stroane-receipts__col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="portal-table-select-cell" aria-label="Select receipts">
                  <input
                    type="checkbox"
                    className="portal-table-checkbox"
                    checked={
                      paginatedReceipts.length > 0 &&
                      paginatedReceipts.every((receipt) => selectedReceiptIds.has(receipt.id))
                    }
                    onChange={toggleReceiptPageSelection}
                    disabled={!paginatedReceipts.length}
                    aria-label="Select all receipts on this page"
                  />
                </th>
                <th className="portal-table-number-cell">#</th>
                <th>Customer</th>
                <th>Receipt</th>
                <th>Order</th>
                <th>Payment</th>
                <th>Issued</th>
                <th>Total</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="stroane-receipts__table-empty">
                    Loading receipts...
                  </td>
                </tr>
              ) : null}
              {!loading && !receipts.length ? (
                <tr>
                  <td colSpan={10} className="stroane-receipts__table-empty">
                    No receipts match the current view.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? paginatedReceipts.map((receipt, index) => (
                    <tr
                      key={receipt.id}
                      className={[
                        selectedReceiptIds.has(receipt.id) ? "is-bulk-selected" : "",
                        selectedReceiptId === receipt.id ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSelectedReceiptId(receipt.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedReceiptId(receipt.id);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td
                        className="portal-table-select-cell"
                        data-label="Select"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="portal-table-checkbox"
                          checked={selectedReceiptIds.has(receipt.id)}
                          onChange={() => toggleReceiptSelection(receipt.id)}
                          aria-label={`Select ${receipt.receiptNumber}`}
                        />
                      </td>
                      <td className="portal-table-number-cell" data-label="#">
                        {clampedPageIndex * RECEIPT_PAGE_SIZE + index + 1}
                      </td>
                      <td data-label="Customer">
                        <span className="stroane-receipts__customer-cell">
                          <strong>{receipt.customerName}</strong>
                        </span>
                      </td>
                      <td data-label="Receipt">
                        <span className="stroane-receipts__receipt-cell">
                          <strong>{receipt.receiptNumber}</strong>
                        </span>
                      </td>
                      <td data-label="Order">{receipt.orderNumber || "Unlinked"}</td>
                      <td data-label="Payment">
                        <ERPStatusBadge tone={getPaymentTone(receipt.paymentStatus || "")}>
                          {formatLabel(receipt.paymentStatus || "not_started")}
                        </ERPStatusBadge>
                      </td>
                      <td data-label="Issued">{formatDate(receipt.issuedAt)}</td>
                      <td data-label="Total">{formatMoney(receipt.total, receipt.currency)}</td>
                      <td data-label="Status">
                        <ERPStatusBadge tone={getReceiptTone(receipt.status)}>
                          {formatLabel(receipt.status)}
                        </ERPStatusBadge>
                      </td>
                      <td
                        className="stroane-receipts__actions-cell"
                        data-label="Actions"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <span className="stroane-receipts__row-actions">
                          <ERPIconAction
                            size="sm"
                            label={`Download ${receipt.receiptNumber}`}
                            onClick={() => void handleDownloadReceipt(receipt)}
                            loading={receiptAction === `download:${receipt.id}`}
                          >
                            <HiOutlineDownload aria-hidden="true" />
                          </ERPIconAction>
                          <ERPIconAction
                            size="sm"
                            label={`Resend ${receipt.receiptNumber}`}
                            onClick={() => void handleResendReceipt(receipt)}
                            loading={receiptAction === `resend:${receipt.id}`}
                            disabled={!canManageReceipts}
                          >
                            <HiOutlineMail aria-hidden="true" />
                          </ERPIconAction>
                        </span>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
            {receipts.length ? (
              <tfoot className="admin-table-footer">
                <tr>
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell">
                    <span className="admin-table-summary-value">
                      {formatMoney(summary.totalValue)}
                    </span>
                  </td>
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                </tr>
              </tfoot>
            ) : null}
          </table>
          <ERPTablePagination
            className="stroane-receipts__pagination"
            pageIndex={clampedPageIndex}
            pageCount={pageCount}
            pageSize={RECEIPT_PAGE_SIZE}
            totalItems={receipts.length}
            itemLabel="receipts"
            onPageChange={setPageIndex}
          />
        </div>
      </section>

      <ERPModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create receipt"
        description="Choose an order and issue a customer-safe receipt record."
        className="stroane-receipts__modal"
      >
        <form className="stroane-receipts__form" onSubmit={handleCreateReceipt}>
          <SelectField
            label="Order"
            value={draftOrderId}
            onChangeValue={(value) => setDraftOrderId(getSelectValue(value))}
            options={orderOptions}
            disabled={ordersLoading || !canManageReceipts}
          />
          <ERPTextareaField
            label="Internal receipt note"
            value={draftNotes}
            onChange={(event) => setDraftNotes(event.target.value)}
            rows={3}
            helperText="Notes stay in the portal and are not included in customer downloads or emails."
          />
          <div className="stroane-receipts__modal-actions">
            <ERPSecondaryAction type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </ERPSecondaryAction>
            <ERPPrimaryAction
              type="submit"
              icon={<HiOutlineSave />}
              loading={saving}
              disabled={!canManageReceipts || !draftOrderId}
            >
              Create receipt
            </ERPPrimaryAction>
          </div>
        </form>
      </ERPModal>

      <ERPModal
        open={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceiptId("")}
        title={selectedReceipt?.receiptNumber || "Receipt"}
        description={
          selectedReceipt
            ? `${selectedReceipt.customerName} · ${formatMoney(
                selectedReceipt.total,
                selectedReceipt.currency
              )}`
            : undefined
        }
        closeOnBackdrop
        size="xl"
        className="stroane-receipts__modal stroane-receipts__detail-modal"
      >
        {selectedReceipt ? (
          <div className="stroane-receipts__detail">
            <section className="stroane-receipts__detail-grid">
              <article className="stroane-receipts__detail-card">
                <h3>Receipt</h3>
                <dl>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <ERPStatusBadge tone={getReceiptTone(selectedReceipt.status)}>
                        {formatLabel(selectedReceipt.status)}
                      </ERPStatusBadge>
                    </dd>
                  </div>
                  <div>
                    <dt>Issued</dt>
                    <dd>{formatDate(selectedReceipt.issuedAt)}</dd>
                  </div>
                  <div>
                    <dt>Sent</dt>
                    <dd>{formatDate(selectedReceipt.sentAt)}</dd>
                  </div>
                </dl>
              </article>
              <article className="stroane-receipts__detail-card">
                <h3>Order</h3>
                <dl>
                  <div>
                    <dt>Order number</dt>
                    <dd>{selectedReceipt.orderNumber || "Unlinked"}</dd>
                  </div>
                  <div>
                    <dt>Payment</dt>
                    <dd>{formatLabel(selectedReceipt.paymentStatus || "not_started")}</dd>
                  </div>
                  <div>
                    <dt>Reference</dt>
                    <dd>{selectedReceipt.paymentReference || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>{formatMoney(selectedReceipt.total, selectedReceipt.currency)}</dd>
                  </div>
                </dl>
              </article>
              <article className="stroane-receipts__detail-card">
                <h3>Customer</h3>
                <dl>
                  <div>
                    <dt>Name</dt>
                    <dd>{selectedReceipt.customerName}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{selectedReceipt.customerEmail}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{selectedReceipt.order?.customer.phone || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Address</dt>
                    <dd>{selectedReceipt.order?.customer.deliveryAddress || "Not recorded"}</dd>
                  </div>
                </dl>
              </article>
            </section>

            <section className="stroane-receipts__items">
              <h3>Receipt items</h3>
              <div className="stroane-receipts__items-list">
                {(selectedReceipt.order?.items || []).map((item) => (
                  <div key={item.id} className="stroane-receipts__item-row">
                    <span>
                      <strong>{item.productName}</strong>
                      <small>{item.sku || "No SKU"}</small>
                    </span>
                    <span>{item.quantity}</span>
                    <span>{formatMoney(item.lineTotal, item.currency)}</span>
                  </div>
                ))}
                {!selectedReceipt.order?.items?.length ? (
                  <p className="stroane-receipts__empty">No receipt items recorded.</p>
                ) : null}
              </div>
            </section>

            <div className="stroane-receipts__detail-actions">
              <ERPSecondaryAction
                type="button"
                icon={<HiOutlineDownload />}
                onClick={() => void handleDownloadReceipt(selectedReceipt)}
                loading={receiptAction === `download:${selectedReceipt.id}`}
              >
                Download
              </ERPSecondaryAction>
              <ERPPrimaryAction
                type="button"
                icon={<HiOutlineMail />}
                onClick={() => void handleResendReceipt(selectedReceipt)}
                loading={receiptAction === `resend:${selectedReceipt.id}`}
                disabled={!canManageReceipts}
              >
                Resend receipt
              </ERPPrimaryAction>
            </div>
          </div>
        ) : null}
      </ERPModal>
    </div>
  );
};

export default ReceiptManagement;
