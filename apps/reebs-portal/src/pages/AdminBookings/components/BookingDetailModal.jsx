import React from "react";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faCalendarCheck,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faFileInvoice,
  faPen,
  faTruck,
  faXmark,
} from "/src/icons/iconSet";

function BookingDetailModal({
  booking,
  detailCustomer,
  detailDelivery,
  detailDocument,
  detailExpenses,
  detailExpenseTotal,
  detailItems,
  productMap,
  isMobileView,
  canAccessInvoicing,
  canGoPrevDetail,
  canGoNextDetail,
  statusUpdatingId,
  goPrevDetail,
  goNextDetail,
  updateBookingStatus,
  viewInvoice,
  viewDelivery,
  openEdit,
  closeDetail,
  viewCustomer,
  viewExpenses,
  formatDate,
  formatDateTime,
  formatBookingTimeWindow,
  getDeliveryStatusLabel,
  getDeliveryMeta,
  getBookingDocumentTitle,
  getBookingDocumentStatus,
  formatMoney,
  formatUser,
  formatAttendantsNeeded,
  normalizeStatus,
}) {
  if (!booking) return null;

  return (
    <div className="customers-modal bookings-modal bookings-modal--detail" role="dialog" aria-modal="true">
      <div className="customers-modal-panel bookings-detail-panel">
        <header className="bookings-detail-header">
          <div className="bookings-detail-copy">
            <p className="customers-eyebrow">Booking #{booking.id}</p>
            <h2>{booking.customerName || "Customer"}</h2>
            <p className="bookings-card-meta">
              {formatDate(booking.eventDate)} · {formatBookingTimeWindow(booking)}
            </p>
          </div>

          <div className="booking-detail-actions">
            {isMobileView ? (
              <button
                type="button"
                className="detail-nav-button"
                onClick={goPrevDetail}
                disabled={!canGoPrevDetail}
                aria-label="Previous booking"
              >
                <AppIcon icon={faChevronLeft} />
              </button>
            ) : (
              <div className="detail-nav">
                <button
                  type="button"
                  className="detail-nav-button"
                  onClick={goPrevDetail}
                  disabled={!canGoPrevDetail}
                  aria-label="Previous booking"
                >
                  <AppIcon icon={faChevronLeft} />
                </button>
                <button
                  type="button"
                  className="detail-nav-button"
                  onClick={goNextDetail}
                  disabled={!canGoNextDetail}
                  aria-label="Next booking"
                >
                  <AppIcon icon={faChevronRight} />
                </button>
              </div>
            )}

            <button
              type="button"
              className={`bookings-action${isMobileView ? " bookings-action--icon" : ""}`}
              onClick={() => updateBookingStatus(booking, "confirmed")}
              disabled={statusUpdatingId === booking.id || normalizeStatus(booking.status) !== "pending"}
              aria-label="Accept booking"
              title="Accept booking"
            >
              {isMobileView ? (
                <AppIcon icon={faCalendarCheck} />
              ) : (
                statusUpdatingId === booking.id ? "Updating..." : "Accept"
              )}
            </button>
            <button
              type="button"
              className={`bookings-action bookings-action-primary${isMobileView ? " bookings-action--icon" : ""}`}
              onClick={() => updateBookingStatus(booking, "completed")}
              disabled={statusUpdatingId === booking.id || normalizeStatus(booking.status) !== "confirmed"}
              aria-label="Complete booking"
              title="Complete booking"
            >
              {isMobileView ? (
                <AppIcon icon={faCircleCheck} />
              ) : (
                statusUpdatingId === booking.id ? "Updating..." : "Complete"
              )}
            </button>
            {canAccessInvoicing && (
              <button
                type="button"
                className={`bookings-edit${isMobileView ? " bookings-edit--icon" : ""}`}
                onClick={() => viewInvoice(booking)}
                aria-label="Open invoice"
                title="Open invoice"
              >
                <AppIcon icon={faFileInvoice} />
                {!isMobileView ? "Invoice" : null}
              </button>
            )}
            <button
              type="button"
              className={`bookings-edit${isMobileView ? " bookings-edit--icon" : ""}`}
              onClick={() => viewDelivery(booking)}
              aria-label="Open delivery"
              title="Open delivery"
            >
              <AppIcon icon={faTruck} />
              {!isMobileView ? "Delivery" : null}
            </button>
            {isMobileView ? (
              <button
                type="button"
                className="detail-nav-button"
                onClick={goNextDetail}
                disabled={!canGoNextDetail}
                aria-label="Next booking"
              >
                <AppIcon icon={faChevronRight} />
              </button>
            ) : null}
            {!isMobileView && (
              <button
                type="button"
                className="bookings-edit"
                onClick={() => {
                  openEdit(booking);
                  closeDetail();
                }}
              >
                <AppIcon icon={faPen} />
                Edit
              </button>
            )}
            <button
              type="button"
              className="customers-modal-close bookings-modal-close"
              onClick={closeDetail}
              aria-label="Close"
            >
              <AppIcon icon={faXmark} />
            </button>
          </div>
        </header>

        <div className="bookings-detail-summary">
          <button
            type="button"
            className="bubble-card bookings-detail-summary-card bookings-detail-summary-card--link"
            onClick={() => viewCustomer(booking)}
          >
            <p className="bookings-summary-label">Customer</p>
            <strong className="bookings-detail-summary-title">
              {detailCustomer?.name || booking.customerName || "Customer"}
            </strong>
            <span>{booking.customerPhone || detailCustomer?.phone || "No phone"}</span>
            <span>{booking.customerEmail || detailCustomer?.email || "No email"}</span>
          </button>

          <button
            type="button"
            className="bubble-card bookings-detail-summary-card bookings-detail-summary-card--link"
            onClick={() => viewDelivery(booking)}
          >
            <p className="bookings-summary-label">Delivery</p>
            <strong className="bookings-detail-summary-title">{getDeliveryStatusLabel(detailDelivery)}</strong>
            <span>{getDeliveryMeta(detailDelivery)}</span>
            <span>{detailDelivery?.eta || detailDelivery?.routeGroup || "No route set"}</span>
          </button>

          <button
            type="button"
            className="bubble-card bookings-detail-summary-card bookings-detail-summary-card--link"
            onClick={() => viewInvoice(booking)}
            disabled={!canAccessInvoicing}
          >
            <p className="bookings-summary-label">Invoice</p>
            <strong className="bookings-detail-summary-title">{getBookingDocumentTitle(detailDocument)}</strong>
            <span>{getBookingDocumentStatus(detailDocument)}</span>
            <span>{detailDocument?.sentAt ? formatDateTime(detailDocument.sentAt) : "Open in invoicing"}</span>
          </button>

          <button
            type="button"
            className="bubble-card bookings-detail-summary-card bookings-detail-summary-card--link"
            onClick={() => viewExpenses(booking)}
          >
            <p className="bookings-summary-label">Spend</p>
            <strong className="bookings-detail-summary-title">{formatMoney(detailExpenseTotal, "GHS")}</strong>
            <span>{detailExpenses.length} linked</span>
            <span>{formatMoney((booking.totalAmount || 0) / 100, "GHS")} booked</span>
          </button>
        </div>

        <div className="bookings-detail-layout">
          <section className="glass-card bookings-detail-section">
            <div className="bookings-detail-section-head">
              <h3>Booking</h3>
              <span className={`bookings-pill ${booking.status || "pending"}`}>
                {booking.status || "pending"}
              </span>
            </div>
            <div className="bookings-detail-meta-grid">
              <div className="bookings-detail-meta">
                <span>Event</span>
                <strong>{formatDate(booking.eventDate)}</strong>
                <small>{formatBookingTimeWindow(booking)}</small>
              </div>
              <div className="bookings-detail-meta">
                <span>Assigned</span>
                <strong>{formatUser(booking.assignedUserName)}</strong>
                <small>{formatUser(booking.updatedByName)}</small>
              </div>
              <div className="bookings-detail-meta">
                <span>Venue</span>
                <strong>{booking.venueAddress || "-"}</strong>
                <small>Delivery address</small>
              </div>
              <div className="bookings-detail-meta">
                <span>Updated</span>
                <strong>{formatDateTime(booking.lastModifiedAt || booking.updatedAt)}</strong>
                <small>{detailItems.length} items in booking</small>
              </div>
            </div>
          </section>

          <section className="glass-card bookings-detail-section">
            <div className="bookings-detail-section-head">
              <h3>Location</h3>
            </div>
            {booking.venueAddress ? (
              <div className="booking-map">
                <iframe
                  title="Booking location"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(booking.venueAddress)}&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : (
              <p className="bookings-muted">No address provided.</p>
            )}
          </section>
        </div>

        <div className="bookings-detail-layout bookings-detail-layout--secondary">
          <section className="glass-card bookings-detail-section">
            <div className="bookings-detail-section-head">
              <h3>Rental items</h3>
              <span>{detailItems.length}</span>
            </div>
            {detailItems.length > 0 ? (
              <ul className="booking-detail-list">
                {detailItems.map((item) => {
                  const product = productMap.get(Number(item.productId));
                  const productName = item.productName || product?.name || `Product ${item.productId}`;
                  const imageSrc = item.productImage || product?.imageUrl || product?.image || "";
                  const fallbackLabel = productName.slice(0, 1).toUpperCase();
                  const attendantsLabel = formatAttendantsNeeded(product?.attendantsNeeded);

                  return (
                    <li key={item._key || `${booking.id}-${item.productId}`}>
                      <div className="booking-detail-item">
                        {imageSrc ? (
                          <img
                            className="booking-detail-item-image"
                            src={imageSrc}
                            alt={productName}
                            loading="lazy"
                          />
                        ) : (
                          <div className="booking-detail-item-fallback" aria-hidden="true">
                            {fallbackLabel}
                          </div>
                        )}
                        <div className="bookings-cell-stack bookings-cell-stack--primary">
                          <strong>{productName}</strong>
                          <span>{attendantsLabel}</span>
                        </div>
                      </div>
                      <div className="booking-detail-metrics">
                        <strong>x{item.quantity}</strong>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="bookings-muted">No items listed.</p>
            )}
          </section>

          <section className="glass-card bookings-detail-section">
            <div className="bookings-detail-section-head">
              <h3>Expenses</h3>
              <span>{formatMoney(detailExpenseTotal, "GHS")}</span>
            </div>
            {detailExpenses.length > 0 ? (
              <ul className="bookings-expense-list">
                {detailExpenses.map((expense) => (
                  <li key={expense.id || `${booking.id}-${expense.name}-${expense.amount}`}>
                    <div className="bookings-cell-stack bookings-cell-stack--primary">
                      <strong>{expense.name || expense.item || expense.category || "Expense"}</strong>
                      <span>{formatDate(expense.expenseDate || expense.createdAt)}</span>
                    </div>
                    <div className="booking-detail-metrics">
                      <strong>{formatMoney(Number(expense.amount || 0) / 100, "GHS")}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bookings-muted">No expenses linked.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default React.memo(BookingDetailModal);
