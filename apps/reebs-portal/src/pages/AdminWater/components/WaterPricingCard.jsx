import { InlineNotice } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import { faMoneyCheckDollar } from "/src/icons/iconSet";

export default function WaterPricingCard({
  product,
  permissions,
  pricingForm,
  setPricingForm,
  onSubmit,
  saving,
  loading,
  formatCurrency,
  compact = false,
}) {
  const pricing = product?.pricing || {};
  const pricingConfigured = Boolean(product?.pricingConfigured);
  const updateField = (field) => (event) =>
    setPricingForm((current) => ({ ...current, [field]: event.target.value }));

  const Root = compact ? "div" : "section";

  return (
    <Root
      className={compact
        ? "water-module-pricing-panel"
        : "water-module-hero water-module-pricing-card bubble-card"}
      aria-labelledby="water-pricing-title"
    >
      <div className="water-module-hero-copy">
        <p className="water-module-eyebrow">Water product pricing</p>
        {compact ? (
          <h4 id="water-pricing-title">{product?.name || "Water product"}</h4>
        ) : (
          <h2 id="water-pricing-title">{product?.name || "Water product"}</h2>
        )}
        {!compact ? (
          <p>
            These rates apply to new Water orders. Existing order prices and cost snapshots stay unchanged.
          </p>
        ) : null}
        {!pricingConfigured ? (
          <InlineNotice
            tone="warning"
            compact
            title="Selling price required"
            message="New Water orders are blocked until all selling prices are configured."
          />
        ) : null}
        {permissions?.canViewCost && !Number(product?.purchaseCost) ? (
          <InlineNotice
            tone="warning"
            compact
            title="Cost price missing"
            message="Sales can continue, but profitability will remain unavailable until a cost price is saved."
          />
        ) : null}
      </div>

      {permissions?.canManagePricing ? (
        <form className="water-module-form water-module-pricing-form" onSubmit={onSubmit}>
          <label className="water-module-pricing-name">
            Product name
            <input
              type="text"
              value={pricingForm.productName}
              onChange={updateField("productName")}
              required
            />
          </label>
          <div className="water-module-price-grid">
            <label>
              Retail price (GHS)
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={pricingForm.retailSinglePrice}
                onChange={updateField("retailSinglePrice")}
                required
              />
            </label>
            <label>
              Bulk price (GHS)
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={pricingForm.retailBulkPrice}
                onChange={updateField("retailBulkPrice")}
                required
              />
            </label>
            <label>
              Company price (GHS)
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={pricingForm.companyPrice}
                onChange={updateField("companyPrice")}
                required
              />
            </label>
            <label>
              Bulk starts at
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={pricingForm.bulkThreshold}
                onChange={updateField("bulkThreshold")}
                required
              />
            </label>
            <label className="water-module-cost-price-field">
              Cost price (GHS)
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={pricingForm.costPrice}
                onChange={updateField("costPrice")}
                placeholder="Not yet known"
              />
              <span>Internal — leave blank if unknown; never exposed to storefront customers.</span>
            </label>
          </div>
          <button type="submit" className="admin-primary" disabled={saving || loading}>
            <AppIcon icon={faMoneyCheckDollar} /> {saving ? "Saving..." : "Save Water pricing"}
          </button>
        </form>
      ) : (
        <div className="water-module-price-grid" aria-label="Current Water selling prices">
          <article className="water-module-price-card">
            <span>Retail</span>
            <strong>{pricing.retailSingle ? formatCurrency(pricing.retailSingle) : "Not configured"}</strong>
          </article>
          <article className="water-module-price-card">
            <span>Bulk ({pricing.bulkThreshold || 1}+)</span>
            <strong>{pricing.retailBulk ? formatCurrency(pricing.retailBulk) : "Not configured"}</strong>
          </article>
          <article className="water-module-price-card">
            <span>Company</span>
            <strong>{pricing.company ? formatCurrency(pricing.company) : "Not configured"}</strong>
          </article>
        </div>
      )}
    </Root>
  );
}
