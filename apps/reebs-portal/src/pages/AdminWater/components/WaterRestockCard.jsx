import { AppIcon } from "/src/components/Icon/Icon";
import { faMinus, faPlus } from "/src/icons/iconSet";

export default function WaterRestockCard({
  onSubmit,
  quickQuantities,
  restockQuantity,
  quantityValue,
  onSelectQuickQuantity,
  onAdjustQuantity,
  onQuantityChange,
  supplierLabel,
  restockCost,
  saving,
  loading,
  formatCurrency,
  retailPriceInputValue,
  onRetailPriceChange,
  onRetailPriceSubmit,
  retailPriceLabel,
  retailPriceSaving,
  retailPriceLoading,
}) {
  const showRetailPriceControls = typeof retailPriceInputValue !== "undefined";

  return (
    <section className="water-module-network-grid">
      <article className="admin-card water-module-card water-module-card--full bubble-card">
        <div className="water-module-card-head">
          <div>
            <h3>{showRetailPriceControls ? "Pricing & Restock" : "Restock"}</h3>
          </div>
        </div>
        {showRetailPriceControls ? (
          <form className="water-module-form" onSubmit={onRetailPriceSubmit}>
            <div className="water-module-sale-block">
              <div className="water-module-inline-head">
                <span className="water-module-field-label">Retail price</span>
              </div>
              <label>
                <span className="water-module-field-label">Price per pack (GHS)</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={retailPriceInputValue}
                  onChange={onRetailPriceChange}
                  placeholder="0.00"
                  required
                />
              </label>
              <div className="water-module-inline-summary">
                <span>Current default</span>
                <strong>{retailPriceLabel}</strong>
              </div>
              <p className="water-module-inline-note">
                New retail orders use this price unless the order price is edited.
              </p>
            </div>
            <button
              type="submit"
              className="admin-secondary water-module-sale-submit"
              disabled={retailPriceSaving || retailPriceLoading}
            >
              {retailPriceSaving ? "Saving..." : "Save retail price"}
            </button>
          </form>
        ) : null}
        <form className="water-module-form" onSubmit={onSubmit}>
          <div className="water-module-sale-block">
            <div className="water-module-inline-head">
              <span className="water-module-field-label">Quantity</span>
            </div>
            <div className="water-module-quick-actions">
              {quickQuantities.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`water-module-quick-btn ${restockQuantity === value ? "is-active" : ""}`}
                  onClick={() => onSelectQuickQuantity(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="water-module-stepper" aria-label="Restock quantity control">
              <button
                type="button"
                className="water-module-stepper-btn"
                onClick={() => onAdjustQuantity(-1)}
                aria-label="Reduce restock quantity"
              >
                <AppIcon icon={faMinus} />
              </button>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={quantityValue}
                onChange={(event) => onQuantityChange(event.target.value)}
                required
              />
              <button
                type="button"
                className="water-module-stepper-btn"
                onClick={() => onAdjustQuantity(1)}
                aria-label="Increase restock quantity"
              >
                <AppIcon icon={faPlus} />
              </button>
            </div>
          </div>
          <div className="water-module-inline-summary">
            <span>{supplierLabel}</span>
            <strong>Cost: {formatCurrency(restockCost)}</strong>
          </div>
          <button type="submit" className="admin-primary water-module-sale-submit" disabled={saving || loading}>
            <AppIcon icon={faPlus} />{" "}
            {saving
              ? "Saving..."
              : restockQuantity > 0
                ? `Add ${restockQuantity} pack${restockQuantity === 1 ? "" : "s"}`
                : "Add stock"}
          </button>
        </form>
      </article>
    </section>
  );
}
