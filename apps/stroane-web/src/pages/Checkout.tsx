import React, { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { HiArrowRight, HiCheckCircle } from "react-icons/hi";
import Layout from "../components/Layout";
import useSEOMeta from "../hooks/useSEOMeta";
import { products, formatCurrency } from "../data/products";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { payWithPaystack, PAYSTACK_PUBLIC_KEY } from "../lib/paystack";
import "../styles/pages/Checkout.css";

const Checkout: React.FC = () => {
  const { cart, clear } = useCart();
  const { user } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useSEOMeta({
    title: "Checkout | Stroane",
    description: "Complete your Stroane order.",
    canonical: "https://stroanesolutions.com/checkout",
    noIndex: true,
  });

  const lines = useMemo(
    () =>
      products
        .filter((p) => (cart[p.id] ?? 0) > 0)
        .map((product) => ({ product, qty: cart[product.id] })),
    [cart]
  );

  const total = lines.reduce(
    (sum, l) => sum + l.product.price * l.qty,
    0
  );

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!lines.length) return;
    setPaying(true);
    try {
      const reference = `STR-${Date.now()}`;
      const { reference: paidRef } = await payWithPaystack({
        email,
        amount: total,
        reference,
        metadata: {
          custom_fields: [
            { display_name: "Name", variable_name: "name", value: name },
            { display_name: "Phone", variable_name: "phone", value: phone },
            { display_name: "Address", variable_name: "address", value: address },
          ],
          cart: lines.map((l) => `${l.product.name} x${l.qty}`).join(", "),
        },
      });
      clear();
      setDone(paidRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setPaying(false);
    }
  };

  if (done) {
    return (
      <Layout>
        <div className="checkout-page">
          <div className="checkout-confirm">
            <span className="checkout-confirm__icon">
              <HiCheckCircle size={56} aria-hidden="true" />
            </span>
            <h1>Order received</h1>
            <p>
              Thank you{name ? `, ${name}` : ""}. Your payment reference is{" "}
              <strong>{done}</strong>. We&rsquo;ll confirm availability and
              delivery by email shortly.
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
            <h1>Complete your order</h1>
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
              {/* Customer + delivery */}
              <form className="checkout-form" onSubmit={handlePay} noValidate>
                <h2 className="checkout-section-title">Your details</h2>

                <div className="checkout-form__row">
                  <label className="checkout-field">
                    <span>Full name</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label className="checkout-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                      placeholder="+233…"
                      required
                    />
                  </label>
                  <label className="checkout-field">
                    <span>Delivery address</span>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      autoComplete="street-address"
                      required
                    />
                  </label>
                </div>

                {!PAYSTACK_PUBLIC_KEY ? (
                  <p className="checkout-form__notice">
                    Payment is not configured for this environment yet.
                  </p>
                ) : null}

                {error ? (
                  <p className="checkout-form__error" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="checkout-pay-btn"
                  disabled={
                    paying ||
                    !name ||
                    !email ||
                    !phone ||
                    !address ||
                    !PAYSTACK_PUBLIC_KEY
                  }
                >
                  {paying ? "Processing…" : `Pay ${formatCurrency(total)}`}
                  {!paying ? <HiArrowRight size={18} aria-hidden="true" /> : null}
                </button>
                <p className="checkout-form__secure">
                  Secured by Paystack. Cards &amp; mobile money supported.
                </p>
              </form>

              {/* Order summary */}
              <aside className="checkout-summary" aria-label="Order summary">
                <h2 className="checkout-section-title">Order summary</h2>
                <ul className="checkout-summary__list">
                  {lines.map(({ product, qty }) => (
                    <li key={product.id}>
                      <span className="checkout-summary__name">
                        {product.name}
                        <em> × {qty}</em>
                      </span>
                      <strong>{formatCurrency(product.price * qty)}</strong>
                    </li>
                  ))}
                </ul>
                <div className="checkout-summary__total">
                  <span>Total</span>
                  <strong>{formatCurrency(total)}</strong>
                </div>
                <Link to="/shop" className="checkout-summary__back">
                  ← Edit basket
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
