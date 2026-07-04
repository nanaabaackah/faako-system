import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HiArrowRight,
  HiOutlineCalendar,
  HiOutlineCreditCard,
  HiOutlineKey,
  HiOutlineLocationMarker,
  HiOutlineLogout,
  HiOutlineRefresh,
  HiOutlineSave,
  HiOutlineShoppingBag,
  HiOutlineX,
} from "react-icons/hi";
import { SelectField, TextField, TextareaField } from "@faako/ui";
import Layout from "../../components/Layout";
import { customerAccountApi, type CustomerOrder } from "../../api/customerAccount";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency } from "../../data/products";
import { isLikelyPhone, PHONE_INPUT_PATTERN } from "../../utils/contactValidation";
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

const formatDateTime = (value?: string) => {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatStatus = (value = "") =>
  value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Pending";

const formatDeliveryMethod = (value?: string) =>
  value === "pickup" ? "Pickup" : value === "delivery" ? "Delivery" : "Not recorded";

const CustomerAccountPlaceholder: React.FC<{ area: CustomerArea }> = ({ area }) => {
  const { user, loading, signOut, updateProfile, refreshProfile, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<ContactMethod>("email");
  const [defaultDeliveryAddress, setDefaultDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [passwordResetSending, setPasswordResetSending] = useState(false);
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

  useEffect(() => {
    if (loading || user) return;
    navigate("/sign", { replace: true, state: { from: `/${area}` } });
  }, [area, loading, navigate, user]);

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

  useEffect(() => {
    if (!selectedOrder) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedOrder(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedOrder]);

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

  const handlePasswordResetRequest = async () => {
    if (!user?.email) return;
    setError("");
    setNotice("");
    setPasswordResetSending(true);
    try {
      const message = await requestPasswordReset({ email: user.email });
      setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send a reset link.");
    } finally {
      setPasswordResetSending(false);
    }
  };

  return (
    <Layout>
      <section className="customer-account-page">
        <div className="customer-account-page__inner">
          <header className="customer-account-page__head">
            <span>Customer account</span>
            <h1>{user ? `Welcome, ${user.name.split(" ")[0] || "there"}` : "Opening secure sign in"}</h1>
            <p>
              Customer profiles are private. Sign in to view only your own profile and Stroane
              order history.
            </p>
          </header>

          {!user ? (
            <div className="customer-account-page__login">
              <div className="customer-account-card">
                <h2>Customer sign in</h2>
                <p className="customer-account-page__helper">
                  Use the secure Stroane sign-in page to view your private profile and orders.
                </p>
                <Link className="customer-account-link" to="/sign" state={{ from: `/${area}` }}>
                  Continue to sign in
                  <HiArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="customer-account-grid">
              <form className="glass-card customer-account-card" onSubmit={handleProfileSave} noValidate>
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
                <div className="customer-account-security">
                  <div>
                    <h3>Password</h3>
                    <p>{user.email}</p>
                  </div>
                  <button
                    type="button"
                    className="customer-account-ghost"
                    onClick={() => void handlePasswordResetRequest()}
                    disabled={passwordResetSending}
                  >
                    <HiOutlineKey size={17} aria-hidden="true" />
                    {passwordResetSending ? "Sending..." : "Send reset link"}
                  </button>
                </div>
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
                      <article key={order.id} role="listitem">
                        <button
                          type="button"
                          className="customer-account-order"
                          onClick={() => setSelectedOrder(order)}
                          aria-label={`Open details for order ${order.orderNumber}`}
                        >
                          <div>
                            <strong>{order.orderNumber}</strong>
                            <span>{formatDate(order.createdAt)}</span>
                          </div>
                          <div>
                            <span>{formatStatus(order.status)}</span>
                            <strong>{formatCurrency(order.total)}</strong>
                          </div>
                        </button>
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

        {selectedOrder ? (
          <div
            className="customer-order-lightbox"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-order-lightbox-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedOrder(null);
            }}
          >
            <article className="customer-order-modal">
              <header className="customer-order-modal__head">
                <div>
                  <span>Order details</span>
                  <h2 id="customer-order-lightbox-title">{selectedOrder.orderNumber}</h2>
                  <p>{formatDate(selectedOrder.createdAt)}</p>
                </div>
                <button
                  type="button"
                  className="customer-order-modal__close"
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close order details"
                >
                  <HiOutlineX size={20} aria-hidden="true" />
                </button>
              </header>

              <div className="customer-order-modal__summary">
                <div>
                  <HiOutlineShoppingBag size={18} aria-hidden="true" />
                  <span>Status</span>
                  <strong>{formatStatus(selectedOrder.status)}</strong>
                </div>
                <div>
                  <HiOutlineCreditCard size={18} aria-hidden="true" />
                  <span>Payment</span>
                  <strong>{formatStatus(selectedOrder.paymentStatus)}</strong>
                </div>
                <div>
                  <HiOutlineCalendar size={18} aria-hidden="true" />
                  <span>{formatDeliveryMethod(selectedOrder.deliveryMethod)}</span>
                  <strong>{formatDateTime(selectedOrder.expectedDeliveryDate)}</strong>
                </div>
              </div>

              <section className="customer-order-modal__section">
                <h3>Items</h3>
                <div className="customer-order-items">
                  {selectedOrder.items.map((item) => (
                    <div
                      className="customer-order-item"
                      key={`${selectedOrder.id}-${item.productSlug}`}
                    >
                      <div>
                        <strong>{item.productName}</strong>
                        <span>
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                          {item.sku ? ` - ${item.sku}` : ""}
                        </span>
                      </div>
                      <strong>{formatCurrency(item.lineTotal)}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="customer-order-modal__section">
                <h3>Fulfillment</h3>
                <div className="customer-order-fulfillment">
                  <HiOutlineLocationMarker size={18} aria-hidden="true" />
                  <div>
                    <strong>{formatDeliveryMethod(selectedOrder.deliveryMethod)}</strong>
                    <span>
                      {selectedOrder.deliveryAddress ||
                        selectedOrder.deliveryLocation?.address ||
                        selectedOrder.deliveryLocation?.label ||
                        "Location not recorded"}
                    </span>
                    {selectedOrder.deliveryNotes ? (
                      <small>{selectedOrder.deliveryNotes}</small>
                    ) : null}
                    {selectedOrder.deliveryLocation?.mapUrl ? (
                      <a
                        href={selectedOrder.deliveryLocation.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open map
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>

              <footer className="customer-order-modal__footer">
                <span>Total</span>
                <strong>{formatCurrency(selectedOrder.total)}</strong>
                {selectedOrder.paymentReference ? (
                  <small>Payment reference: {selectedOrder.paymentReference}</small>
                ) : null}
              </footer>
            </article>
          </div>
        ) : null}
      </section>
    </Layout>
  );
};

export default CustomerAccountPlaceholder;
