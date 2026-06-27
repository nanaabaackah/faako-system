import React from "react";
import { DateField, ERPFormNotice, SelectField } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import SearchField from "/src/components/SearchField/SearchField";
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
  faPlus,
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
  const expenseQuery = String(detailExpenseDraft?.query || "").trim().toLowerCase();
  const filteredExpenses = detailExpenses.filter((expense) => {
    if (!expenseQuery) return true;
    const haystack = [
      expense?.description,
      expense?.name,
      expense?.item,
      expense?.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(expenseQuery);
  });
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

  const renderRentalItemsSection = () => (
    <section className="glass-card bookings-detail-section">
      <div className="bookings-detail-section-head">
        <h3>Rental items</h3>
        <span>{editableItems.length}</span>
      </div>
      {canInlineEdit ? (
        <div className="bookings-detail-items-editor">
          <label className="bookings-expense-field">
            <span>Add items</span>
            <SearchField
              value={productQuery}
              onChange={(event) => setProductQuery?.(event.target.value)}
              onClear={() => setProductQuery?.("")}
              placeholder="Search rentals"
              aria-label="Search rentals"
              disabled={saving}
            />
          </label>
          <div className="booking-items-picker">
            <div className="booking-items-list">
              {filteredProducts.slice(0, 10).map((product) => {
                const variants = listVariants(product).filter((variant) => String(variant.status || "active") === "active");
                if (productIsVariantParent(product)) {
                  return (
                    <div key={product.id} className="booking-item-add booking-item-add--variants">
                      <strong>{product.name}</strong>
                      <div className="booking-item-variant-buttons">
                        {variants.map((variant) => (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => addItem?.(product, variant)}
                            disabled={saving || availableForVariant(variant) <= 0}
                          >
                            {formatVariant(product, variant).replace(`${product.name} / `, "")}
                            <small>{availableForVariant(variant)} left</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    key={product.id}
                    type="button"
                    className="booking-item-add"
                    onClick={() => addItem?.(product)}
                    disabled={saving}
                  >
                    {product.name}
                  </button>
                );
              })}
            </div>

            {formItems.length > 0 ? (
              <div className="booking-items-selected">
                {formItems.map((item) => {
                  const product = productMap.get(Number(item.productId));
                  const lineKey = buildLineKey(item.productId, item.variantId);
                  const itemName = item.variantLabel || item.productName || product?.name || `Product ${item.productId}`;
                  return (
                    <div key={lineKey} className="booking-item-row">
                      <span>{itemName}</span>
                      <div className="booking-item-controls">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price ?? ""}
                          onChange={(event) => updateItemPrice?.(lineKey, event.target.value)}
                          placeholder={product?.price ? (product.price / 100).toFixed(2) : "0.00"}
                          aria-label="Override price"
                          disabled={saving}
                        />
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) => updateItemQuantity?.(lineKey, event.target.value)}
                          aria-label="Quantity"
                          disabled={saving}
                        />
                        <button type="button" onClick={() => removeItem?.(lineKey)} disabled={saving}>
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="booking-item-total">
                  <div className="booking-item-total-left">
                    <span>Discount</span>
                    <div className="booking-discount-input">
                      <SelectField
                        value={form.discountType}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, discountType: event.target.value }))
                        }
                        ariaLabel="Discount type"
                        disabled={saving}
                      >
                        <option value="amount">Amount</option>
                        <option value="percent">Percent</option>
                      </SelectField>
                      <input
                        type="number"
                        min="0"
                        step={form.discountType === "percent" ? "1" : "0.01"}
                        value={form.discount}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, discount: event.target.value }))
                        }
                        placeholder={form.discountType === "percent" ? "0" : "0.00"}
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className="booking-item-total-right">
                    <span>Total</span>
                    <strong>{formatBookingCurrency(bookingTotalCents / 100)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <p className="bookings-muted">No rental items selected.</p>
            )}
          </div>
        </div>
      ) : detailItems.length > 0 ? (
        <ul className="booking-detail-list">
          {detailItems.map((item) => {
            const product = productMap.get(Number(item.productId));
            const productName = item.variantLabel || item.productName || product?.name || `Product ${item.productId}`;
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
  );

  // ADDED: Render combined total section showing booking + expenses breakdown
  const renderCombinedTotalSection = () => {
    const bookingItemsTotal = canInlineEdit ? bookingTotalCents / 100 : (booking?.totalAmount || 0) / 100;
    const expensesTotal = detailExpenseTotal || 0;
    const combinedTotal = bookingItemsTotal + expensesTotal;

    return (
      <section className="glass-card bookings-detail-section bookings-detail-combined-total">
        <div className="bookings-detail-section-head">
          <h3>Booking Summary</h3>
        </div>
        <div className="bookings-detail-summary-breakdown" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <span>Booking Items</span>
            <strong>{formatBookingCurrency(bookingItemsTotal)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <span>Expenses</span>
            <strong>{formatMoney(expensesTotal, "GHS")}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px", fontSize: "1.1em" }}>
            <span style={{ fontWeight: "600" }}>Full Total</span>
            <strong style={{ fontSize: "1.2em", color: "#4ade80" }}>{formatMoney(combinedTotal, "GHS")}</strong>
          </div>
        </div>
      </section>
    );
  };

  const renderExpensesSection = () => (
    <section className="glass-card bookings-detail-section">
      <div className="bookings-detail-section-head">
        <h3>Expenses</h3>
        <span>{formatMoney(detailExpenseTotal, "GHS")}</span>
      </div>
      <form className="bookings-expense-entry" onSubmit={addDetailExpense}>
        <label className="bookings-expense-field bookings-expense-field--search">
          <span>Expense</span>
          <SearchField
            value={detailExpenseDraft?.query || ""}
            onChange={(event) =>
              setDetailExpenseDraft((current) => ({ ...current, query: event.target.value }))
            }
            onClear={() => setDetailExpenseDraft((current) => ({ ...current, query: "" }))}
            placeholder="Fuel, setup, staff, extras"
            aria-label="Search or add expense"
            disabled={detailExpenseSaving}
          />
        </label>
        <label className="bookings-expense-field bookings-expense-field--amount">
          <span>Amount</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={detailExpenseDraft?.amount || ""}
            onChange={(event) =>
              setDetailExpenseDraft((current) => ({ ...current, amount: event.target.value }))
            }
            placeholder="0.00"
            disabled={detailExpenseSaving || bookingLocked}
          />
        </label>
        <DateField
          fieldClassName="bookings-expense-field bookings-expense-field--date"
          label="Date"
          value={detailExpenseDraft?.date || ""}
          onChange={(event) =>
            setDetailExpenseDraft((current) => ({ ...current, date: event.target.value }))
          }
          disabled={detailExpenseSaving || bookingLocked}
        />
        <button
          type="submit"
          className="bookings-primary"
          disabled={
            bookingLocked
            ||
            detailExpenseSaving
            || !String(detailExpenseDraft?.query || "").trim()
            || !String(detailExpenseDraft?.amount || "").trim()
            || !String(detailExpenseDraft?.date || "").trim()
          }
          title={bookingLocked ? "Completed bookings are locked" : "Add expense"}
        >
          {detailExpenseSaving ? (
            "Adding..."
          ) : (
            <>
              <AppIcon icon={faPlus} />
              <span>Add expense</span>
            </>
          )}
        </button>
      </form>
      {bookingLocked ? (
        <p className="bookings-inline-note">Completed bookings are locked. Existing expenses remain view-only.</p>
      ) : null}
      {detailExpenseError ? (
        <ERPFormNotice
          tone="danger"
          title="Expense not added"
          onDismiss={typeof setDetailExpenseError === "function" ? () => setDetailExpenseError("") : undefined}
        >
          {detailExpenseError}
        </ERPFormNotice>
      ) : null}
      {expenseQuery && detailExpenses.length > 0 ? (
        <p className="bookings-inline-note">
          Showing {filteredExpenses.length} of {detailExpenses.length} linked expenses.
        </p>
      ) : null}
      {filteredExpenses.length > 0 ? (
        <ul className="bookings-expense-list">
          {filteredExpenses.map((expense) => (
            <li key={expense.id || `${booking.id}-${expense.name}-${expense.amount}`}>
              <div className="bookings-cell-stack bookings-cell-stack--primary">
                <strong>{expense.description || expense.name || expense.item || expense.category || "Expense"}</strong>
                <span>
                  {expense.category || "Expense"} · {formatDate(expense.expenseDate || expense.createdAt || expense.date)}
                </span>
              </div>
              <div className="booking-detail-metrics">
                <strong>{formatMoney(Number(expense.amount || 0) / 100, "GHS")}</strong>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bookings-muted">
          {detailExpenses.length > 0 && expenseQuery ? "No expenses match this search." : "No expenses linked."}
        </p>
      )}
    </section>
  );

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
            <p className="customers-eyebrow">Booking #{booking.id}</p>
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
                <span>Previous</span>
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
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  className="detail-nav-button"
                  onClick={goNextDetail}
                  disabled={!canGoNextDetail}
                  aria-label="Next booking"
                >
                  <AppIcon icon={faChevronRight} />
                  <span>Next</span>
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
                title={bookingLocked ? "Completed bookings are locked" : "Edit booking"}
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
                <span>Next</span>
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
                {renderRentalItemsSection()}
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

            <div className="bookings-detail-layout bookings-detail-layout--secondary">
              {renderExpensesSection()}
              {renderCombinedTotalSection()}
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
              {renderRentalItemsSection()}
              {renderExpensesSection()}
              {renderCombinedTotalSection()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(BookingDetailModal);
