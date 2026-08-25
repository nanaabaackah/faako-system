export const PRODUCT_SHOW_ALL_THRESHOLD = 50;

export function normalizeOrderCurrency(currency) {
  if (typeof currency !== "string") return "GHS";
  const trimmed = currency.trim();
  return trimmed ? trimmed.toUpperCase() : "GHS";
}

/**
 * Caps the visible product list when no search query is active.
 * Returns all products when a query is present so search always shows full results.
 */
export function computeVisibleProducts(
  filteredProducts,
  query,
  threshold = PRODUCT_SHOW_ALL_THRESHOLD,
) {
  const total = filteredProducts.length;
  if (!query.trim() && total > threshold) {
    return { items: filteredProducts.slice(0, threshold), capped: true, total };
  }
  return { items: filteredProducts, capped: false, total };
}
