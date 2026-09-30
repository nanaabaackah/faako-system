import React from "react";
import { DateField, ERPFormNotice, SelectField } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  BookingExpensesSection,
  BookingPricingSection,
  BookingRentalItemsSection,
} from "./BookingDetailSections";
import {
  faCalendarCheck,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faFileInvoice,
  faLock,
  faPen,
  faTruck,
  faXmark,
} from "/src/icons/iconSet";

const parseDetailDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatFullDate = (value) => {
  const date = parseDetailDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

function BookingDetailModal({
  booking,
  detailEditing,
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
  closeInlineEdit,
  closeDetail,
  viewCustomer,
  editor,
  detailExpenseDraft,
  setDetailExpenseDraft,
  detailExpenseSaving,
  detailExpenseError,
  setDetailExpenseError,
  detailExpenseSuccess,
  setDetailExpenseSuccess,
  addDetailExpense,
  bookingLocked = false,
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

  const canOpenEdit = typeof openEdit === "function";
  const hasScheduledDelivery = Number.isFinite(Number(detailDelivery?.deliveryId));
  const {
    save,
    saveError,
    saving,
    form,
    setForm,
    customerMenuOpen,
    setCustomerMenuOpen,
    handleBookingCustomerInputChange,
    handleBookingCustomerInputKeyDown,
    filteredBookingCustomerOptions,
    typedBookingCustomerName,
    matchedTypedBookingCustomer,
    commitBookingCustomerInput,
    handleBookingCustomerChange,
    customerCreating,
    BookingCustomerPickerComponent,
    BOOKING_TIME_OPTIONS = [],
    BOOKING_EDITOR_STATUS_OPTIONS = [],
    assignedUserOptions = [],
    productQuery = "",
    setProductQuery,
    filteredProducts = [],
    addItem,
    formItems = [],
    getLineKey,
    getProductVariants,
    getVariantAvailableQty,
    formatVariantName,
    isVariantParent,
    updateItemPrice,
    updateItemQuantity,
    removeItem,
    bookingTotalCents = 0,
    bookingCurrency,
  } = editor || {};
  const CustomerPicker = BookingCustomerPickerComponent;
  const buildLineKey = getLineKey || ((productId, variantId = "") => `${productId}:${variantId || "standard"}`);
  const listVariants = getProductVariants || (() => []);
  const availableForVariant = getVariantAvailableQty || (() => 0);
  const formatVariant =
    formatVariantName
    || ((product, variant) =>
      [product?.name, variant?.variantName, variant?.variantNumber, variant?.color, variant?.size]
        .filter(Boolean)
        .join(" / "));
  const productIsVariantParent = isVariantParent || (() => false);
  const canInlineEdit = Boolean(detailEditing && form && setForm && save && CustomerPicker);
  const displayStatus = canInlineEdit ? form.status || booking.status || "pending" : booking.status || "pending";
  const displayAddress = canInlineEdit ? form.venueAddress : booking.venueAddress;
  const displayDate = canInlineEdit ? form.eventDate : booking.eventDate;
  const displayTimeBooking = canInlineEdit
    ? { ...booking, startTime: form.startTime, endTime: form.endTime }
    : booking;
  const assignedUserLabel = canInlineEdit
    ? assignedUserOptions.find((option) => String(option.value) === String(form.assignedUserId))?.label
      || formatUser(booking.assignedUserName)
    : formatUser(booking.assignedUserName);
  const editableItems = canInlineEdit ? formItems : detailItems;
  const formatBookingCurrency = typeof bookingCurrency === "function"
    ? bookingCurrency
    : (value) => formatMoney(value, "GHS");
  const invoiceStatus = getBookingDocumentStatus(detailDocument);
  const normalizedInvoiceStatus = String(invoiceStatus || "").trim().toLowerCase();
  const invoiceStatusClass =
    normalizedInvoiceStatus === "paid"
      ? "is-paid"
      : normalizedInvoiceStatus === "unpaid"
        ? "is-unpaid"
        : detailDocument
          ? "is-live"
          : "is-empty";

  const renderCustomerPicker = () => {
    if (!canInlineEdit) return null;
    return (
      <CustomerPicker
        value={form.customerName}
        onChange={(event) => handleBookingCustomerInputChange?.(event.target.value)}
        onClear={() => {
          setForm((prev) => ({
            ...prev,
            customerId: "",
            customerName: "",
          }));
          setCustomerMenuOpen?.(false);
        }}
        onFocus={() => setCustomerMenuOpen?.(true)}
        onBlur={() => {
          setTimeout(() => {
            setCustomerMenuOpen?.(false);
          }, 120);
        }}
        onKeyDown={handleBookingCustomerInputKeyDown}
        menuOpen={customerMenuOpen}
        options={filteredBookingCustomerOptions}
        selectedCustomerId={form.customerId}
        onSelectCustomer={handleBookingCustomerChange}
        typedCustomerName={typedBookingCustomerName}
        matchedTypedCustomer={matchedTypedBookingCustomer}
        onCreateCustomer={() => {
          void commitBookingCustomerInput?.();
        }}
        createBusy={customerCreating}
        disabled={saving}
      />
    );
  };

  const rentalItemsSectionProps = {
    booking,
    canInlineEdit,
    editableItems,
    detailItems,
    productMap,
    productQuery,
    setProductQuery,
    saving,
    filteredProducts,
    listVariants,
    productIsVariantParent,
    availableForVariant,
    addItem,
    formatVariant,
    formItems,
    buildLineKey,
    updateItemPrice,
    updateItemQuantity,
    removeItem,
    form,
    setForm,
    formatBookingCurrency,
    bookingTotalCents,
    formatAttendantsNeeded,
  };
  const expenseSectionProps = {
    booking,
    detailExpenses,
    detailExpenseTotal,
    detailExpenseDraft,
    setDetailExpenseDraft,
    detailExpenseSaving,
    detailExpenseError,
    setDetailExpenseError,
    detailExpenseSuccess,
    setDetailExpenseSuccess,
    addDetailExpense,
    bookingLocked,
    formatDate,
    formatMoney,
  };
  const pricingSectionProps = {
    booking,
    canInlineEdit,
    bookingTotalCents,
    detailExpenseTotal,
    formatBookingCurrency,
    formatMoney,
  };

  return (
    <div className="customers-modal bookings-modal bookings-modal--detail" role="dialog" aria-modal="true">
      <div className="customers-modal-panel bookings-detail-panel">
        <button
          type="button"
          className="customers-modal-close bookings-modal-close bookings-detail-close"
          onClick={closeDetail}
          aria-label="Close"
        >
          <AppIcon icon={faXmark} />
        </button>

        <header className="bookings-detail-header">
          <div className="bookings-detail-copy">
            <p className="customers-eyebrow">{booking.reference || `Booking #${booking.id}`}</p>
            <h2>{canInlineEdit ? form.customerName || "Customer" : booking.customerName || "Customer"}</h2>
            <p className="bookings-card-meta">
              {formatFullDate(displayDate)} · {formatBookingTimeWindow(displayTimeBooking)}
            </p>
          </div>

          <div className="booking-detail-actions">
            {!detailEditing && isMobileView ? (
              <button
                type="button"
                className="detail-nav-button"
                onClick={goPrevDetail}
                disabled={!canGoPrevDetail}
                aria-label="Previous booking"
              >
                <AppIcon icon={faChevronLeft} />
              </button>
            ) : !detailEditing ? (
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
            ) : null}

            {!detailEditing ? (
              <>
                <button
                  type="button"
                  className={`bookings-action${isMobileView ? " bookings-action--icon" : ""}`}
                  onClick={() => updateBookingStatus(booking, "confirmed")}
                  disabled={statusUpdatingId === booking.id || normalizeStatus(booking.status) !== "pending"}
                  aria-label="Accept booking"
                  title="Accept booking"
                >
                  {statusUpdatingId === booking.id ? (
                    "Updating..."
                  ) : (
                    <>
                      <AppIcon icon={faCalendarCheck} />
                      <span>Accept</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className={`bookings-edit${isMobileView ? " bookings-edit--icon" : ""}`}
                  onClick={() => updateBookingStatus(booking, "cancelled")}
                  disabled={
                    statusUpdatingId === booking.id
                    || !["pending", "confirmed"].includes(normalizeStatus(booking.status))
                  }
                  aria-label="Cancel booking"
                  title="Cancel booking and release its reservation"
                >
                  <AppIcon icon={faXmark} />
                  <span>Cancel booking</span>
                </button>
                <button
                  type="button"
                  className={`bookings-action bookings-action-primary${isMobileView ? " bookings-action--icon" : ""}`}
                  onClick={() => updateBookingStatus(booking, "completed")}
                  disabled={statusUpdatingId === booking.id || normalizeStatus(booking.status) !== "confirmed"}
                  aria-label="Complete booking"
                  title="Complete booking"
                >
                  {statusUpdatingId === booking.id ? (
                    "Updating..."
                  ) : (
                    <>
                      <AppIcon icon={faCircleCheck} />
                      <span>Complete</span>
                    </>
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
                    <span>Invoice</span>
                  </button>
                )}
                <button
                  type="button"
                  className={`bookings-edit${isMobileView ? " bookings-edit--icon" : ""}`}
                  onClick={() => viewDelivery(booking)}
                  disabled={bookingLocked}
                  aria-label="Open delivery"
                  title={bookingLocked ? "Completed bookings are locked" : "Open delivery"}
                >
                  <AppIcon icon={faTruck} />
                  <span>Delivery</span>
                </button>
              </>
            ) : null}

            {detailEditing ? (
              <div className="bookings-detail-top-edit-actions">
                <button
                  type="button"
                  className={`bookings-edit${isMobileView ? " bookings-edit--icon" : ""}`}
                  onClick={closeInlineEdit}
                  disabled={saving}
                  aria-label="Cancel booking edits"
                  title="Cancel booking edits"
                >
                  <AppIcon icon={faChevronLeft} />
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  form="booking-detail-inline-edit-form"
                  className="bookings-action bookings-action-primary bookings-detail-save-action"
                  disabled={!canInlineEdit || saving}
                  aria-label="Save booking edits"
                  title="Save booking edits"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            ) : canOpenEdit ? (
              <button
                type="button"
                className={`bookings-edit${isMobileView ? " bookings-edit--icon" : ""}`}
                onClick={() => openEdit(booking)}
                disabled={bookingLocked}
                aria-label={bookingLocked ? "Booking locked" : "Edit booking"}
                title={bookingLocked ? "Completed and cancelled bookings are locked" : "Edit booking"}
              >
                <AppIcon icon={bookingLocked ? faLock : faPen} />
                <span>{bookingLocked ? "Locked" : "Edit"}</span>
              </button>
            ) : null}
            {!detailEditing && isMobileView ? (
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
          </div>
        </header>

        {canInlineEdit ? (
          <>
            <form
              id="booking-detail-inline-edit-form"
              className="customers-form bookings-editor-form bookings-detail-edit-form"
              onSubmit={save}
            >
              <div className="bookings-detail-summary">
                <div className="bubble-card bookings-detail-summary-card bookings-detail-edit-card">
                  <p className="bookings-summary-label">Customer</p>
                  {renderCustomerPicker()}
                </div>

                <button
                  type="button"
                  className="bubble-card bookings-detail-summary-card bookings-detail-summary-card--link bookings-detail-summary-card--invoice"
                  onClick={() => viewInvoice(booking)}
                  disabled={!canAccessInvoicing}
                >
                  <p className="bookings-summary-label">Invoice</p>
                  <span className={`bookings-link-pill bookings-detail-invoice-status ${invoiceStatusClass}`}>
                    {invoiceStatus}
                  </span>
                  <strong className="bookings-detail-summary-title">{getBookingDocumentTitle(detailDocument)}</strong>
                  <span>{detailDocument?.sentAt ? formatDateTime(detailDocument.sentAt) : "Open in invoicing"}</span>
                </button>
              </div>

              <div className="bookings-detail-layout">
                <section className="glass-card bookings-detail-section">
                  <div className="bookings-detail-section-head">
                    <h3>Booking</h3>
                    <div className="bookings-detail-head-pills">
                      <span className={`bookings-pill ${displayStatus}`}>
                        {displayStatus}
                      </span>
                      {hasScheduledDelivery ? (
                        <button
                          type="button"
                          className="bookings-link-pill is-live bookings-detail-delivery-pill"
                          onClick={() => viewDelivery(booking)}
                          disabled={bookingLocked}
                          aria-label="Open delivery and assign driver"
                          title={
                            bookingLocked
                              ? "Completed bookings are locked"
                              : `Delivery ${getDeliveryStatusLabel(detailDelivery)} · ${getDeliveryMeta(detailDelivery)}`
                          }
                        >
                          <AppIcon icon={faTruck} />
                          Delivery {getDeliveryStatusLabel(detailDelivery)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="bookings-detail-meta-grid bookings-detail-edit-grid">
                    <DateField
                      label="Event date"
                      value={form.eventDate}
                      onChangeValue={(nextValue) => setForm((prev) => ({ ...prev, eventDate: nextValue }))}
                      fieldClassName="bookings-detail-edit-field bookings-date-field"
                      ariaLabel="Event date"
                      required
                    />
                    <DateField
                      label="Rental end date"
                      value={form.eventEndDate}
                      min={form.eventDate || undefined}
                      onChangeValue={(nextValue) => setForm((prev) => ({ ...prev, eventEndDate: nextValue }))}
                      fieldClassName="bookings-detail-edit-field bookings-date-field"
                      ariaLabel="Rental end date"
                    />
                    <SelectField
                      label="Start time"
                      value={form.startTime}
                      options={BOOKING_TIME_OPTIONS}
                      onChangeValue={(nextValue) => setForm((prev) => ({ ...prev, startTime: nextValue }))}
                      placeholder="Select start time"
                      ariaLabel="Booking start time"
                    />
                    <SelectField
                      label="End time"
                      value={form.endTime}
                      options={BOOKING_TIME_OPTIONS}
                      onChangeValue={(nextValue) => setForm((prev) => ({ ...prev, endTime: nextValue }))}
                      placeholder="Select end time"
                      ariaLabel="Booking end time"
                    />
                    <SelectField
                      label="Status"
                      value={form.status}
                      options={BOOKING_EDITOR_STATUS_OPTIONS}
                      onChangeValue={(nextValue) => setForm((prev) => ({ ...prev, status: nextValue }))}
                      ariaLabel="Booking status"
                    />
                    <SelectField
                      label="Assigned to"
                      value={form.assignedUserId}
                      options={assignedUserOptions}
                      onChangeValue={(nextValue) => setForm((prev) => ({ ...prev, assignedUserId: nextValue }))}
                      ariaLabel="Assigned user"
                    />
                    <label className="bookings-detail-edit-field bookings-detail-edit-field--full">
                      Venue address
                      <input
                        type="text"
                        value={form.venueAddress}
                        onChange={(event) => setForm((prev) => ({ ...prev, venueAddress: event.target.value }))}
                        placeholder="Venue / delivery address"
                        required
                      />
                    </label>
                    <label className="bookings-detail-edit-field">
                      GhanaPost GPS
                      <input
                        type="text"
                        value={form.venueGhanaPostGps}
                        onChange={(event) => setForm((prev) => ({ ...prev, venueGhanaPostGps: event.target.value }))}
                        placeholder="For example, GA-184-8164"
                      />
                    </label>
                    <label className="bookings-detail-edit-field bookings-detail-edit-field--full">
                      Customer notes
                      <textarea
                        rows="3"
                        value={form.customerNotes}
                        onChange={(event) => setForm((prev) => ({ ...prev, customerNotes: event.target.value }))}
                      />
                    </label>
                    <label className="bookings-detail-edit-field bookings-detail-edit-field--full">
                      Internal notes <span className="bookings-optional-label">Staff only</span>
                      <textarea
                        rows="3"
                        value={form.internalNotes}
                        onChange={(event) => setForm((prev) => ({ ...prev, internalNotes: event.target.value }))}
                      />
                    </label>
                  </div>
                </section>

                <section className="glass-card bookings-detail-section">
                  <div className="bookings-detail-section-head">
                    <h3>Location</h3>
                  </div>
                  {displayAddress ? (
                    <div className="booking-map">
                      <iframe
                        title="Booking location"
                        src={`https://www.google.com/maps?q=${encodeURIComponent(displayAddress)}&output=embed`}
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
                <BookingRentalItemsSection {...rentalItemsSectionProps} />
              </div>

              {saveError ? (
                <ERPFormNotice
                  tone="danger"
                  title="Booking not saved"
                  onDismiss={typeof editor?.setSaveError === "function" ? () => editor.setSaveError("") : undefined}
                >
                  {saveError}
                </ERPFormNotice>
              ) : null}
            </form>

            <div className="bookings-detail-layout bookings-detail-layout--secondary bookings-detail-layout--financials">
              <BookingExpensesSection {...expenseSectionProps} />
              <BookingPricingSection {...pricingSectionProps} />
            </div>
          </>
        ) : (
          <>
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
                className="bubble-card bookings-detail-summary-card bookings-detail-summary-card--link bookings-detail-summary-card--invoice"
                onClick={() => viewInvoice(booking)}
                disabled={!canAccessInvoicing}
              >
                <p className="bookings-summary-label">Invoice</p>
                <span className={`bookings-link-pill bookings-detail-invoice-status ${invoiceStatusClass}`}>
                  {invoiceStatus}
                </span>
                <strong className="bookings-detail-summary-title">{getBookingDocumentTitle(detailDocument)}</strong>
                <span>{detailDocument?.sentAt ? formatDateTime(detailDocument.sentAt) : "Open in invoicing"}</span>
              </button>
            </div>

            <div className="bookings-detail-layout">
              <section className="glass-card bookings-detail-section">
                <div className="bookings-detail-section-head">
                  <h3>Booking</h3>
                  <div className="bookings-detail-head-pills">
                    <span className={`bookings-pill ${displayStatus}`}>
                      {displayStatus}
                    </span>
                    {hasScheduledDelivery ? (
                      <button
                        type="button"
                        className="bookings-link-pill is-live bookings-detail-delivery-pill"
                        onClick={() => viewDelivery(booking)}
                        disabled={bookingLocked}
                        aria-label="Open delivery and assign driver"
                        title={
                          bookingLocked
                            ? "Completed bookings are locked"
                            : `Delivery ${getDeliveryStatusLabel(detailDelivery)} · ${getDeliveryMeta(detailDelivery)}`
                        }
                      >
                        <AppIcon icon={faTruck} />
                        Delivery {getDeliveryStatusLabel(detailDelivery)}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="bookings-detail-meta-grid">
                  <div className="bookings-detail-meta">
                    <span>Event</span>
                    <strong>{formatFullDate(displayDate)}</strong>
                    <small>{formatBookingTimeWindow(displayTimeBooking)}</small>
                  </div>
                  <div className="bookings-detail-meta">
                    <span>Assigned To</span>
                    <strong>{assignedUserLabel}</strong>
                  </div>
                  <div className="bookings-detail-meta">
                    <span>Venue</span>
                    <strong>{displayAddress || "-"}</strong>
                    <small>{booking.venueGhanaPostGps || "Delivery address"}</small>
                  </div>
                  <div className="bookings-detail-meta">
                    <span>Rental end</span>
                    <strong>{formatFullDate(booking.eventEndDate || booking.eventDate)}</strong>
                    <small>Inclusive reservation window</small>
                  </div>
                  <div className="bookings-detail-meta">
                    <span>Updated</span>
                    <strong>{formatDateTime(booking.lastModifiedAt || booking.updatedAt)}</strong>
                    <small>{detailItems.length} items in booking</small>
                  </div>
                </div>
                {booking.customerNotes ? (
                  <div className="bookings-detail-note">
                    <strong>Customer notes</strong>
                    <p>{booking.customerNotes}</p>
                  </div>
                ) : null}
                {booking.internalNotes ? (
                  <div className="bookings-detail-note bookings-detail-note--internal">
                    <strong>Internal notes</strong>
                    <p>{booking.internalNotes}</p>
                  </div>
                ) : null}
              </section>

              <section className="glass-card bookings-detail-section">
                <div className="bookings-detail-section-head">
                  <h3>Location</h3>
                </div>
                {displayAddress ? (
                  <div className="booking-map">
                    <iframe
                      title="Booking location"
                      src={`https://www.google.com/maps?q=${encodeURIComponent(displayAddress)}&output=embed`}
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
              <BookingRentalItemsSection {...rentalItemsSectionProps} />
            </div>
            <div className="bookings-detail-layout bookings-detail-layout--secondary bookings-detail-layout--financials">
              <BookingExpensesSection {...expenseSectionProps} />
              <BookingPricingSection {...pricingSectionProps} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(BookingDetailModal);
