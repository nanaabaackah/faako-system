import React from "react";
import { Link } from "react-router-dom";
import { HiArrowRight, HiCheckCircle } from "react-icons/hi";
import { formatCurrency } from "../../../data/products";
import type { CheckoutOrderResponse } from "../../../api/orders";

interface CheckoutConfirmationProps {
  createdOrder: CheckoutOrderResponse;
  name: string;
  paymentFallback: string;
}

const CheckoutConfirmation: React.FC<CheckoutConfirmationProps> = ({
  createdOrder,
  name,
  paymentFallback,
}) => (
  <div className="checkout-page">
    <div className="checkout-confirm">
      <span className="checkout-confirm__icon">
        <HiCheckCircle size={56} aria-hidden="true" />
      </span>
      <h1>Order request received</h1>
      <p>
        Thank you{name ? `, ${name}` : ""}. Your order number is{" "}
        <strong>{createdOrder.order.orderNumber}</strong>.
      </p>
      {paymentFallback ? (
        <p className="checkout-confirm__notice" role="status">
          Paystack payment could not start: {paymentFallback} Your order is still saved as
          payment pending.
        </p>
      ) : (
        <p>
          Stroane will confirm availability, delivery, and payment instructions before fulfillment.
        </p>
      )}
      <p className="checkout-confirm__meta">
        Total prepared: <strong>{formatCurrency(createdOrder.order.total)}</strong>
      </p>
      <Link to="/shop" className="checkout-confirm__cta">
        Continue shopping
        <HiArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  </div>
);

export default CheckoutConfirmation;
