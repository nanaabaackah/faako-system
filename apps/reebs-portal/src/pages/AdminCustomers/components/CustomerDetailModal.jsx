import React from "react";
import { AnimatedLoadingState, ERPFormNotice, SelectField } from "@faako/ui";
import { Link } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import { faBoxArchive, faFloppyDisk, faXmark } from "/src/icons/iconSet";
import {
  centsToMoneyAmount,
  formatDate,
  formatMoney,
  getSegmentLabel,
} from "../crmShared";
import CustomerActivityList from "./CustomerActivityList";
import CustomerFormFields from "./CustomerFormFields";
import { useCustomerDialog } from "./useCustomerDialog";

const CONTACT_REQUEST_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "waiting_customer", label: "Waiting customer" },
  { value: "quoted", label: "Quoted" },
  { value: "converted", label: "Converted" },
  { value: "closed", label: "Closed" },
  { value: "spam", label: "Spam" },
];

export default function CustomerDetailModal({
  isOpen,
  customer,
  detailForm,
  detail,
  detailLoading,
  detailSaving,
  detailError,
  detailStatus,
  onDetailErrorClear,
  onDetailStatusClear,
  selectedSegment,
  selectedTotals,
  canViewFinancials,
  canMutateCustomers,
  removingCustomerId,
  requestStatusSavingId,
  onClose,
  onSave,
  onArchive,
  onFormChange,
  onRequestStatusChange,
}) {
  const panelRef = useCustomerDialog({ isOpen, onClose });
  if (!isOpen || !customer) return null;

  return (
    <div className="admin-modal">
      <div
        className="admin-modal-panel crm-modal-panel crm-detail-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-detail-title"
      >
        <header className="crm-modal-header crm-detail-header">
          <div>
            <h2 id="customer-detail-title">{detailForm.name || customer.name || "Customer"}</h2>
            <div className="crm-detail-header-meta">
              <span className={`crm-pill is-${selectedSegment}`}>{getSegmentLabel(selectedSegment)}</span>
              {customer.reference ? <span>{customer.reference}</span> : null}
              <span>{customer.customerType === "organization" ? "Organization" : "Individual"}</span>
              <span>{formatDate(customer.createdAt)}</span>
            </div>
          </div>
          <button type="button" className="admin-close" onClick={onClose} aria-label="Close">
            <AppIcon icon={faXmark} />
          </button>
        </header>

        {detailLoading ? (
          <AnimatedLoadingState
            compact
            className="glass-card admin-module-loading"
            title="Loading customer"
            message="Opening customer activity and contact requests."
            variant="detail"
          />
        ) : null}
        {detailError ? (
          <ERPFormNotice tone="danger" title="Customer unavailable" onDismiss={onDetailErrorClear}>
            {detailError}
          </ERPFormNotice>
        ) : null}
        {detailStatus ? (
          <ERPFormNotice tone="success" title="Customer updated" onDismiss={onDetailStatusClear}>
            {detailStatus}
          </ERPFormNotice>
        ) : null}

        <section className="crm-detail-stat-grid">
          <article className="bubble-card crm-detail-stat">
            <span>Orders</span>
            <strong>{selectedTotals.orders || 0}</strong>
          </article>
          <article className="bubble-card crm-detail-stat">
            <span>Bookings</span>
            <strong>{selectedTotals.bookings || 0}</strong>
          </article>
          {canViewFinancials ? (
            <>
              <article className="bubble-card crm-detail-stat">
                <span>Retail</span>
                <strong>{formatMoney(selectedTotals.totalSpent || 0)}</strong>
              </article>
              <article className="bubble-card crm-detail-stat">
                <span>Rental</span>
                <strong>{formatMoney(selectedTotals.totalRented || 0)}</strong>
              </article>
            </>
          ) : null}
        </section>

        <nav className="crm-detail-actions" aria-label="Customer actions">
          {canMutateCustomers ? (
            <>
              <Link className="admin-primary crm-button" to={`/admin/bookings?action=create&customerId=${customer.id}`}>
                Start booking
              </Link>
              <Link className="admin-secondary crm-button" to={`/admin/orders/new?customerId=${customer.id}`}>
                Start order
              </Link>
            </>
          ) : null}
          {customer.phone ? <a className="admin-secondary crm-button" href={`tel:${customer.phone}`}>Call</a> : null}
          {customer.email ? <a className="admin-secondary crm-button" href={`mailto:${customer.email}`}>Email</a> : null}
        </nav>

        {canMutateCustomers ? (
          <section className="glass-card crm-detail-editor">
            <div className="crm-detail-block-header">
              <h3>Edit customer</h3>
            </div>

            <form className="crm-form" onSubmit={onSave}>
              <CustomerFormFields
                form={detailForm}
                onChange={onFormChange}
                idPrefix={`customer-${customer.id}`}
                showInternalNotes
              />

              <div className="crm-modal-actions">
                <button
                  type="button"
                  className="admin-secondary crm-button crm-button-danger"
                  onClick={() => onArchive(customer)}
                  disabled={detailSaving || removingCustomerId === customer.id}
                >
                  <AppIcon icon={faBoxArchive} />
                  {removingCustomerId === customer.id ? "Archiving..." : "Archive"}
                </button>
                <button type="button" className="admin-secondary crm-button" onClick={onClose}>
                  Close
                </button>
                <button type="submit" className="admin-primary crm-button" disabled={detailSaving}>
                  <AppIcon icon={faFloppyDisk} />
                  {detailSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="glass-card crm-detail-editor crm-readonly-profile">
            <h3>Contact profile</h3>
            <p>{customer.contactPersonName || customer.name}</p>
            <p>{customer.phone || "No phone"} · {customer.email || "No email"}</p>
            <p>{[customer.addressLine1, customer.locality, customer.region].filter(Boolean).join(", ") || "No address saved"}</p>
            {customer.ghanaPostGps ? <p>GhanaPost GPS: {customer.ghanaPostGps}</p> : null}
          </section>
        )}

        <section className="crm-detail-grid">
          <CustomerActivityList
            title="Orders"
            emptyText="No orders yet."
            items={detail?.orders?.slice(0, 6) || []}
            keyPrefix="order"
            renderMeta={(order) => ({
              title: order.orderNumber || `Order #${order.id}`,
              subtitle: `${formatDate(order.orderDate)}${order.deliveryMethod ? ` · ${order.deliveryMethod}` : ""}`,
            })}
            renderValue={(order) => canViewFinancials
              ? formatMoney(centsToMoneyAmount(order.total_with_delivery ?? order.total_amount))
              : order.status || "-"}
          />

          <CustomerActivityList
            title="Bookings"
            emptyText="No bookings yet."
            items={detail?.bookings?.slice(0, 6) || []}
            keyPrefix="booking"
            renderMeta={(booking) => ({
              title: `Booking #${booking.id}`,
              subtitle: `${formatDate(booking.eventDate)}${booking.status ? ` · ${booking.status}` : ""}`,
            })}
            renderValue={(booking) => canViewFinancials
              ? formatMoney(centsToMoneyAmount(booking.totalAmount))
              : booking.status || "-"}
          />

          {detail?.permissions?.canViewFinancials ? (
            <CustomerActivityList
              title="Recent payments"
              emptyText="No order payments recorded."
              items={detail?.payments?.slice(0, 6) || []}
              keyPrefix="payment"
              renderMeta={(payment) => ({
                title: payment.transactionReference || `Payment #${payment.id}`,
                subtitle: `${formatDate(payment.paidAt)}${payment.method ? ` · ${String(payment.method).replaceAll("_", " ")}` : ""}`,
              })}
              renderValue={(payment) => formatMoney(centsToMoneyAmount(payment.amountCents))}
            />
          ) : null}

          {detail?.permissions?.canViewInvoices ? (
            <CustomerActivityList
              title="Invoices and receipts"
              emptyText="No linked Core invoices or receipts."
              items={detail?.invoices?.slice(0, 6) || []}
              keyPrefix="invoice"
              renderMeta={(invoice) => ({
                title: invoice.invoiceNumber || invoice.title || `Document #${invoice.id}`,
                subtitle: `${formatDate(invoice.issueDate)} · ${invoice.documentType || "invoice"}`,
              })}
              renderValue={(invoice) => invoice.paymentStatus || "-"}
            />
          ) : null}

          <CustomerActivityList
            title="Planning requests"
            emptyText="No planning briefs yet."
            items={detail?.contactRequests?.slice(0, 6) || []}
            keyPrefix="request"
            renderMeta={(request) => ({
              title: request.topic || `Request #${request.id}`,
              subtitle: `${formatDate(request.createdAt)}${request.eventDate ? ` · Event ${formatDate(request.eventDate)}` : ""}`,
            })}
            renderValue={(request) => canMutateCustomers ? (
              <SelectField
                value={request.status || "new"}
                onChange={(event) => onRequestStatusChange(request, event.target.value)}
                ariaLabel={`Update request ${request.id} status`}
                disabled={requestStatusSavingId === request.id}
              >
                {CONTACT_REQUEST_STATUS_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            ) : request.status || "-"}
          />

          <CustomerActivityList
            title="Follow-up"
            emptyText="No follow-up activity yet."
            items={detail?.activities?.slice(0, 6) || []}
            keyPrefix="activity"
            renderMeta={(activity) => ({
              title: activity.title || activity.type || `Activity #${activity.id}`,
              subtitle: activity.dueAt ? `Due ${formatDate(activity.dueAt)}` : formatDate(activity.createdAt),
            })}
            renderValue={(activity) => activity.status || "-"}
          />
        </section>
      </div>
    </div>
  );
}
