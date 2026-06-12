import React, { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { HiArrowRight, HiCheckCircle } from "react-icons/hi";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import useCatalogueData from "../../hooks/useCatalogueData";
import { orderApi, type CheckoutOrderResponse } from "../../api/orders";
import {
  formatCurrency,
  getAvailabilityLabel,
  getPurchaseBlocker,
  getLineTotal,
  isCheckoutEligibleProduct,
  isPricedProduct,
  type Product,
} from "../../data/products";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import "../../styles/pages/Checkout.css";

const isLikelyEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const Checkout: React.FC = () => {
  const { products: catalogueProducts, notice } = useCatalogueData();
  const { cart, updateQuantity, remove, clear } = useCart();
  const { user } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<
    "email" | "phone" | "whatsapp"
  >("email");
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CheckoutOrderResponse | null>(null);
  const [paymentFallback, setPaymentFallback] = useState("");

  useSEOMeta({
    title: "Checkout | Stroane",
    description: "Review your Stroane order request.",
    canonical: "https://stroanesolutions.com/checkout",
    noIndex: true,
  });

  const lines = useMemo(
    () =>
      catalogueProducts
        .filter((product) => (cart[product.id] ?? 0) > 0)
        .map((product) => ({ product, qty: cart[product.id] })),
    [cart, catalogueProducts]
  );

  const unavailableLines = lines.filter(
    ({ product, qty }) => !isCheckoutEligibleProduct(product, qty)
  );
  const purchasableLines = lines.filter(
    (line): line is { product: Product & { price: number }; qty: number } =>
      isCheckoutEligibleProduct(line.product, line.qty)
  );

  const total = purchasableLines.reduce(
    (sum, line) => sum + getLineTotal(line.product, line.qty),
    0
  );

  const validateDetails = () => {
    if (!lines.length) return "Your basket is empty.";
    if (unavailableLines.length) {
      return "Remove unavailable, price-request, or unconfirmed-stock items before checkout.";
    }
    if (!name.trim()) return "Add your full name.";
    if (!isLikelyEmail(email)) return "Add a valid email address.";
    if (!phone.trim()) return "Add your phone number.";
    if (!address.trim()) return "Add a delivery address or pickup note.";
    if (website.trim()) return "The checkout request could not be submitted.";
    return "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const validationMessage = validateDetails();
    if (validationMessage) {
      setError(validationMessage);
      setReviewing(false);
      return;
    }

    if (!reviewing) {
      setReviewing(true);
      return;
    }

    setSubmitting(true);
    try {
      const response = await orderApi.createOrder({
        customer: {
          name,
          email,
          phone,
          preferredContactMethod,
          businessName,
          deliveryAddress: address,
          deliveryNotes,
        },
        items: purchasableLines.map(({ product, qty }) => ({
          productSlug: product.id,
          quantity: qty,
        })),
        source: "checkout",
        website,
      });
      clear();
      try {
        const paymentResponse = await orderApi.initializePaystackPayment(response.order.id);
        window.location.assign(paymentResponse.payment.authorizationUrl);
      } catch (paymentError) {
        setPaymentFallback(
          paymentError instanceof Error
            ? paymentError.message
            : "Payment could not be started. Stroane will follow up with payment instructions."
        );
        setCreatedOrder(response);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We could not prepare your order. Please contact Stroane directly."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (createdOrder) {
    return (
      <Layout>
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
                Stroane will confirm availability, delivery, and payment instructions before
                fulfillment.
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
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="checkout-page">
        <div className="checkout-page__inner">
          <header className="checkout-head">
            <span className="checkout-kicker">Checkout</span>
            <h1>Review your order request</h1>
            <p>
              Submit your details, review the order, then continue to Paystack test checkout.
            </p>
          </header>

          {lines.length === 0 ? (
            <div className="checkout-empty">
              <p>Your basket is empty.</p>
              <Link to="/shop" className="checkout-empty__cta">
                Browse the store
                <HiArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="checkout-grid">
              <form className="checkout-form" onSubmit={handleSubmit} noValidate>
                <h2 className="checkout-section-title">Your details</h2>

                <div className="checkout-form__row">
                  <label className="checkout-field">
                    <span>Full name</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setReviewing(false);
                      }}
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label className="checkout-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setReviewing(false);
                      }}
                      autoComplete="email"
                      required
                    />
                  </label>
                </div>

                <div className="checkout-form__row">
                  <label className="checkout-field">
                    <span>Phone</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        setReviewing(false);
                      }}
                      autoComplete="tel"
                      placeholder="+233..."
                      required
                    />
                  </label>
                  <label className="checkout-field">
                    <span>Business name</span>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(event) => {
                        setBusinessName(event.target.value);
                        setReviewing(false);
                      }}
                      autoComplete="organization"
                    />
                  </label>
                </div>

                <label className="checkout-field checkout-field--full">
                  <span>Preferred contact method</span>
                  <select
                    value={preferredContactMethod}
                    onChange={(event) => {
                      setPreferredContactMethod(
                        event.target.value as "email" | "phone" | "whatsapp"
                      );
                      setReviewing(false);
                    }}
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone call</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>

                <label className="checkout-field checkout-field--full">
                  <span>Delivery address or pickup note</span>
                  <input
                    type="text"
                    value={address}
                    onChange={(event) => {
                      setAddress(event.target.value);
                      setReviewing(false);
                    }}
                    autoComplete="street-address"
                    required
                  />
                </label>

                <label className="checkout-field checkout-field--full">
                  <span>Delivery notes</span>
                  <textarea
                    rows={3}
                    value={deliveryNotes}
                    onChange={(event) => {
                      setDeliveryNotes(event.target.value);
                      setReviewing(false);
                    }}
                    placeholder="Branch location, preferred delivery time, or special handling notes"
                  />
                </label>

                <label className="checkout-field checkout-field--trap" aria-hidden="true">
                  <span>Website</span>
                  <input
                    type="text"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    autoComplete="off"
                    tabIndex={-1}
                  />
                </label>

                {notice ? (
                  <p className="checkout-form__notice" role="status">
                    {notice}
                  </p>
                ) : null}

                <p className="checkout-form__notice">
                  Payment is initialized by the Stroane backend using Paystack. Prices are verified
                  on the server before redirecting you.
                </p>

                {reviewing ? (
                  <div className="checkout-review-notice" role="status">
                    <strong>Review step</strong>
                    <span>
                      Confirm the details and order summary, then submit the order request.
                    </span>
                  </div>
                ) : null}

                {error ? (
                  <p className="checkout-form__error" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="checkout-form__actions">
                  {reviewing ? (
                    <button
                      type="button"
                      className="checkout-edit-btn"
                      onClick={() => setReviewing(false)}
                      disabled={submitting}
                    >
                      Edit details
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="checkout-pay-btn"
                    disabled={submitting || !lines.length}
                  >
                    {submitting
                      ? "Preparing Paystack..."
                      : reviewing
                      ? "Continue to Paystack"
                      : "Review order"}
                    {!submitting ? <HiArrowRight size={18} aria-hidden="true" /> : null}
                  </button>
                </div>
              </form>

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
                            onClick={() => updateQuantity(product.id, qty - 1)}
                            aria-label={`Decrease ${product.name} quantity`}
                          >
                            -
                          </button>
                          <span>{qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, qty + 1)}
                            disabled={!isCheckoutEligibleProduct(product, qty + 1)}
                            aria-label={`Increase ${product.name} quantity`}
                          >
                            +
                          </button>
                          <button type="button" onClick={() => remove(product.id)}>
                            Remove
                          </button>
                        </div>
                      </div>
                      <strong>
                        {isPricedProduct(product)
                          ? formatCurrency(getLineTotal(product, qty))
                          : "Request price"}
                      </strong>
                      {!isCheckoutEligibleProduct(product, qty) ? (
                        <p className="checkout-summary__warning checkout-summary__warning--line">
                          {getPurchaseBlocker(product, qty) || getAvailabilityLabel(product)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {unavailableLines.length ? (
                  <p className="checkout-summary__warning">
                    Some items cannot be checked out until price and stock are confirmed.
                  </p>
                ) : null}
                <div className="checkout-summary__total">
                  <span>Subtotal</span>
                  <strong>{formatCurrency(total)}</strong>
                </div>
                <p className="checkout-summary__payment">
                  Order status after submit: <strong>payment pending</strong>
                </p>
                <Link to="/shop" className="checkout-summary__back">
                  Edit basket in shop
                </Link>
              </aside>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;
