import { InlineNotice } from "@faako/ui";
import PortalAction from "../../../components/PortalAction.jsx";
import { faMoneyCheckDollar } from "../../../icons/iconSet.js";

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
      id="water-pricing" tabIndex={-1}
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
          <PortalAction type="submit" className="admin-primary" icon={faMoneyCheckDollar}
            label={saving ? "Saving..." : "Save current prices"} disabled={saving || loading} />
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
          <summary>
            <span className="water-module-price-history__icon" aria-hidden="true">↗</span>
            <span className="water-module-price-history__summary-copy">
              <strong>Recent price changes</strong>
              <small>Review the audit trail for this product’s current prices.</small>
            </span>
            <span className="water-module-price-history__count" aria-label={`${priceHistory.length} changes`}>
              {priceHistory.length}
            </span>
            <span className="water-module-price-history__chevron" aria-hidden="true" />
          </summary>
          <ul className="water-module-price-history__list">
            {priceHistory.map((change) => (
              <li className="water-module-price-history__item" key={change.id}>
                <div className="water-module-price-history__item-heading">
                  <span className="water-module-price-history__type">
                    {`${change.priceType || "Price"} price`}
                  </span>
                  <span className="water-module-price-history__source">
                    {change.source === "restock"
                      ? "Restock"
                      : change.source === "pricing-section"
                        ? "Pricing section"
                        : "Existing price history"}
                  </span>
                </div>
                <p className="water-module-price-history__change">
                  <span>
                    {change.previousPriceCents === null
                      ? "Not set"
                      : formatCurrency(change.previousPriceCents)}
                  </span>
                  <span className="water-module-price-history__arrow" aria-label="changed to">→</span>
                  <strong>{formatCurrency(change.newPriceCents)}</strong>
                </p>
                <div className="water-module-price-history__meta">
                  <time dateTime={change.changedAt}>
                    {new Date(change.changedAt).toLocaleString("en-GB")}
                  </time>
                  <span>{change.changedByName || "System"}</span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
