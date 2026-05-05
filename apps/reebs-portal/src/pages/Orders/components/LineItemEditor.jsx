import React, { useMemo, useState } from "react";
import SearchField from "../../../components/SearchField/SearchField";
import {
  formatCurrencyFromCents,
  formatCurrencyMajor,
  formatStatusLabel,
} from "../orderUi";

const asItemRecord = (value) => (value && typeof value === "object" ? value : {});

const getItemUnitCents = (item = {}) => {
  const source = asItemRecord(item);
  if (source.unit_price != null) return Number(source.unit_price || 0);
  if (source.unitPrice != null) return Math.round(Number(source.unitPrice || 0) * 100);
  return 0;
};

const getItemTotalCents = (item = {}) => {
  const source = asItemRecord(item);
  if (source.total_amount != null) return Number(source.total_amount || 0);
  if (source.total != null) return Math.round(Number(source.total || 0) * 100);
  return getItemUnitCents(source) * Number(source.quantity || 0);
};

export default function LineItemEditor({ items = [], stockMovements = [] }) {
  const [query, setQuery] = useState("");
  const safeItems = useMemo(
    () => (Array.isArray(items) ? items.filter((item) => item && typeof item === "object") : []),
    [items]
  );
  const movementItemIds = useMemo(() => {
    return new Set(
      (Array.isArray(stockMovements) ? stockMovements : [])
        .map((movement) => asItemRecord(movement).orderItemId || asItemRecord(movement).orderItemID)
        .filter(Boolean)
        .map(String)
    );
  }, [stockMovements]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return safeItems;
    return safeItems.filter((item) => {
      const haystack = [
        item.productName,
        item.variantLabel,
        item.sku,
        item.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, safeItems]);

  return (
    <section className="glass-card orders-panel orders-items-panel">
      <div className="orders-panel-header">
        <div>
          <h3>Line items</h3>
          <span>{safeItems.length} shop items</span>
        </div>
        <SearchField
          className="orders-items-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          placeholder="Search products"
          aria-label="Search order products"
        />
      </div>

      <div className="orders-items-list">
        {filteredItems.length ? (
          filteredItems.map((item) => {
            const stockCommitted = movementItemIds.has(String(item.id));
            const itemKey = item.id || `${item.productId || "product"}-${item.variantId || item.sku || item.productName || "item"}`;
            return (
              <article key={itemKey} className="bubble-card orders-items-card">
                <div className="orders-items-main">
                  {item.imageUrl && (
                    <span className="orders-items-thumb">
                      <img src={item.imageUrl} alt={item.productName || "Shop item"} />
                    </span>
                  )}
                  <div>
                    <h4>{item.variantLabel || item.productName || "Shop item"}</h4>
                    <p>
                      SKU {item.sku || "N/A"} · Qty {Number(item.quantity || 0)}
                    </p>
                    <span className={`orders-status-pill orders-status-pill--compact ${stockCommitted ? "completed" : "pending"}`}>
                      {stockCommitted ? "Stock committed" : "Stock pending"}
                    </span>
                  </div>
                </div>
                <div className="orders-items-money">
                  <span>{formatCurrencyFromCents(getItemUnitCents(item))} each</span>
                  <strong>
                    {item.total_amount != null || item.total == null
                      ? formatCurrencyFromCents(getItemTotalCents(item))
                      : formatCurrencyMajor(item.total)}
                  </strong>
                  {item.itemType && <small>{formatStatusLabel(item.itemType)}</small>}
                </div>
              </article>
            );
          })
        ) : (
          <p className="orders-empty">No line items match this search.</p>
        )}
      </div>
    </section>
  );
}
