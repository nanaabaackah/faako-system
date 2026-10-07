import { InlineNotice } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import { faMoneyCheckDollar } from "/src/icons/iconSet";

const priceTypes = [
  ["retailPrice", "Retail Price"],
  ["companyPrice", "Company Price"],
  ["bulkPrice", "Bulk Price"],
];

export default function WaterPricingCard({
  product,
  permissions,
  pricingForm,
  setPricingForm,
  onSubmit,
  saving,
  loading,
  formatCurrency,
  priceHistory = [],
}) {
  const pricing = product?.pricing || {};
  const updateField = (field) => (event) =>
    setPricingForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <section
      className="water-module-hero water-module-pricing-card bubble-card"
      aria-labelledby="water-pricing-title"
    >
      <div className="water-module-hero-copy">
        <p className="water-module-eyebrow">Current Water prices</p>
        <h2 id="water-pricing-title">{product?.name || "Water product"}</h2>
        <p>These are the prices used for new orders. Price changes do not alter recorded sales.</p>
        {pricing.configurationErrorCode ? (
          <InlineNotice
            tone="warning"
            compact
            title="Some current prices are not configured"
            message="Set all three prices to make every Water price type available for new sales."
          />
        ) : null}
      </div>

      {permissions?.canManagePricing ? (
        <form className="water-module-form water-module-pricing-form" onSubmit={onSubmit}>
          <div className="water-module-price-grid">
            {priceTypes.map(([field, label]) => (
              <label key={field}>
                {label} (GHS)
                <input
                  aria-label={label}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={pricingForm[field]}
                  onChange={updateField(field)}
                  placeholder="0.00"
                  required
                />
              </label>
            ))}
          </div>
          <button type="submit" className="admin-primary" disabled={saving || loading}>
            <AppIcon icon={faMoneyCheckDollar} /> {saving ? "Saving..." : "Save current prices"}
          </button>
        </form>
      ) : (
        <div className="water-module-price-grid" aria-label="Current Water selling prices">
          {priceTypes.map(([field, label]) => (
            <article className="water-module-price-card" key={field}>
              <span>{label}</span>
              <strong>
                {pricing[field] !== null && pricing[field] !== undefined
                  ? formatCurrency(pricing[field])
                  : "Not configured"}
              </strong>
            </article>
          ))}
        </div>
      )}

      {priceHistory.length ? (
        <details className="water-module-price-history">
          <summary>Recent price changes</summary>
          <ul>
            {priceHistory.map((change) => (
              <li key={change.id}>
                <strong>{change.priceType}:</strong>{" "}
                {change.previousPriceCents === null
                  ? "Not set"
                  : formatCurrency(change.previousPriceCents)}
                {" → "}
                {formatCurrency(change.newPriceCents)}
                {" · "}
                {new Date(change.changedAt).toLocaleString("en-GB")}
                {" · "}
                {change.changedByName || "System"}
                {" · "}
                {change.source === "restock"
                  ? "Restock"
                  : change.source === "pricing-section"
                    ? "Pricing section"
                    : "Existing price history"}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
