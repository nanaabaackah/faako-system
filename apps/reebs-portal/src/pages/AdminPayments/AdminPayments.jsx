import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedLoadingState, SelectField } from "@faako/ui";
import { Link } from "react-router-dom";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import DocumentHead from "../../components/DocumentHead/DocumentHead";
import { InlineNotice } from "../../components/InlineNotice/InlineNotice";
import { AppIcon } from "../../components/Icon/Icon";
import SearchField from "../../components/SearchField/SearchField";
import TablePagination from "../../components/TablePagination/TablePagination";
import { faRotateRight } from "../../icons/iconSet";
import { formatCurrencyFromCents, formatDateTime, formatStatusLabel } from "../Orders/orderUi";
import "./AdminPayments.css";

const METHOD_OPTIONS = [
  { value: "all", label: "All methods" },
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "successful", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

const getStatusLabel = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (["successful", "confirmed", "paid"].includes(normalized)) return "Paid";
  return formatStatusLabel(normalized, "Pending");
};

const getRelatedRecordPath = (payment) => {
  const type = String(payment?.relatedRecord?.type || "").toUpperCase();
  const id = Number(payment?.relatedRecord?.id);
  if (type === "ORDER" && id > 0) return `/admin/orders/${id}`;
  if (type === "BOOKING" && id > 0) return `/admin/bookings?id=${id}`;
  if (type === "INVOICE") return "/admin/invoicing";
  return null;
};

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const closeButtonRef = useRef(null);
  const returnFocusRef = useRef(null);

  const loadPayments = useCallback(async ({ page = 1, signal } = {}) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "25",
        ...(searchQuery ? { q: searchQuery } : {}),
        ...(method !== "all" ? { method } : {}),
        ...(status !== "all" ? { status } : {}),
      });
      const response = await fetch(`/api/payments?${params.toString()}`, { signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Payments could not be loaded.");
      setPayments(Array.isArray(payload.items) ? payload.items : []);
      setPagination(payload.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 });
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message || "Payments could not be loaded.");
        setPayments([]);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [method, searchQuery, status]);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadPayments({ page: 1, signal: controller.signal });
    return () => controller.abort();
  }, [loadPayments]);

  useEffect(() => {
    if (!selected) return undefined;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus?.();
    };
  }, [selected]);

  const pageAmountCents = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amountCents || 0), 0),
    [payments]
  );
  const renderPaymentsPagination = (header = false) => (
    <TablePagination
      total={pagination.total}
      pageIndex={Math.max(0, pagination.page - 1)}
      pageSize={pagination.pageSize}
      pageCount={pagination.totalPages}
      onPrevious={() => loadPayments({ page: Math.max(1, pagination.page - 1) })}
      onNext={() => loadPayments({ page: Math.min(pagination.totalPages, pagination.page + 1) })}
      header={header}
      className="payments-table-pagination"
    />
  );

  return (
    <div className="admin-page payments-page">
      <DocumentHead title="REEBS Portal | Payments" robots="noindex,nofollow" />
      <div className="admin-shell payments-shell">
        <AdminBreadcrumb items={[{ label: "Payments" }]} />
        <AdminPageHeader
          className="payments-header"
          copyClassName="payments-header-copy"
          actionsClassName="admin-header-actions payments-header-actions"
          title="Payments"
          subtitle="Verified records and authorized manual collections for REEBS Core orders. Water remains in Water Business."
          actions={(
            <button
              type="button"
              className="admin-secondary payments-refresh"
              onClick={() => loadPayments({ page: pagination.page })}
              disabled={loading}
            >
              <AppIcon icon={faRotateRight} />
              Refresh
            </button>
          )}
        />

        <section className="glass-card payments-summary" aria-label="Payment results summary">
          <div>
            <span>Records</span>
            <strong>{pagination.total}</strong>
          </div>
          <div>
            <span>Visible amount</span>
            <strong>{formatCurrencyFromCents(pageAmountCents)}</strong>
          </div>
          <p>REEBS Core only · amounts are in GHS unless the source order says otherwise.</p>
        </section>

        <form
          className="glass-card payments-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            setSearchQuery(search.trim());
          }}
          role="search"
        >
          <label className="payments-search">
            <span>Search payments</span>
            <SearchField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              placeholder="Payment, provider, order, customer or phone"
              aria-label="Search payments"
            />
          </label>
          <label className="payments-filter">
            <span>Method</span>
            <SelectField value={method} onChange={(event) => setMethod(event.target.value)}>
              {METHOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
          </label>
          <label className="payments-filter">
            <span>Status</span>
            <SelectField value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
          </label>
          <button type="submit" className="admin-primary">Search</button>
        </form>

        {loading ? (
          <AnimatedLoadingState
            compact
            className="glass-card admin-module-loading"
            title="Loading payments"
            message="Preparing the payment register."
            variant="dashboard"
          />
        ) : null}
        {!loading && error ? (
          <InlineNotice tone="error" title="Payments unavailable" message={error} />
        ) : null}
        {!loading && !error && payments.length === 0 ? (
          <section className="glass-card payments-empty">
            <h2>No payments found</h2>
            <p>Try clearing the search or changing the filters.</p>
          </section>
        ) : null}

        {!loading && !error && payments.length > 0 ? (
          <section className="admin-table payments-results" aria-label="Payment register">
            <div className="admin-table-scroll payments-table-scroll">
              {renderPaymentsPagination(true)}
              <table className="payments-data-table">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Type / source</th>
                    <th>Customer</th>
                    <th>Related record</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="payments-amount">Amount</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td data-label="Payment"><strong>{payment.paymentReference}</strong></td>
                      <td data-label="Type / source">{payment.source === "MANUAL" ? "Manual" : "Provider"}</td>
                      <td data-label="Customer">{payment.customer?.name || "Customer"}</td>
                      <td data-label="Related record">{getRelatedRecordPath(payment) ? <Link to={getRelatedRecordPath(payment)}>{payment.relatedRecord?.reference || "Record"}</Link> : (payment.relatedRecord?.reference || "Record")}</td>
                      <td data-label="Method">{payment.method}</td>
                      <td data-label="Status"><span className="payments-status">{getStatusLabel(payment.status)}</span></td>
                      <td data-label="Date">{formatDateTime(payment.paidAt)}</td>
                      <td data-label="Amount" className="payments-amount">{formatCurrencyFromCents(payment.amountCents)}</td>
                      <td><button type="button" className="admin-secondary payments-detail-button" onClick={(event) => { returnFocusRef.current = event.currentTarget; setSelected(payment); }}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {renderPaymentsPagination()}
            </div>
          </section>
        ) : null}

      </div>

      {selected ? (
        <div className="payments-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="glass-card payments-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-detail-title">
            <div className="payments-dialog-header">
              <div><span>Payment</span><h2 id="payment-detail-title">{selected.paymentReference}</h2></div>
              <button ref={closeButtonRef} type="button" className="admin-secondary" onClick={() => setSelected(null)} aria-label="Close payment details">Close</button>
            </div>
            <dl className="payments-detail-list">
              <div><dt>Status</dt><dd>{getStatusLabel(selected.status)}</dd></div>
              <div><dt>Amount</dt><dd>{formatCurrencyFromCents(selected.amountCents)}</dd></div>
              <div><dt>Method</dt><dd>{selected.method}</dd></div>
              <div><dt>Source</dt><dd>{selected.source === "MANUAL" ? "Recorded manually" : "Online provider"}</dd></div>
              <div><dt>Verification</dt><dd>{formatStatusLabel(selected.verificationStatus, "Not verified")}</dd></div>
              <div><dt>Provider/network</dt><dd>{selected.provider || "Not applicable"}</dd></div>
              <div><dt>External reference</dt><dd>{selected.providerReference || "Not supplied"}</dd></div>
              <div><dt>Customer</dt><dd>{selected.customer?.name || "Customer"}</dd></div>
              <div><dt>Business scope</dt><dd>REEBS Core</dd></div>
              <div><dt>Date</dt><dd>{formatDateTime(selected.paidAt)}</dd></div>
            </dl>
            {getRelatedRecordPath(selected) ? <Link className="admin-primary payments-open-order" to={getRelatedRecordPath(selected)}>Open {selected.relatedRecord?.reference || "record"}</Link> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
