import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HiArrowRight,
  HiOutlineLogout,
  HiOutlineRefresh,
  HiOutlineSave,
} from "react-icons/hi";
import { SelectField, TextField, TextareaField } from "@faako/ui";
import Layout from "../../components/Layout";
import { customerAccountApi, type CustomerOrder } from "../../api/customerAccount";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency } from "../../data/products";
import { isLikelyEmail, isLikelyPhone, PHONE_INPUT_PATTERN } from "../../utils/contactValidation";
import useSEOMeta from "../../hooks/useSEOMeta";
import "../styles/AccountPlaceholder.css";

type CustomerArea = "account" | "orders" | "quotes";
type ContactMethod = "email" | "phone" | "whatsapp";

const getSelectValue = (value: string | string[]) =>
  Array.isArray(value) ? value[0] || "" : value;

const formatDate = (value?: string) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatStatus = (value = "") =>
  value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Pending";

const CustomerAccountPlaceholder: React.FC<{ area: CustomerArea }> = ({ area }) => {
  const { user, loading, signIn, signOut, updateProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<ContactMethod>("email");
  const [defaultDeliveryAddress, setDefaultDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useSEOMeta({
    title: area === "orders" ? "Your Orders | Stroane" : "Your Account | Stroane",
    description: "Manage your Stroane customer profile and order history.",
    canonical: `https://stroanesolutions.com/${area}`,
    noIndex: true,
  });

  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setPhone(user.phone || "");
    setBusinessName(user.businessName || "");
    setPreferredContactMethod(user.preferredContactMethod || "email");
    setDefaultDeliveryAddress(user.defaultDeliveryAddress || "");
    setDeliveryNotes(user.deliveryNotes || "");
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);
    setError("");
    try {
      setOrders(await customerAccountApi.listOrders());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your orders.");
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const accountTotal = useMemo(
    () => orders.reduce((total, order) => total + Number(order.total || 0), 0),
    [orders]
  );

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!isLikelyEmail(loginEmail)) {
      setError("Add a valid email address.");
      return;
    }
    if (!loginPassword) {
      setError("Add your password.");
      return;
    }
    setSaving(true);
    try {
      await signIn(loginEmail, loginPassword);
      setLoginPassword("");
      setNotice("Signed in securely.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!name.trim()) {
      setError("Add your full name.");
      return;
    }
    if (phone.trim() && !isLikelyPhone(phone)) {
      setError("Add a valid phone number.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name,
        phone,
        businessName,
        preferredContactMethod,
        defaultDeliveryAddress,
        deliveryNotes,
      });
      setNotice("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/account", { replace: true });
  };

  return (
    <Layout>
      <section className="customer-account-page">
        <div className="customer-account-page__inner">
          <header className="customer-account-page__head">
            <span>Customer account</span>
            <h1>{user ? `Welcome, ${user.name.split(" ")[0] || "there"}` : "Sign in to your account"}</h1>
            <p>
              Customer profiles are private. Sign in to view only your own profile and Stroane
              order history.
            </p>
          </header>

          {!user ? (
            <div className="customer-account-page__login">
              <form className="customer-account-card" onSubmit={handleLogin} noValidate>
                <h2>Customer login</h2>
                <TextField
                  fieldClassName="customer-account-field"
                  label="Email"
                  type="email"
                  value={loginEmail}
                  onChange={(event) => {
                    setLoginEmail(event.target.value);
                    setError("");
                  }}
                  autoComplete="email"
                  required
                />
                <TextField
                  fieldClassName="customer-account-field"
                  label="Password"
                  type="password"
                  value={loginPassword}
                  onChange={(event) => {
                    setLoginPassword(event.target.value);
                    setError("");
                  }}
                  autoComplete="current-password"
                  required
                />
                {error ? (
                  <p className="customer-account-message is-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button className="customer-account-action" type="submit" disabled={saving || loading}>
                  {saving ? "Signing in..." : "Sign in"}
                  {!saving ? <HiArrowRight size={17} aria-hidden="true" /> : null}
                </button>
                <p className="customer-account-page__helper">
                  New customer? Create your profile from your Paystack return page or a Stroane
                  invitation link.
                </p>
              </form>
            </div>
          ) : (
            <div className="customer-account-grid">
              <form className="customer-account-card" onSubmit={handleProfileSave} noValidate>
                <div className="customer-account-card__head">
                  <h2>Profile details</h2>
                  <button
                    type="button"
                    className="customer-account-ghost"
                    onClick={() => void refreshProfile()}
                  >
                    <HiOutlineRefresh size={16} aria-hidden="true" />
                    Refresh
                  </button>
                </div>
                <TextField
                  fieldClassName="customer-account-field"
                  label="Email"
                  type="email"
                  value={user.email}
                  disabled
                />
                <TextField
                  fieldClassName="customer-account-field"
                  label="Full name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                />
                <TextField
                  fieldClassName="customer-account-field"
                  label="Phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="tel"
                  pattern={PHONE_INPUT_PATTERN}
                  autoComplete="tel"
                />
                <TextField
                  fieldClassName="customer-account-field"
                  label="Business name"
                  type="text"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  autoComplete="organization"
                />
                <SelectField
                  fieldClassName="customer-account-field"
                  label="Preferred contact"
                  value={preferredContactMethod}
                  onChangeValue={(value) =>
                    setPreferredContactMethod(getSelectValue(value) as ContactMethod)
                  }
                  options={[
                    { value: "email", label: "Email" },
                    { value: "phone", label: "Phone call" },
                    { value: "whatsapp", label: "WhatsApp" },
                  ]}
                />
                <TextField
                  fieldClassName="customer-account-field"
                  label="Default delivery address"
                  type="text"
                  value={defaultDeliveryAddress}
                  onChange={(event) => setDefaultDeliveryAddress(event.target.value)}
                  autoComplete="street-address"
                />
                <TextareaField
                  fieldClassName="customer-account-field"
                  label="Delivery notes"
                  value={deliveryNotes}
                  rows={3}
                  onChange={(event) => setDeliveryNotes(event.target.value)}
                />

                {notice ? (
                  <p className="customer-account-message" role="status">
                    {notice}
                  </p>
                ) : null}
                {error ? (
                  <p className="customer-account-message is-error" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="customer-account-card__actions">
                  <button className="customer-account-action" type="submit" disabled={saving}>
                    <HiOutlineSave size={17} aria-hidden="true" />
                    {saving ? "Saving..." : "Save profile"}
                  </button>
                  <button
                    className="customer-account-ghost is-danger"
                    type="button"
                    onClick={() => void handleSignOut()}
                  >
                    <HiOutlineLogout size={17} aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              </form>

              <aside className="customer-account-card customer-account-card--summary">
                <h2>Order summary</h2>
                <dl className="customer-account-stats">
                  <div>
                    <dt>Orders</dt>
                    <dd>{orders.length}</dd>
                  </div>
                  <div>
                    <dt>Total spend</dt>
                    <dd>{formatCurrency(accountTotal)}</dd>
                  </div>
                  <div>
                    <dt>Account status</dt>
                    <dd>{formatStatus(user.status)}</dd>
                  </div>
                </dl>
                <Link className="customer-account-link" to="/shop">
                  Continue shopping
                  <HiArrowRight size={16} aria-hidden="true" />
                </Link>
              </aside>

              <section className="customer-account-card customer-account-card--orders">
                <div className="customer-account-card__head">
                  <h2>Your orders</h2>
                  <button
                    type="button"
                    className="customer-account-ghost"
                    onClick={() => void loadOrders()}
                    disabled={ordersLoading}
                  >
                    <HiOutlineRefresh size={16} aria-hidden="true" />
                    {ordersLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
                {orders.length ? (
                  <div className="customer-account-orders" role="list">
                    {orders.map((order) => (
                      <article key={order.id} className="customer-account-order" role="listitem">
                        <div>
                          <strong>{order.orderNumber}</strong>
                          <span>{formatDate(order.createdAt)}</span>
                        </div>
                        <div>
                          <span>{formatStatus(order.status)}</span>
                          <strong>{formatCurrency(order.total)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="customer-account-empty">
                    No orders are linked to this account yet.
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default CustomerAccountPlaceholder;
