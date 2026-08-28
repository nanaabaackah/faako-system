import { AppIcon } from "/src/components/Icon/Icon";
import { faMinus, faPlus } from "/src/icons/iconSet";

export default function WaterRestockCard({
  onSubmit,
  quickQuantities,
  restockQuantity,
  quantityValue,
  unitCostValue,
  onSelectQuickQuantity,
  onAdjustQuantity,
  onQuantityChange,
  onUnitCostChange,
  supplierLabel,
  restockCost,
  saving,
  loading,
  formatCurrency,
  retailPriceLabel,
  retailPriceAvailable,
  canManageWaterPricing,
}) {
  return (
    <section className="water-module-network-grid">
      <article className="admin-card water-module-card water-module-card--full bubble-card">
        <div className="water-module-card-head">
          <div>
            <h3>Pricing & Restock</h3>
          </div>
        </div>
        <div className="water-module-form">
          <div className="water-module-sale-block">
            <div className="water-module-inline-summary">
              <span>Current scheduled retail price</span>
              <strong>{retailPriceAvailable ? retailPriceLabel : "Not configured"}</strong>
            </div>
            <p className="water-module-inline-note">
              New Water orders use the active effective-dated price from Commercial Settings.
            </p>
          </div>
          {canManageWaterPricing ? (
            <a className="admin-secondary water-module-sale-submit" href="/admin/settings?tab=config">
              Manage scheduled prices
            </a>
          ) : null}
        </div>
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
                aria-label="Restock quantity"
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
            <label>
              <span className="water-module-field-label">Cost price per pack (GHS)</span>
              <input
                aria-label="Restock cost price per pack"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={unitCostValue}
                onChange={(event) => onUnitCostChange(event.target.value)}
                placeholder="0.00"
                required
              />
            </label>
          </div>
          <div className="water-module-inline-summary">
            <span>{supplierLabel}</span>
            <strong>Total cost: {formatCurrency(restockCost)}</strong>
          </div>
          <p className="water-module-inline-note">
            Water cost of goods and profit use the cost recorded for each restock period.
          </p>
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
