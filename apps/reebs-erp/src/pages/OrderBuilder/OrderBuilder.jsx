/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./OrderBuilder.css";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import { useAuth } from "../../components/AuthContext/AuthContext";
import SearchField from "../../components/SearchField/SearchField";

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

const getQuantity = (item) => {
  const raw = item?.quantity ?? item?.stock ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeCurrency = (currency) => {
  if (typeof currency !== "string") return "GBP";
  const trimmed = currency.trim();
  return trimmed ? trimmed.toUpperCase() : "GBP";
};

const normalizeCode = (value) => (value || "").toString().trim().toLowerCase();

const formatCurrency = (amount, currency = "GBP") => {
  const normalizedCurrency = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch (err) {
    const value = Number(amount || 0).toFixed(2);
    if (normalizedCurrency === "GBP") return `£${value}`;
    if (normalizedCurrency === "USD") return `$${value}`;
    if (normalizedCurrency === "EUR") return `€${value}`;
    if (normalizedCurrency === "NGN") return `₦${value}`;
    return `${normalizedCurrency} ${value}`;
  }
};

function OrderBuilder() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [status, setStatus] = useState("pending");
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");
  const [orderDiscount, setOrderDiscount] = useState("");
  const [discountType, setDiscountType] = useState("amount");
  const [scanFeedback, setScanFeedback] = useState(null);
  const scanTimeoutRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError("");
      try {
        const [customerRes, inventoryRes] = await Promise.all([
          fetch("/.netlify/functions/customers"),
          fetch("/.netlify/functions/inventory"),
        ]);

        if (!customerRes.ok || !inventoryRes.ok) {
          throw new Error("Failed to load order data.");
        }

        const [customerData, inventoryData] = await Promise.all([
          customerRes.json(),
          inventoryRes.json(),
        ]);

        const inventoryOnly = (Array.isArray(inventoryData) ? inventoryData : []).filter(
          (item) => {
            const source = (item.sourceCategoryCode || item.sourcecategorycode || "").toString().toLowerCase();
            if (!source) return true;
            return source !== "rental";
          }
        );

        setCustomers(Array.isArray(customerData) ? customerData : []);
        setProducts(inventoryOnly);
      } catch (err) {
        console.error("Failed to load order data", err);
        setError("We couldn't load customers or products.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const findProductByCode = (code) => {
    const normalized = normalizeCode(code);
    if (!normalized) return null;
    return (
      products.find((product) => {
        const barcode = normalizeCode(product?.barcode);
        const sku = normalizeCode(product?.sku);
        return (barcode && barcode === normalized) || (sku && sku === normalized);
      }) || null
    );
  };

  const pushScanFeedback = (type, message) => {
    setScanFeedback({ type, message });
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    scanTimeoutRef.current = setTimeout(() => {
      setScanFeedback(null);
    }, 2500);
  };

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => {
      return (
        customer.name?.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query)
      );
    });
  }, [customers, customerQuery]);

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    const list = [...products].sort((a, b) => {
      const nameA = (a?.name || "").toLowerCase();
      const nameB = (b?.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
    if (!query) return list;
    return list.filter((item) => {
      return (
        item.name?.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query) ||
        item.barcode?.toLowerCase().includes(query)
      );
    });
  }, [products, productQuery]);

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((customer) => String(customer.id) === String(selectedCustomerId)) || null;
  }, [customers, selectedCustomerId]);

  const orderSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cartItems]
  );

  const discountAmount = useMemo(() => {
    const raw = Number(orderDiscount) || 0;
    if (discountType === "percent") {
      return Math.max(0, orderSubtotal * (raw / 100));
    }
    return Math.max(0, raw);
  }, [discountType, orderDiscount, orderSubtotal]);

  const orderTotal = useMemo(
    () => Math.max(0, orderSubtotal - discountAmount),
    [orderSubtotal, discountAmount]
  );

  const orderCurrency = useMemo(() => {
    if (!cartItems.length) return "GBP";
    const currencies = new Set(
      cartItems.map((item) => normalizeCurrency(item.currency || "GBP"))
    );
    if (currencies.size === 1) return [...currencies][0];
    return "MIXED";
  }, [cartItems]);

  const addToCart = (product) => {
    const stock = getQuantity(product);
    if (stock <= 0) return;
    setCartItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= stock) return prev;
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: getUnitPrice(product),
          currency: normalizeCurrency(product.currency || "GBP"),
          quantity: 1,
          stock,
        },
      ];
    });
  };

  const handleProductScan = (event) => {
    if (event.key !== "Enter") return;
    const rawValue = event.currentTarget.value || "";
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) return;
    const match = findProductByCode(trimmedValue);
    if (!match) {
      pushScanFeedback("error", `No product found for "${trimmedValue}".`);
      return;
    }
    event.preventDefault();
    addToCart(match);
    setProductQuery("");
    pushScanFeedback("success", `Added ${match.name || match.sku || match.barcode || "item"}.`);
  };

  const updateCartQuantity = (productId, nextValue) => {
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const next = Math.max(1, Math.min(item.stock, Number(nextValue) || 1));
          return { ...item, quantity: next };
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const updateCartPrice = (productId, nextValue) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const value = Number(nextValue);
        return { ...item, unitPrice: Number.isFinite(value) && value >= 0 ? value : item.unitPrice };
      })
    );
  };

  const removeFromCart = (productId) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleSubmit = async () => {
    setSubmitError("");
    setSuccess("");

    if (!selectedCustomerId) {
      setSubmitError("Select a customer before creating the order.");
      return;
    }

    if (!cartItems.length) {
      setSubmitError("Add at least one product to the order.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/.netlify/functions/createOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(selectedCustomerId),
          status,
          items: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.unitPrice,
          })),
          discount: discountAmount,
          userId: user?.id,
          userName: user?.fullName || user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined,
          userEmail: user?.email,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create order.");
      }

      setSuccess(`Order #${payload.orderId} created.`);
      setCartItems([]);
      setProducts((prev) =>
        prev.map((product) => {
          const match = cartItems.find((item) => item.productId === product.id);
          if (!match) return product;
          const updatedStock = Math.max(getQuantity(product) - match.quantity, 0);
          return { ...product, quantity: updatedStock, stock: updatedStock };
        })
      );
    } catch (err) {
      console.error("Order creation failed", err);
      setSubmitError(err.message || "Failed to create order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="order-builder">
      <div className="order-shell">
        <AdminBreadcrumb items={[{ label: "Orders", to: "/admin/orders" }, { label: "New" }]} />
        <header className="order-header">
          <div>
            <p className="order-eyebrow">Order builder</p>
            <h1>Create Order</h1>
            <p className="order-subtitle">
              Select a customer, add products, and confirm stock updates in one flow.
            </p>
          </div>
          <div className="order-status">
            <a className="order-back-link" href="/admin/orders">
              View orders
            </a>
            <label>
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>
        </header>

        {loading && <p className="order-status-text">Loading customers and products...</p>}
        {!loading && error && <p className="order-error">{error}</p>}

        {!loading && !error && (
          <div className="order-grid">
            <section className="order-panel">
              <div className="order-panel-header">
                <h3>Customer</h3>
                <span>{customers.length} profiles</span>
              </div>
              <label className="order-field">
                Search customer
                <SearchField
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  onClear={() => setCustomerQuery("")}
                  placeholder="Search by name, email, phone"
                  aria-label="Search customer"
                />
              </label>
              <label className="order-field">
                Select customer
                <select
                  value={selectedCustomerId}
                  onChange={(event) => setSelectedCustomerId(event.target.value)}
                >
                  <option value="">Choose a customer</option>
                  {filteredCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.email ? `- ${customer.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {selectedCustomer && (
                <div className="order-customer-card">
                  <h4>{selectedCustomer.name}</h4>
                  <p>{selectedCustomer.email || "No email on file"}</p>
                  <p>{selectedCustomer.phone || "No phone on file"}</p>
                </div>
              )}
            </section>

            <section className="order-panel order-products">
              <div className="order-panel-header">
                <h3>Products</h3>
                <span>{products.length} items</span>
              </div>
              <label className="order-field">
                Search or scan products
                <SearchField
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  onClear={() => setProductQuery("")}
                  onKeyDown={handleProductScan}
                  placeholder="Search by name, SKU, or barcode"
                  aria-label="Search or scan products"
                />
              </label>
              {scanFeedback && (
                <p className={scanFeedback.type === "error" ? "order-error" : "order-success"}>
                  {scanFeedback.message}
                </p>
              )}
              <div className="order-product-list">
                {filteredProducts.map((product) => {
                  const stock = getQuantity(product);
                  return (
                    <div key={product.id} className="order-product-row">
                      <div>
                        <h4>{product.name || "Untitled"}</h4>
                        <p>
                          {product.sku ? `SKU ${product.sku}` : "No SKU"}
                          {product.barcode ? ` · Barcode ${product.barcode}` : ""} · Stock {stock}
                        </p>
                      </div>
                      <div className="order-product-actions">
                        <span>{formatCurrency(getUnitPrice(product), product.currency)}</span>
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          disabled={stock <= 0}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!filteredProducts.length && (
                  <p className="order-empty">No products match your search.</p>
                )}
              </div>
            </section>

            <section className="order-panel order-summary">
              <div className="order-panel-header">
                <h3>Order summary</h3>
                <span>{cartItems.length} items</span>
              </div>
              {!cartItems.length && (
                <p className="order-empty">Add products to start the order.</p>
              )}
              {cartItems.map((item) => (
                <div key={item.productId} className="order-cart-row">
                  <div>
                    <h4>{item.name}</h4>
                    <p>{formatCurrency(item.unitPrice, item.currency)} each</p>
                  </div>
                  <div className="order-cart-actions">
                    <p>{item.unitPrice}</p>
                    <input
                      type="number"
                      min="1"
                      max={item.stock}
                      value={item.quantity}
                      onChange={(event) => updateCartQuantity(item.productId, event.target.value)}
                    />
                    <button type="button" onClick={() => removeFromCart(item.productId)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div className="order-total">
                <div className="order-total-left">
                  <span>Discount</span>
                  <div className="order-discount-input">
                    <select
                      value={discountType}
                      onChange={(event) => setDiscountType(event.target.value)}
                      aria-label="Discount type"
                    >
                      <option value="amount">Amount</option>
                      <option value="percent">Percent</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step={discountType === "percent" ? "1" : "0.01"}
                      value={orderDiscount}
                      onChange={(event) => setOrderDiscount(event.target.value)}
                      placeholder={discountType === "percent" ? "0" : "0.00"}
                    />
                  </div>
                </div>
                <div className="order-total-right">
                  <span>Total</span>
                  <strong>
                    {orderCurrency === "MIXED"
                      ? `${orderCurrency} ${orderTotal.toFixed(2)}`
                      : formatCurrency(orderTotal, orderCurrency)}
                  </strong>
                </div>
              </div>
              {submitError && <p className="order-error">{submitError}</p>}
              {success && <p className="order-success">{success}</p>}
              <button
                type="button"
                className="order-submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Creating order..." : "Create order"}
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderBuilder;
