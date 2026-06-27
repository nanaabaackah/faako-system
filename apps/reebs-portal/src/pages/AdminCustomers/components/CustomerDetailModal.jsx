import React from "react";
import { AnimatedLoadingState, ERPFormNotice, SelectField } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import { faBoxArchive, faFloppyDisk, faXmark } from "/src/icons/iconSet";
import {
  centsToMoneyAmount,
  formatDate,
  formatMoney,
  getSegmentLabel,
} from "../crmShared";
import CustomerActivityList from "./CustomerActivityList";

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
  removingCustomerId,
  requestStatusSavingId,
  onClose,
  onSave,
  onArchive,
  onFormChange,
  onRequestStatusChange,
}) {
  if (!isOpen || !customer) return null;

  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal-panel crm-modal-panel crm-detail-panel">
        <header className="crm-modal-header crm-detail-header">
          <div>
            <p className="admin-eyebrow">Customer</p>
            <h2>{detailForm.name || customer.name || "Customer"}</h2>
            <div className="crm-detail-header-meta">
              <span className={`crm-pill is-${selectedSegment}`}>{getSegmentLabel(selectedSegment)}</span>
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
          <article className="bubble-card crm-detail-stat">
            <span>Retail</span>
            <strong>{formatMoney(selectedTotals.totalSpent || 0)}</strong>
          </article>
          <article className="bubble-card crm-detail-stat">
            <span>Rental</span>
            <strong>{formatMoney(selectedTotals.totalRented || 0)}</strong>
          </article>
        </section>

        <section className="glass-card crm-detail-editor">
          <div className="crm-detail-block-header">
            <h3>Edit customer</h3>
          </div>

          <form className="crm-form" onSubmit={onSave}>
            <div className="crm-field-grid">
              <label className="crm-field">
                <span>Name</span>
                <input
                  type="text"
                  value={detailForm.name}
                  onChange={(event) => onFormChange("name", event.target.value)}
                  required
                />
              </label>

              <label className="crm-field">
                <span>Phone</span>
                <input
                  type="tel"
                  value={detailForm.phone}
                  onChange={(event) => onFormChange("phone", event.target.value)}
                  placeholder="+233 ..."
                />
              </label>

              <label className="crm-field crm-field-full">
                <span>Email</span>
                <input
                  type="email"
                  value={detailForm.email}
                  onChange={(event) => onFormChange("email", event.target.value)}
                  placeholder="email@example.com"
                />
              </label>
            </div>

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
            renderValue={(order) => formatMoney(centsToMoneyAmount(order.total_with_delivery ?? order.total_amount))}
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
            renderValue={(booking) => formatMoney(centsToMoneyAmount(booking.totalAmount))}
          />

          <CustomerActivityList
            title="Planning requests"
            emptyText="No planning briefs yet."
            items={detail?.contactRequests?.slice(0, 6) || []}
            keyPrefix="request"
            renderMeta={(request) => ({
              title: request.topic || `Request #${request.id}`,
              subtitle: `${formatDate(request.createdAt)}${request.eventDate ? ` · Event ${formatDate(request.eventDate)}` : ""}`,
            })}
            renderValue={(request) => (
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
            )}
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
