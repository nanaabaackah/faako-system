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
}) {
  return (
    <section className="water-module-network-grid">
      <article className="admin-card water-module-card water-module-card--full bubble-card">
        <div className="water-module-card-head">
          <div>
            <h3>Restock</h3>
          </div>
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
