import React from "react";
import { DateField, SelectField } from "@faako/ui";
import SearchField from "../../../components/SearchField/SearchField";
import { AppIcon } from "/src/components/Icon/Icon";
import { faXmark } from "/src/icons/iconSet";

function BookingEditorModal({
  open,
  editing,
  closeModal,
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
  BOOKING_TIME_OPTIONS,
  BOOKING_EDITOR_STATUS_OPTIONS,
  assignedUserOptions,
  productQuery,
  setProductQuery,
  filteredProducts,
  addItem,
  formItems,
  productMap,
  updateItemPrice,
  updateItemQuantity,
  removeItem,
  bookingTotalCents,
  bookingCurrency,
}) {
  if (!open) return null;
  const CustomerPicker = BookingCustomerPickerComponent;

  return (
    <div className="customers-modal bookings-modal bookings-modal--editor" role="dialog" aria-modal="true">
      <div className="customers-modal-panel bookings-editor-panel">
        <header className="bookings-editor-head">
          <div>
            <p className="customers-eyebrow">{editing ? "Edit" : "New"} booking</p>
            <h2>{editing ? "Update" : "Add"} booking</h2>
          </div>
          <button type="button" className="customers-modal-close bookings-modal-close" onClick={closeModal} aria-label="Close">
            <AppIcon icon={faXmark} />
          </button>
        </header>

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
              {filteredProducts.slice(0, 10).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="booking-item-add"
                  onClick={() => addItem(product)}
                >
                  {product.name}
                </button>
              ))}
            </div>

            {formItems.length > 0 && (
              <div className="booking-items-selected">
                {formItems.map((item) => {
                  const product = productMap.get(Number(item.productId));
                  return (
                    <div key={item.productId} className="booking-item-row">
                      <span>{product?.name || `Product ${item.productId}`}</span>
                      <div className="booking-item-controls">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price ?? ""}
                          onChange={(event) => updateItemPrice(item.productId, event.target.value)}
                          placeholder={product?.price ? (product.price / 100).toFixed(2) : "0.00"}
                          aria-label="Override price"
                        />
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) => updateItemQuantity(item.productId, event.target.value)}
                        />
                        <button type="button" onClick={() => removeItem(item.productId)}>
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

          {saveError && <p className="customers-error">{saveError}</p>}

          <div className="customers-form-actions">
            <button type="button" className="customers-secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="customers-primary" disabled={saving}>
              {saving ? "Saving..." : "Save booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default React.memo(BookingEditorModal);
