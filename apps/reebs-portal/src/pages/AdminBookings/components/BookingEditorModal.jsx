import React from "react";
import { DateField, ERPFormNotice, SelectField } from "@faako/ui";
import SearchField from "../../../components/SearchField/SearchField";
import { AppIcon } from "/src/components/Icon/Icon";
import { faXmark } from "/src/icons/iconSet";

function BookingEditorModal({
  open,
  editing,
  closeModal,
  save,
  saveError,
  setSaveError,
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
  BOOKING_TIME_OPTIONS,
  BOOKING_EDITOR_STATUS_OPTIONS,
  assignedUserOptions,
  productQuery,
  setProductQuery,
  filteredProducts,
  addItem,
  formItems,
  productMap,
  getLineKey,
  getProductVariants,
  getVariantAvailableQty,
  formatVariantName,
  isVariantParent,
  updateItemPrice,
  updateItemQuantity,
  removeItem,
  bookingTotalCents,
  bookingCurrency,
  embedded = false,
  hideHeader = false,
}) {
  if (!open && !embedded) return null;
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

  const content = (
    <>
      {!hideHeader ? (
        <header className="bookings-editor-head">
          <div>
            <p className="customers-eyebrow">{editing ? "Edit" : "New"} booking</p>
            <h2>{editing ? "Update" : "Add"} booking</h2>
          </div>
          <button
            type="button"
            className="customers-modal-close bookings-modal-close"
            onClick={closeModal}
            aria-label="Close"
          >
            <AppIcon icon={faXmark} />
          </button>
        </header>
      ) : null}

      <form className="customers-form bookings-editor-form" onSubmit={save}>
        <label>
          Customer
          <CustomerPicker
            value={form.customerName}
            onChange={(event) => handleBookingCustomerInputChange(event.target.value)}
            onClear={() => {
              setForm((prev) => ({
                ...prev,
                customerId: "",
                customerName: "",
              }));
              setCustomerMenuOpen(false);
            }}
            onFocus={() => setCustomerMenuOpen(true)}
            onBlur={() => {
              setTimeout(() => {
                setCustomerMenuOpen(false);
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
              void commitBookingCustomerInput();
            }}
            createBusy={customerCreating}
            disabled={saving}
          />
        </label>

        <label>
          Venue address
          <input
            type="text"
            value={form.venueAddress}
            onChange={(event) => setForm((prev) => ({ ...prev, venueAddress: event.target.value }))}
            placeholder="Venue / delivery address"
            required
          />
        </label>

        <DateField
          label="Event date"
          value={form.eventDate}
          onChangeValue={(nextValue) => setForm((prev) => ({ ...prev, eventDate: nextValue }))}
          fieldClassName="bookings-date-field"
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

        <label>
          Add items
          <SearchField
            value={productQuery}
            onChange={(event) => setProductQuery(event.target.value)}
            onClear={() => setProductQuery("")}
            placeholder="Search rentals"
            aria-label="Search rentals"
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
                          onClick={() => addItem(product, variant)}
                          disabled={availableForVariant(variant) <= 0}
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
                  onClick={() => addItem(product)}
                >
                  {product.name}
                </button>
              );
            })}
          </div>

          {formItems.length > 0 && (
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
                        onChange={(event) => updateItemPrice(lineKey, event.target.value)}
                        placeholder={product?.price ? (product.price / 100).toFixed(2) : "0.00"}
                        aria-label="Override price"
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => updateItemQuantity(lineKey, event.target.value)}
                        aria-label={`${itemName} quantity`}
                      />
                      <button type="button" onClick={() => removeItem(lineKey)}>
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
                    />
                  </div>
                </div>
                <div className="booking-item-total-right">
                  <span>Total</span>
                  <strong>{bookingCurrency(bookingTotalCents / 100)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {saveError && (
          <ERPFormNotice
            tone="danger"
            title="Booking not saved"
            onDismiss={typeof setSaveError === "function" ? () => setSaveError("") : undefined}
          >
            {saveError}
          </ERPFormNotice>
        )}

        <div className="customers-form-actions">
          <button type="button" className="customers-secondary" onClick={closeModal} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="customers-primary" disabled={saving}>
            {saving ? "Saving..." : "Save booking"}
          </button>
        </div>
      </form>
    </>
  );

  if (embedded) {
    return <div className="bookings-editor-inline">{content}</div>;
  }

  return (
    <div className="customers-modal bookings-modal bookings-modal--editor" role="dialog" aria-modal="true">
      <div className="customers-modal-panel bookings-editor-panel">
        {content}
      </div>
    </div>
  );
}

export default React.memo(BookingEditorModal);
