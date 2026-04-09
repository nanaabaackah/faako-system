import { DateField } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import { faMinus, faPlus, faReceipt } from "/src/icons/iconSet";
import WaterCustomerPicker from "./WaterCustomerPicker";

export default function WaterOrderFormCard({
  onSubmit,
  saleForm,
  setSaleForm,
  saleCustomerLabel,
  customerPickerProps,
  unitPriceInputValue,
  salePreview,
  saleRateLabel,
  salePaymentLabel,
  saleDiscountType,
  salePaymentOptions,
  saleDiscountOptions,
  onQuantityChange,
  onAdjustQuantity,
  onDiscountChange,
  formatCurrency,
  saving,
  loading,
}) {
  return (
    <section className="water-module-order-section">
      <article className="admin-card water-module-card">
        <div className="water-module-card-head">
          <div>
            <h3>New order</h3>
          </div>
        </div>
        <form className="water-module-form water-module-order-form" onSubmit={onSubmit}>
          <div className="water-module-sale-block water-module-order-form-block water-module-order-form-block--customer">
            <label>
              <div className="water-module-inline-head">
                <span className="water-module-field-label">{saleCustomerLabel}</span>
              </div>
              <WaterCustomerPicker {...customerPickerProps} required />
            </label>
            <div className="water-module-sale-inline-grid">
              <label>
                <div className="water-module-inline-head">
                  <span className="water-module-field-label">Phone Number (Optional)</span>
                </div>
                <input
                  type="tel"
                  inputMode="tel"
                  value={saleForm.customerPhone}
                  onChange={(event) =>
                    setSaleForm((prev) => ({ ...prev, customerPhone: event.target.value }))
                  }
                  placeholder="024 000 0000"
                />
              </label>
              <label>
                <div className="water-module-inline-head">
                  <span className="water-module-field-label">Date</span>
                </div>
                <DateField
                  value={saleForm.date}
                  onChangeValue={(nextValue) => setSaleForm((prev) => ({ ...prev, date: nextValue }))}
                  required
                  ariaLabel="Sale date"
                />
              </label>
            </div>
          </div>

          <div className="water-module-order-form-columns">
            <div className="water-module-order-form-column">
              <div className="water-module-sale-block water-module-order-form-block">
                <span className="water-module-field-label">Customer type</span>
                <div className="water-module-toggle-row" role="radiogroup" aria-label="Customer type">
                  <button
                    type="button"
                    className={`water-module-toggle-btn ${saleForm.saleChannel === "retail" ? "is-active" : ""}`}
                    onClick={() => setSaleForm((prev) => ({ ...prev, saleChannel: "retail" }))}
                    aria-pressed={saleForm.saleChannel === "retail"}
                  >
                    Retail
                  </button>
                  <button
                    type="button"
                    className={`water-module-toggle-btn ${saleForm.saleChannel === "company" ? "is-active" : ""}`}
                    onClick={() => setSaleForm((prev) => ({ ...prev, saleChannel: "company" }))}
                    aria-pressed={saleForm.saleChannel === "company"}
                  >
                    Company
                  </button>
                </div>
              </div>

              <div className="water-module-sale-block water-module-order-form-block">
                <div className="water-module-inline-head">
                  <span className="water-module-field-label">Payment</span>
                </div>
                <div className="water-module-quick-actions" role="radiogroup" aria-label="Payment method">
                  {salePaymentOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`water-module-quick-btn ${
                        saleForm.paymentMethod === option.value ? "is-active" : ""
                      }`}
                      onClick={() => setSaleForm((prev) => ({ ...prev, paymentMethod: option.value }))}
                      aria-pressed={saleForm.paymentMethod === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="water-module-order-form-column water-module-order-form-column--divided">
              <div className="water-module-sale-block water-module-order-form-block">
                <div className="water-module-inline-head">
                  <span className="water-module-field-label">Quantity</span>
                </div>
                <div className="water-module-stepper" aria-label="Sale quantity control">
                  <button
                    type="button"
                    className="water-module-stepper-btn"
                    onClick={() => onAdjustQuantity(-1)}
                    aria-label="Reduce quantity"
                  >
                    <AppIcon icon={faMinus} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={saleForm.quantity}
                    onChange={(event) => onQuantityChange(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="water-module-stepper-btn"
                    onClick={() => onAdjustQuantity(1)}
                    aria-label="Increase quantity"
                  >
                    <AppIcon icon={faPlus} />
                  </button>
                </div>
              </div>

              <div className="water-module-sale-block water-module-order-form-block">
                <label>
                  <span className="water-module-field-label">Price Per Pack</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={unitPriceInputValue}
                    onChange={(event) => setSaleForm((prev) => ({ ...prev, unitPrice: event.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </label>
                {salePreview.usesCustomUnitPrice ? (
                  <p className="water-module-inline-note">
                    Default {formatCurrency(salePreview.suggestedUnitPrice)}.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="water-module-sale-block water-module-order-form-block water-module-order-form-block--full">
            <div className="water-module-inline-head">
              <span className="water-module-field-label">Discount</span>
            </div>
            <div className="water-module-quick-actions" role="radiogroup" aria-label="Discount type">
              {saleDiscountOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`water-module-quick-btn ${saleDiscountType === option.value ? "is-active" : ""}`}
                  onClick={() =>
                    setSaleForm((prev) => ({
                      ...prev,
                      discountType: option.value,
                      discountValue: option.value === "none" ? "" : prev.discountValue,
                    }))
                  }
                  aria-pressed={saleDiscountType === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {saleDiscountType !== "none" ? (
              <label>
                {saleDiscountType === "amount" ? "Discount amount (GHS)" : "Discount percent"}
                <input
                  type="number"
                  min="0.01"
                  max={saleDiscountType === "percent" ? "99.99" : undefined}
                  step="0.01"
                  inputMode="decimal"
                  value={saleForm.discountValue}
                  onChange={(event) => onDiscountChange(event.target.value)}
                  placeholder={saleDiscountType === "amount" ? "0.00" : "5"}
                  required
                />
              </label>
            ) : null}
          </div>

          <div className="water-module-order-form-actions">
            <div className="water-module-order-form-summary">
              <div>
                <span>{saleRateLabel}</span>
                <strong>{formatCurrency(salePreview.unitPrice)}</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong>{salePaymentLabel}</strong>
              </div>
              <div>
                <span>Subtotal</span>
                <strong>{formatCurrency(salePreview.subtotal)}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatCurrency(salePreview.total)}</strong>
              </div>
              {salePreview.discountAmount > 0 ? (
                <div className="water-module-order-form-summary-item--full">
                  <span>Discount</span>
                  <strong>{formatCurrency(salePreview.discountAmount)}</strong>
                </div>
              ) : null}
            </div>

            <button type="submit" className="admin-primary water-module-sale-submit" disabled={saving || loading}>
              <AppIcon icon={faReceipt} /> {saving ? "Saving..." : `Record ${formatCurrency(salePreview.total)}`}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
