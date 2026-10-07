import { AppIcon } from "/src/components/Icon/Icon";
import { faMinus, faPlus } from "/src/icons/iconSet";
import PortalAction from "../../../components/PortalAction/PortalAction";

export default function WaterRestockCard({
  onSubmit,
  quickQuantities,
  restockQuantity,
  quantityValue,
  unitCostValue,
  onUnitCostChange,
  priceValues,
  onPriceChange,
  canViewCost,
  onSelectQuickQuantity,
  onAdjustQuantity,
  onQuantityChange,
  supplierLabel,
  restockCost,
  saving,
  loading,
  formatCurrency,
  canManageWaterPricing,
}) {
  return (
    <section className="water-module-network-grid">
      <article className="admin-card water-module-card water-module-card--full bubble-card">
        <div className="water-module-card-head">
          <div>
            <h3>Restock water</h3>
          </div>
        </div>
        {canManageWaterPricing ? <form className="water-module-form" onSubmit={onSubmit}>
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
            {canViewCost ? (
              <label>
                <span className="water-module-field-label">Purchase cost per pack (GHS)</span>
                <input
                  aria-label="Purchase cost per pack"
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
            ) : null}
            <div className="water-module-price-grid">
              {[
                ["retailPrice", "Retail Price"],
                ["companyPrice", "Company Price"],
                ["bulkPrice", "Bulk Price"],
              ].map(([field, label]) => (
                <label key={field}>
                  <span className="water-module-field-label">{label} (GHS)</span>
                  <input
                    aria-label={label}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={priceValues[field]}
                    onChange={(event) => onPriceChange(field, event.target.value)}
                    placeholder="0.00"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="water-module-inline-summary">
            <span>{supplierLabel}</span>
            {canViewCost ? (
              <strong>Total cost: {formatCurrency(restockCost)}</strong>
            ) : (
              <strong>{restockQuantity} packs</strong>
            )}
          </div>
          {canViewCost ? (
            <p className="water-module-inline-note">
            Purchase cost is tracked separately from the current selling prices.
            </p>
          ) : null}
          <PortalAction type="submit" className="admin-primary" action="add" icon={faPlus} disabled={saving || loading}
            label={saving
              ? "Saving..."
              : restockQuantity > 0
                ? `Add ${restockQuantity} pack${restockQuantity === 1 ? "" : "s"}`
                : "Add stock"}
          />
        </form> : (
          <p className="water-module-inline-note">An owner or admin manages Water stock and purchase costs.</p>
        )}
      </article>
    </section>
  );
}
