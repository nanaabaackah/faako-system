import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faArrowLeft,
  faMinus,
  faPlus,
  faReceipt,
  faRotateRight,
  faTrash,
} from "/src/icons/iconSet";
import { useAuth } from "../../components/AuthContext/AuthContext";
import SearchField from "../../components/SearchField/SearchField";
import "./StoreMode.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getQuantity = (item) => {
  const raw = item?.quantity ?? item?.stock ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getUnitPrice = (item) => {
  if (typeof item?.price === "number") return item.price;
  if (typeof item?.price === "string") {
    const parsed = Number(item.price);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof item?.priceCents === "number") return item.priceCents / 100;
  if (typeof item?.priceCents === "string") {
    const parsed = Number(item.priceCents);
    return Number.isFinite(parsed) ? parsed / 100 : 0;
  }
  return 0;
};

const getCategory = (item) =>
  item?.specificCategory || item?.specificcategory || item?.sourceCategoryCode || "General";

const isSaleableProduct = (item) => {
  const source = String(item?.sourceCategoryCode || item?.sourcecategorycode || "")
    .trim()
    .toLowerCase();
  return source !== "rental";
};

const formatMoney = (value, currency = "GHS") => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toFixed(2)}`;
  }
};

const normalizeText = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "");

const parseReceiptContact = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return { channel: "", value: "", email: "", phone: "", isValid: false };
  }
  if (EMAIL_PATTERN.test(normalized)) {
    const email = normalized.toLowerCase();
    return { channel: "email", value: email, email, phone: "", isValid: true };
  }
  const digits = normalizePhoneDigits(normalized);
  if (digits.length >= 9) {
    return { channel: "whatsapp", value: normalized, email: "", phone: normalized, isValid: true };
  }
  return { channel: "", value: normalized, email: "", phone: "", isValid: false };
};

const todayValue = () => new Date().toISOString().slice(0, 10);

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "momo", label: "MoMo" },
];

function StoreMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [orderItems, setOrderItems] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [momoReference, setMomoReference] = useState("");
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const refreshInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/.netlify/functions/inventory");
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load stock.");
      }
      setItems(Array.isArray(payload) ? payload.filter(isSaleableProduct) : []);
    } catch (nextError) {
      setError(nextError.message || "Unable to load stock.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshInventory();
  }, [refreshInventory]);

  const categories = useMemo(() => {
    const values = new Set();
    items.forEach((item) => {
      const category = getCategory(item);
      if (category) values.add(category);
    });
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [items]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items
      .filter((item) => {
        const stock = getQuantity(item);
        if (needle) {
          const haystack = [item?.name || "", item?.sku || "", item?.barcode || ""]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        if (categoryFilter !== "all" && getCategory(item) !== categoryFilter) return false;
        if (stockFilter === "in" && stock <= 0) return false;
        if (stockFilter === "low" && (stock <= 0 || stock > 5)) return false;
        if (stockFilter === "out" && stock > 0) return false;
        return true;
      })
      .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || "")));
  }, [categoryFilter, items, search, stockFilter]);

  const orderQtyById = useMemo(
    () => new Map(orderItems.map((item) => [item.productId, item.quantity])),
    [orderItems]
  );

  const orderCurrency = useMemo(() => orderItems[0]?.currency || "GHS", [orderItems]);
  const subtotal = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [orderItems]
  );
  const rawDiscount = Number(discountValue);
  const safeDiscount = Number.isFinite(rawDiscount) && rawDiscount > 0 ? rawDiscount : 0;
  const discountAmount = useMemo(() => {
    if (!safeDiscount || subtotal <= 0) return 0;
    if (discountType === "percent") {
      return subtotal * (Math.min(100, safeDiscount) / 100);
    }
    return Math.min(subtotal, safeDiscount);
  }, [discountType, safeDiscount, subtotal]);
  const total = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);
  const numericCashReceived = Number(cashReceived);
  const safeCashReceived =
    Number.isFinite(numericCashReceived) && numericCashReceived >= 0 ? numericCashReceived : 0;
  const cashShortfall = paymentMethod === "cash" ? Math.max(0, total - safeCashReceived) : 0;
  const changeDue = paymentMethod === "cash" ? Math.max(0, safeCashReceived - total) : 0;
  const receiptContact = useMemo(() => parseReceiptContact(customerContact), [customerContact]);
  const normalizedMomoReference = normalizeText(momoReference);
  const canSavePayLater = orderItems.length > 0 && receiptContact.channel === "email";

  const addToOrder = (product) => {
    const productId = Number(product?.id);
    const stock = getQuantity(product);
    if (!Number.isFinite(productId) || productId <= 0 || stock <= 0) return;
    setOrderItems((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) {
        if (existing.quantity >= stock) return current;
        return current.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...current,
        {
          productId,
          name: product?.name || "Untitled",
          unitPrice: getUnitPrice(product),
          quantity: 1,
          stock,
          currency: product?.currency || "GHS",
        },
      ];
    });
    setSubmitError("");
    setSuccess("");
  };

  const removeFromOrder = (productId) => {
    setOrderItems((current) =>
      current
        .map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
    setSubmitError("");
    setSuccess("");
  };

  const clearLineFromOrder = (productId) => {
    setOrderItems((current) => current.filter((item) => item.productId !== productId));
    setSubmitError("");
    setSuccess("");
  };

  const clearOrder = () => {
    setOrderItems([]);
    setCustomerName("");
    setCustomerContact("");
    setPaymentMethod("cash");
    setMomoReference("");
    setDiscountType("amount");
    setDiscountValue("");
    setCashReceived("");
    setSubmitError("");
    setSuccess("");
  };

  const ensureCustomer = async (contact) => {
    const name = normalizeText(customerName) || "Walk-in customer";
    const email = contact.channel === "email" ? contact.email : "";
    const phone = contact.channel === "whatsapp" ? contact.phone : "";

    const response = await fetch("/.netlify/functions/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email: email || undefined,
        phone: phone || undefined,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "Unable to save customer details.");
    }
    return payload;
  };

  const submitSale = async ({ payLater = false } = {}) => {
    setSubmitError("");
    setSuccess("");

    if (!orderItems.length) {
      setSubmitError("Add at least one item to the sale.");
      return;
    }
    if (customerContact.trim() && !receiptContact.isValid) {
      setSubmitError("Enter a valid email or WhatsApp number for the customer contact.");
      return;
    }
    if (payLater && receiptContact.channel !== "email") {
      setSubmitError("Pay later requires a customer email so reminders can be sent.");
      return;
    }
    if (!payLater && paymentMethod === "momo" && !normalizedMomoReference) {
      setSubmitError("Enter the MoMo reference before recording the sale.");
      return;
    }
    if (!payLater && paymentMethod === "cash" && cashShortfall > 0) {
      setSubmitError("Cash received must cover the total.");
      return;
    }

    setSubmitting(true);
    try {
      const customer = await ensureCustomer(receiptContact);
      const response = await fetch("/.netlify/functions/createOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(customer?.id),
          status: payLater ? "pending" : "paid",
          deliveryMethod: "pickup",
          pickupDetails: { date: todayValue(), notes: "Recorded in store mode." },
          discount: discountAmount,
          paymentPreference: payLater
            ? {
                method: "pay-later",
                payLater: true,
                createdInStore: true,
                receiptChannel: "email",
                receiptContact: receiptContact.email,
                reminderIntervalDays: 14,
              }
            : {
                method: paymentMethod,
                recordedInStore: true,
                createdInStore: true,
                cashReceived: paymentMethod === "cash" ? safeCashReceived : undefined,
                changeDue: paymentMethod === "cash" ? changeDue : undefined,
                momoReference: paymentMethod === "momo" ? normalizedMomoReference : undefined,
                receiptChannel: receiptContact.channel || "none",
                receiptContact: receiptContact.channel ? receiptContact.value : "",
              },
          items: orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.unitPrice,
          })),
          source: "store-mode",
          userName:
            user?.fullName ||
            user?.name ||
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            undefined,
          userEmail: user?.email,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to record the sale.");
      }

      setItems((current) =>
        current.map((product) => {
          const line = orderItems.find((item) => item.productId === Number(product.id));
          if (!line) return product;
          const nextStock = Math.max(getQuantity(product) - line.quantity, 0);
          return { ...product, quantity: nextStock, stock: nextStock };
        })
      );

      const orderNumber = payload?.orderNumber || payload?.orderId || "";
      const receiptDelivery = payload?.receiptDelivery || null;
      clearOrder();

      let nextMessage = payLater
        ? orderNumber
          ? `Sale saved as ${orderNumber}. Payment is still pending.`
          : "Sale saved with payment pending."
        : orderNumber
          ? `Sale recorded as ${orderNumber}.`
          : "Sale recorded.";

      if (payLater && receiptDelivery?.sent) {
        nextMessage += " Payment email sent.";
      } else if (!payLater && receiptDelivery?.sent) {
        nextMessage += receiptDelivery.channel === "email" ? " Receipt emailed." : " Receipt sent on WhatsApp.";
      } else if (receiptDelivery?.reason === "failed") {
        nextMessage += " Receipt delivery failed.";
      }

      setSuccess(nextMessage);
    } catch (nextError) {
      setSubmitError(nextError.message || "Unable to record the sale.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="store-mode-page">
      <header className="store-mode-header">
        <button type="button" className="store-mode-button is-ghost" onClick={() => navigate("/admin/inventory")}>
          <AppIcon icon={faArrowLeft} />
          Back to inventory
        </button>
        <div className="store-mode-heading">
          <p className="store-mode-eyebrow">POS</p>
          <h1>Store Mode</h1>
          <p>Fast in-person sales with inventory awareness, receipt routing, and safe order capture.</p>
        </div>
        <button type="button" className="store-mode-button" onClick={refreshInventory} disabled={loading}>
          <AppIcon icon={faRotateRight} />
          {loading ? "Refreshing" : "Refresh stock"}
        </button>
      </header>

      {(error || submitError || success) ? (
        <div className="store-mode-feedback">
          {error ? <p className="store-mode-alert is-error">{error}</p> : null}
          {submitError ? <p className="store-mode-alert is-error">{submitError}</p> : null}
          {success ? <p className="store-mode-alert is-success">{success}</p> : null}
        </div>
      ) : null}

      <div className="store-mode-grid">
        <section className="store-mode-panel">
          <div className="store-mode-panel-header">
            <div>
              <p className="store-mode-eyebrow">Inventory</p>
              <h2>Available products</h2>
            </div>
            <span className="store-mode-count">{filteredItems.length} items</span>
          </div>

          <div className="store-mode-toolbar">
            <SearchField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search by name, SKU, or barcode"
              aria-label="Search products"
            />
            <select
              className="store-mode-select"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <div className="store-mode-filter-row" role="tablist" aria-label="Stock status">
              {[
                { key: "all", label: "All" },
                { key: "in", label: "In stock" },
                { key: "low", label: "Low" },
                { key: "out", label: "Out" },
              ].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  role="tab"
                  aria-selected={stockFilter === filter.key}
                  className={`store-mode-pill ${stockFilter === filter.key ? "is-active" : ""}`}
                  onClick={() => setStockFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="store-mode-list">
            {loading ? (
              <p className="store-mode-empty">Loading stock...</p>
            ) : filteredItems.length ? (
              filteredItems.map((item) => {
                const stock = getQuantity(item);
                const selectedQty = orderQtyById.get(Number(item.id)) || 0;
                const stockClass = stock <= 0 ? "is-out" : stock <= 5 ? "is-low" : "";
                return (
                  <article key={item.id} className="store-mode-card">
                    <div className="store-mode-card-head">
                      <div className="store-mode-meta">
                        <strong>{item.name || "Untitled product"}</strong>
                        <span>{getCategory(item)} {item.sku ? `• ${item.sku}` : ""}</span>
                      </div>
                      <div className="store-mode-price">{formatMoney(getUnitPrice(item), item.currency || "GHS")}</div>
                    </div>
                    <div className="store-mode-card-foot">
                      <span className={`store-mode-stock-pill ${stockClass}`}>Stock {stock}</span>
                      <div className="store-mode-stepper">
                        <button
                          type="button"
                          className="store-mode-stepper-btn"
                          onClick={() => removeFromOrder(Number(item.id))}
                          disabled={!selectedQty}
                          aria-label={`Remove ${item.name}`}
                        >
                          <AppIcon icon={faMinus} />
                        </button>
                        <span>{selectedQty}</span>
                        <button
                          type="button"
                          className="store-mode-stepper-btn"
                          onClick={() => addToOrder(item)}
                          disabled={stock <= 0 || selectedQty >= stock}
                          aria-label={`Add ${item.name}`}
                        >
                          <AppIcon icon={faPlus} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="store-mode-empty">No products match the current filters.</p>
            )}
          </div>
        </section>

        <aside className="store-mode-panel store-mode-builder">
          <div className="store-mode-panel-header">
            <div>
              <p className="store-mode-eyebrow">Checkout</p>
              <h2>Current sale</h2>
            </div>
            <span className="store-mode-count">
              <AppIcon icon={faReceipt} /> {orderItems.reduce((sum, item) => sum + item.quantity, 0)} items
            </span>
          </div>

          <div className="store-mode-summary">
            <article className="store-mode-stat">
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal, orderCurrency)}</strong>
            </article>
            <article className="store-mode-stat">
              <span>Discount</span>
              <strong>{formatMoney(discountAmount, orderCurrency)}</strong>
            </article>
            <article className="store-mode-stat">
              <span>Total</span>
              <strong>{formatMoney(total, orderCurrency)}</strong>
            </article>
          </div>

          <div className="store-mode-lines">
            {orderItems.length ? (
              orderItems.map((item) => (
                <div key={item.productId} className="store-mode-line">
                  <div className="store-mode-meta">
                    <strong>{item.name}</strong>
                    <span>{formatMoney(item.unitPrice, item.currency)} each</span>
                  </div>
                  <div className="store-mode-line-actions">
                    <div className="store-mode-stepper">
                      <button
                        type="button"
                        className="store-mode-stepper-btn"
                        onClick={() => removeFromOrder(item.productId)}
                        aria-label={`Reduce ${item.name}`}
                      >
                        <AppIcon icon={faMinus} />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        className="store-mode-stepper-btn"
                        onClick={() => {
                          const product = items.find((entry) => Number(entry.id) === item.productId);
                          if (product) addToOrder(product);
                        }}
                        disabled={item.quantity >= item.stock}
                        aria-label={`Increase ${item.name}`}
                      >
                        <AppIcon icon={faPlus} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="store-mode-stepper-btn is-danger"
                      onClick={() => clearLineFromOrder(item.productId)}
                      aria-label={`Remove ${item.name} from sale`}
                    >
                      <AppIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="store-mode-empty">Select products from the inventory list to begin a sale.</p>
            )}
          </div>

          <div className="store-mode-form-grid">
            <label className="store-mode-field">
              <span>Customer name</span>
              <input
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Walk-in customer"
              />
            </label>
            <label className="store-mode-field">
              <span>Email or WhatsApp</span>
              <input
                type="text"
                value={customerContact}
                onChange={(event) => setCustomerContact(event.target.value)}
                placeholder="Optional receipt destination"
              />
              <small>
                {customerContact.trim()
                  ? receiptContact.isValid
                    ? `Receipt route: ${receiptContact.channel === "email" ? "email" : "WhatsApp"}`
                    : "Enter a valid email or phone number"
                  : "Leave blank to skip the receipt"}
              </small>
            </label>
            <label className="store-mode-field">
              <span>Payment method</span>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                {PAYMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {paymentMethod === "momo" ? (
              <label className="store-mode-field">
                <span>MoMo reference</span>
                <input
                  type="text"
                  value={momoReference}
                  onChange={(event) => setMomoReference(event.target.value)}
                  placeholder="Transaction reference"
                />
              </label>
            ) : (
              <label className="store-mode-field">
                <span>Cash received</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                  placeholder="0.00"
                />
                <small>
                  {cashShortfall > 0
                    ? `Short by ${formatMoney(cashShortfall, orderCurrency)}`
                    : changeDue > 0
                      ? `Change due ${formatMoney(changeDue, orderCurrency)}`
                      : "Cash is balanced"}
                </small>
              </label>
            )}
            <label className="store-mode-field">
              <span>Discount type</span>
              <select value={discountType} onChange={(event) => setDiscountType(event.target.value)}>
                <option value="amount">Amount</option>
                <option value="percent">Percent</option>
              </select>
            </label>
            <label className="store-mode-field">
              <span>Discount value</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                placeholder="0.00"
              />
            </label>
          </div>

          <div className="store-mode-total-row">
            <span>Total due</span>
            <strong>{formatMoney(total, orderCurrency)}</strong>
          </div>

          <div className="store-mode-actions">
            <button type="button" className="store-mode-button is-ghost" onClick={clearOrder} disabled={!orderItems.length || submitting}>
              Clear sale
            </button>
            <button type="button" className="store-mode-button" onClick={() => submitSale({ payLater: false })} disabled={submitting || !orderItems.length}>
              {submitting ? "Saving..." : "Record paid sale"}
            </button>
            <button
              type="button"
              className="store-mode-button is-ghost"
              onClick={() => submitSale({ payLater: true })}
              disabled={submitting || !canSavePayLater}
            >
              Save pay later
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default StoreMode;
