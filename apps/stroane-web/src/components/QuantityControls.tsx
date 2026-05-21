import React from "react";
import { HiPlus, HiMinus, HiTrash } from "react-icons/hi";
import "../styles/components/QuantityControls.css";

interface Props {
  qty: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  size?: "sm" | "lg";
  productName?: string;
  addLabel?: string;
  disabled?: boolean;
  disabledLabel?: string;
  maxQuantity?: number | null;
}

const QuantityControls: React.FC<Props> = ({
  qty,
  onIncrement,
  onDecrement,
  onRemove,
  size = "sm",
  productName,
  addLabel = "Add",
  disabled = false,
  disabledLabel = "Unavailable",
  maxQuantity = null,
}) => {
  const sizeClass = size === "lg" ? " qty-controls--lg" : "";
  const maxReached = typeof maxQuantity === "number" && qty >= maxQuantity;

  if (qty === 0) {
    return (
      <button
        type="button"
        className={`qty-controls qty-controls--add${sizeClass}`}
        onClick={onIncrement}
        disabled={disabled}
        aria-label={productName ? `Add ${productName} to cart` : "Add to cart"}
      >
        <HiPlus size={size === "lg" ? 18 : 16} aria-hidden="true" />
        <span>{disabled ? disabledLabel : addLabel}</span>
      </button>
    );
  }

  return (
    <div
      className={`qty-controls qty-controls--row${sizeClass}`}
      role="group"
      aria-label={productName ? `Quantity for ${productName}` : "Quantity"}
    >
      <button
        type="button"
        className="qty-controls__btn"
        onClick={onDecrement}
        disabled={qty <= 1}
        aria-label="Decrease quantity"
      >
        <HiMinus size={size === "lg" ? 18 : 16} aria-hidden="true" />
      </button>
      <span className="qty-controls__value" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="qty-controls__btn"
        onClick={onIncrement}
        disabled={disabled || maxReached}
        aria-label="Increase quantity"
      >
        <HiPlus size={size === "lg" ? 18 : 16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="qty-controls__btn qty-controls__btn--remove"
        onClick={onRemove}
        aria-label={productName ? `Remove ${productName} from cart` : "Remove from cart"}
      >
        <HiTrash size={size === "lg" ? 18 : 16} aria-hidden="true" />
      </button>
    </div>
  );
};

export default QuantityControls;
