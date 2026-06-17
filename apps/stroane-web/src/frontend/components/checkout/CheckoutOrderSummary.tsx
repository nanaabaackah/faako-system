import React from "react";
import { Link } from "react-router-dom";
import {
  formatCurrency,
  getAvailabilityLabel,
  getLineTotal,
  getPurchaseBlocker,
  isCheckoutEligibleProduct,
  isPricedProduct,
  type Product,
} from "../../../data/products";

interface CheckoutOrderLine {
  product: Product;
  qty: number;
}

interface CheckoutOrderSummaryProps {
  lines: CheckoutOrderLine[];
  unavailableLinesCount: number;
  total: number;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

const CheckoutOrderSummary: React.FC<CheckoutOrderSummaryProps> = ({
  lines,
  unavailableLinesCount,
  total,
  onUpdateQuantity,
  onRemove,
}) => (
  <aside className="checkout-summary" aria-label="Order summary">
    <h2 className="checkout-section-title">Order summary</h2>
    <ul className="checkout-summary__list">
      {lines.map(({ product, qty }) => (
        <li key={product.id}>
          <div className="checkout-summary__line-main">
            <span className="checkout-summary__name">
              {product.name}
              <em> x {qty}</em>
            </span>
            <div className="checkout-summary__qty">
              <button
                type="button"
                onClick={() => onUpdateQuantity(product.id, qty - 1)}
                aria-label={`Decrease ${product.name} quantity`}
              >
                -
              </button>
              <span>{qty}</span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(product.id, qty + 1)}
                disabled={!isCheckoutEligibleProduct(product, qty + 1)}
                aria-label={`Increase ${product.name} quantity`}
              >
                +
              </button>
              <button type="button" onClick={() => onRemove(product.id)}>
                Remove
              </button>
            </div>
          </div>
          <strong>
            {isPricedProduct(product) ? formatCurrency(getLineTotal(product, qty)) : "Request price"}
          </strong>
          {!isCheckoutEligibleProduct(product, qty) ? (
            <p className="checkout-summary__warning checkout-summary__warning--line">
              {getPurchaseBlocker(product, qty) || getAvailabilityLabel(product)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
    {unavailableLinesCount ? (
      <p className="checkout-summary__warning">
        Some items cannot be checked out until price or availability is confirmed.
      </p>
    ) : null}
    <div className="checkout-summary__total">
      <span>Subtotal</span>
      <strong>{formatCurrency(total)}</strong>
    </div>
    <Link to="/shop" className="checkout-summary__back">
      Continue Shopping
    </Link>
  </aside>
);

export default CheckoutOrderSummary;
