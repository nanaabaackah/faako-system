import { DateField, SelectField } from "@faako/ui";
import WaterCustomerPicker from "./WaterCustomerPicker";
import { AppIcon } from "/src/components/Icon/Icon";
import { faTrash, faXmark } from "/src/icons/iconSet";

export default function WaterOrderEditorModal({
  activeOrderId,
  activeOrder,
  orderForm,
  setOrderForm,
  orderPreview,
  orderError,
  customerPickerProps,
  closeOrderEditor,
  handleOrderSubmit,
  handleOrderDelete,
  handleOrderPaymentMethodChange,
  normalizeChannel,
  normalizeSalePaymentStatus,
  getSalePaymentStatusLabel,
  salePaymentOptions,
  orderStatusOptions,
  formatDateTime,
  formatCurrency,
  saving,
  loading,
}) {
  if (!activeOrderId || !orderForm) return null;

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="water-order-modal-title">
      <div className="admin-modal-panel water-order-modal water-order-editor-modal bubble-card">
        <header>
          <div>
            <p className="water-module-eyebrow">Edit order</p>
            <h2 id="water-order-modal-title">Order #{activeOrderId}</h2>
            <div className="water-order-modal-meta">
              <span
                className={`water-module-order-pill is-${normalizeSalePaymentStatus(
                  orderForm.paymentStatus,
                  orderForm.paymentMethod
                )}`}
              >
                {getSalePaymentStatusLabel(orderForm.paymentStatus, orderForm.paymentMethod)}
              </span>
              {activeOrder?.createdAt ? (
                <span className="admin-modal-meta">Created {formatDateTime(activeOrder.createdAt)}</span>
              ) : null}
              {orderForm.updatedAt ? (
                <span className="admin-modal-meta">
                  Edited {formatDateTime(orderForm.updatedAt)}
                  {orderForm.updatedByName ? ` by ${orderForm.updatedByName}` : ""}
                </span>
              ) : null}
            </div>
          </div>
          <button type="button" className="admin-close" onClick={closeOrderEditor} aria-label="Close">
            <AppIcon icon={faXmark} />
          </button>
        </header>

        <form className="water-module-form water-order-modal-form water-order-editor-form" onSubmit={handleOrderSubmit}>
          <div className="water-order-modal-grid">
            <label className="water-order-modal-field--wide">
              Customer
              <WaterCustomerPicker {...customerPickerProps} required />
            </label>
            <label>
              Phone
              <input
                type="tel"
                inputMode="tel"
                value={orderForm.customerPhone}
                onChange={(event) =>
                  setOrderForm((prev) => (prev ? { ...prev, customerPhone: event.target.value } : prev))
                }
                placeholder="024 000 0000"
              />
            </label>
            <label>
              Type
              <SelectField
                value={orderForm.saleChannel}
                onChangeValue={(nextValue) =>
                  setOrderForm((prev) =>
                    prev ? { ...prev, saleChannel: normalizeChannel(String(nextValue)) } : prev
                  )
                }
                ariaLabel="Order type"
              >
                <option value="retail">Retail</option>
                <option value="company">Company</option>
              </SelectField>
            </label>
            <label>
              Qty
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={orderForm.quantity}
                onChange={(event) =>
                  setOrderForm((prev) => (prev ? { ...prev, quantity: event.target.value } : prev))
                }
                required
              />
            </label>
            <label>
              Sale price
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={orderForm.unitPrice}
                onChange={(event) =>
                  setOrderForm((prev) => (prev ? { ...prev, unitPrice: event.target.value } : prev))
                }
                required
              />
            </label>
            <label>
              Payment
              <SelectField
                value={orderForm.paymentMethod}
                onChangeValue={(nextValue) => handleOrderPaymentMethodChange(String(nextValue))}
                ariaLabel="Payment method"
              >
                {salePaymentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              Status
              <SelectField
                value={orderForm.paymentStatus}
                onChangeValue={(nextValue) =>
                  setOrderForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          paymentStatus: normalizeSalePaymentStatus(String(nextValue), prev.paymentMethod),
                        }
                      : prev
                  )
                }
                ariaLabel="Payment status"
              >
                {orderStatusOptions
                  .filter((option) => option.value !== "all")
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </SelectField>
            </label>
            <label>
              Date
              <DateField
                value={orderForm.date}
                onChangeValue={(nextValue) =>
                  setOrderForm((prev) => (prev ? { ...prev, date: nextValue } : prev))
                }
                required
                ariaLabel="Order date"
              />
            </label>
            <label className="water-order-modal-field--wide">
              Notes
              <textarea
                rows="3"
                value={orderForm.notes}
                onChange={(event) =>
                  setOrderForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                }
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="water-order-modal-summary bubble-card">
            <div>
              <span>Reference</span>
              <strong>{orderForm.paymentReference || `WATER-${orderForm.id}`}</strong>
            </div>
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(orderPreview?.subtotal)}</strong>
            </div>
            {orderPreview?.discountAmount ? (
              <div>
                <span>Discount</span>
                <strong>{formatCurrency(orderPreview.discountAmount)}</strong>
              </div>
            ) : null}
            <div>
              <span>Total</span>
              <strong>{formatCurrency(orderPreview?.total)}</strong>
            </div>
          </div>

          {orderError ? <p className="water-module-feedback water-module-feedback--error">{orderError}</p> : null}

          <div className="water-order-modal-actions">
            <button
              type="button"
              className="admin-secondary water-order-delete-btn"
              onClick={(event) => handleOrderDelete(activeOrder, event)}
              disabled={saving || loading}
            >
              <AppIcon icon={faTrash} /> Archive
            </button>
            <button type="button" className="admin-secondary" onClick={closeOrderEditor}>
              Cancel
            </button>
            <button type="submit" className="admin-primary" disabled={saving || loading}>
              {saving ? "Saving..." : "Save order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
