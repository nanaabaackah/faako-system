/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { SelectField } from "@faako/ui";
import "./OrderBuilder.css";
import { computeVisibleProducts, PRODUCT_SHOW_ALL_THRESHOLD } from "./orderBuilderUtils.js";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { InlineNotice } from "../../components/InlineNotice/InlineNotice";
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

const getItemType = (item) =>
  String(item?.itemType || item?.inventoryItemType || "STANDARD").trim().toUpperCase() || "STANDARD";

const isVariantParent = (item) => getItemType(item) === "VARIANT_PARENT";

const getVariants = (item) => (Array.isArray(item?.variants) ? item.variants : []);

const getVariantAvailableQty = (variant) => {
  const explicit = Number(variant?.availableQty);
  if (Number.isFinite(explicit)) return Math.max(0, explicit);
  return Math.max(0, Number(variant?.stockQty ?? 0) - Number(variant?.reservedQty ?? 0));
};

const getVariantPrice = (product, variant) => {
  if (variant?.priceOverride === null || typeof variant?.priceOverride === "undefined" || variant?.priceOverride === "") {
    return getUnitPrice(product);
  }
  const override = Number(variant?.priceOverride);
  return Number.isFinite(override) ? override : getUnitPrice(product);
};

const formatVariantName = (product, variant) =>
  [product?.name, variant?.variantName, variant?.variantNumber, variant?.color, variant?.size]
    .filter(Boolean)
    .join(" / ");

const getOrderLineKey = (productId, variantId = "") => `${productId}:${variantId || "standard"}`;

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
  const [variantDigitInputs, setVariantDigitInputs] = useState({});
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
    const controller = new AbortController();
    const fetchAll = async () => {
      setLoading(true);
      setError("");
      try {
        const [customerRes, inventoryRes] = await Promise.all([
          fetch("/.netlify/functions/customers", { signal: controller.signal }),
          fetch("/.netlify/functions/inventory", { signal: controller.signal }),
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
        if (err.name === "AbortError") return;
        console.error("Failed to load order data", err);
        setError("We couldn't load customers or products.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchAll();
    return () => controller.abort();
  }, []);

  const findProductByCode = (code) => {
    const normalized = normalizeCode(code);
    if (!normalized) return null;
    for (const product of products) {
      const barcode = normalizeCode(product?.barcode);
      const sku = normalizeCode(product?.sku);
      if ((barcode && barcode === normalized) || (sku && sku === normalized)) {
        return { product };
      }
      const variant = getVariants(product).find((entry) => normalizeCode(entry?.sku) === normalized);
      if (variant) {
        return { product, variant };
      }
    }
    return null;
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
      const variantMatch = getVariants(item).some((variant) =>
        [variant.sku, variant.variantName, variant.variantNumber, variant.color, variant.size]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      );
      return (
        item.name?.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query) ||
        item.barcode?.toLowerCase().includes(query) ||
        variantMatch
      );
    });
  }, [products, productQuery]);

  const { items: visibleProducts, capped: productListCapped } = useMemo(
    () => computeVisibleProducts(filteredProducts, productQuery, PRODUCT_SHOW_ALL_THRESHOLD),
    [filteredProducts, productQuery],
  );

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

  const addToCart = (product, variant = null) => {
    if (isVariantParent(product) && !variant) {
      pushScanFeedback("error", `Choose a variant for ${product.name || "this product"}.`);
      return false;
    }
    const stock = variant ? getVariantAvailableQty(variant) : getQuantity(product);
    if (stock <= 0) return false;
    const lineId = getOrderLineKey(product.id, variant?.id);
    setCartItems((prev) => {
      const existing = prev.find((item) => item.lineId === lineId);
      if (existing) {
        if (existing.quantity >= stock) return prev;
        return prev.map((item) =>
          item.lineId === lineId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          lineId,
          productId: product.id,
          variantId: variant?.id || null,
          name: variant ? formatVariantName(product, variant) : product.name,
          productName: product.name,
          unitPrice: variant ? getVariantPrice(product, variant) : getUnitPrice(product),
          currency: normalizeCurrency(product.currency || "GBP"),
          quantity: 1,
          stock,
        },
      ];
    });
    return true;
  };

  const addDigitSequenceToCart = (product) => {
    const rawDigits = String(variantDigitInputs[product.id] || "").replace(/\D/g, "");
    if (!rawDigits) {
      pushScanFeedback("error", "Enter the balloon number first.");
      return;
    }
    const variants = getVariants(product);
    const missing = [];
    let addedCount = 0;
    rawDigits.split("").forEach((digit) => {
      const variant = variants.find((entry) => String(entry.variantNumber) === digit);
      if (!variant) {
        missing.push(digit);
        return;
      }
      if (addToCart(product, variant)) addedCount += 1;
    });
    if (missing.length) {
      pushScanFeedback("error", `No variant found for ${[...new Set(missing)].join(", ")}.`);
      return;
    }
    if (!addedCount) {
      pushScanFeedback("error", "Those variants are out of stock.");
      return;
    }
    setVariantDigitInputs((prev) => ({ ...prev, [product.id]: "" }));
    pushScanFeedback("success", `Added ${product.name || "variants"} / ${rawDigits}.`);
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
    const added = addToCart(match.product, match.variant || null);
    if (!added) return;
    setProductQuery("");
    pushScanFeedback("success", `Added ${match.variant ? formatVariantName(match.product, match.variant) : match.product.name || match.product.sku || match.product.barcode || "item"}.`);
  };

  const updateCartQuantity = (lineId, nextValue) => {
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.lineId !== lineId) return item;
          const next = Math.max(1, Math.min(item.stock, Number(nextValue) || 1));
          return { ...item, quantity: next };
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const updateCartPrice = (lineId, nextValue) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.lineId !== lineId) return item;
        const value = Number(nextValue);
        return { ...item, unitPrice: Number.isFinite(value) && value >= 0 ? value : item.unitPrice };
      })
    );
  };

  const removeFromCart = (lineId) => {
    setCartItems((prev) => prev.filter((item) => item.lineId !== lineId));
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
    const controller = new AbortController();
    const idempotencyKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const response = await fetch("/.netlify/functions/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          customerId: Number(selectedCustomerId),
          status,
          source: "Manual Admin Entry",
          purchaseChannel: "Admin",
          fulfillmentMethod: "Pickup",
          deliveryMethod: "pickup",
          deliveryRequired: false,
          type: "retail",
          items: cartItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId || undefined,
            quantity: item.quantity,
            price: item.unitPrice,
          })),
          discount: discountAmount,
          userId: user?.id,
          userName: user?.fullName || user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined,
          userEmail: user?.email,
        }),
        signal: controller.signal,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create order.");
      }

      setSuccess(`Order #${payload.orderId} created.`);
      setCartItems([]);
      if (payload?.stockCommitted === true) {
        setProducts((prev) =>
          prev.map((product) => {
            const matches = cartItems.filter((item) => Number(item.productId) === Number(product.id));
            if (!matches.length) return product;
            if (matches.some((item) => item.variantId)) {
              const variants = getVariants(product).map((variant) => {
                const variantQty = matches
                  .filter((item) => Number(item.variantId) === Number(variant.id))
                  .reduce((sum, item) => sum + item.quantity, 0);
                if (!variantQty) return variant;
                const nextStock = Math.max(Number(variant.stockQty || 0) - variantQty, 0);
                return {
                  ...variant,
                  stockQty: nextStock,
                  availableQty: Math.max(nextStock - Number(variant.reservedQty || 0), 0),
                };
              });
              const updatedStock = variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stockQty) || 0), 0);
              return { ...product, variants, quantity: updatedStock, stock: updatedStock };
            }
            const orderedQty = matches.reduce((sum, item) => sum + item.quantity, 0);
            const updatedStock = Math.max(getQuantity(product) - orderedQty, 0);
            return { ...product, quantity: updatedStock, stock: updatedStock };
          })
        );
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Order creation failed", err);
      setSubmitError(err.message || "Failed to create order.");
    } finally {
      if (!controller.signal.aborted) setSubmitting(false);
    }
  };

  return (
    <div className="order-builder">
      <div className="order-shell">
        <AdminBreadcrumb items={[{ label: "Orders", to: "/admin/orders" }, { label: "New" }]} />
        <AdminPageHeader
          eyebrow="Order builder"
          title="Create Order"
          subtitle="Select a customer, add products, and confirm stock updates in one flow."
          actionsClassName="order-status"
          actions={
            <>
              <a className="order-back-link" href="/admin/orders">
                View orders
              </a>
              <label>
                Status
                <SelectField value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="cancelled">Cancelled</option>
                </SelectField>
              </label>
            </>
          }
        />

        {loading && <p className="order-status-text">Loading customers and products...</p>}
        {!loading && error && (
          <InlineNotice
            tone="error"
            title="Order builder unavailable"
            message={error}
          />
        )}

        {!loading && !error && (
          <div className="order-grid">
            <section className="glass-card order-panel order-products">
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
                <InlineNotice
                  tone={scanFeedback.type === "error" ? "error" : "success"}
                  title={scanFeedback.type === "error" ? "Product not found" : "Item added to order"}
                  message={scanFeedback.message}
                  compact
                />
              )}
              <div className="order-product-list">
                {productListCapped && (
                  <p className="order-empty">
                    Showing first {PRODUCT_SHOW_ALL_THRESHOLD} of {filteredProducts.length} products — search to narrow down.
                  </p>
                )}
                {visibleProducts.map((product) => {
                  const stock = getQuantity(product);
                  const variants = getVariants(product).filter((variant) => String(variant.status || "active") === "active");
                  const hasVariants = isVariantParent(product);
                  return (
                    <div key={product.id} className="order-product-row">
                      <div>
                        <h4>{product.name || "Untitled"}</h4>
                        <p>
                          {product.sku ? `SKU ${product.sku}` : "No SKU"}
                          {product.barcode ? ` · Barcode ${product.barcode}` : ""} · Stock {stock}
                          {hasVariants ? ` · ${variants.length} variants` : ""}
                        </p>
                        {hasVariants && (
                          <div className="order-variant-picker">
                            <div className="order-digit-entry">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={variantDigitInputs[product.id] || ""}
                                onChange={(event) =>
                                  setVariantDigitInputs((prev) => ({
                                    ...prev,
                                    [product.id]: event.target.value,
                                  }))
                                }
                                placeholder="e.g. 18"
                                aria-label={`Digits for ${product.name}`}
                              />
                              <button type="button" onClick={() => addDigitSequenceToCart(product)}>
                                Add digits
                              </button>
                            </div>
                            <div className="order-variant-buttons">
                              {variants.slice(0, 12).map((variant) => (
                                <button
                                  key={variant.id}
                                  type="button"
                                  onClick={() => addToCart(product, variant)}
                                  disabled={getVariantAvailableQty(variant) <= 0}
                                >
                                  {formatVariantName(product, variant).replace(`${product.name} / `, "")}
                                  <small>{getVariantAvailableQty(variant)} left</small>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="order-product-actions">
                        <span>{formatCurrency(getUnitPrice(product), product.currency)}</span>
                        {!hasVariants && (
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            disabled={stock <= 0}
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!visibleProducts.length && (
                  <p className="order-empty">No products match your search.</p>
                )}
              </div>
            </section>

            <div className="order-right-col">
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
                  <SelectField
                    value={selectedCustomerId}
                    onChange={(event) => setSelectedCustomerId(event.target.value)}
                  >
                    <option value="">Choose a customer</option>
                    {filteredCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.email ? `- ${customer.email}` : ""}
                      </option>
                    ))}
                  </SelectField>
                </label>
                {selectedCustomer && (
                  <div className="glass-card order-customer-card">
                    <h4>{selectedCustomer.name}</h4>
                    <p>{selectedCustomer.email || "No email on file"}</p>
                    <p>{selectedCustomer.phone || "No phone on file"}</p>
                  </div>
                )}
              </section>

              <section className="glass-card order-panel order-summary">
              <div className="order-panel-header">
                <h3>Order summary</h3>
                <span>{cartItems.length} items</span>
              </div>
              {!cartItems.length && (
                <p className="order-empty">Add products to start the order.</p>
              )}
              {cartItems.map((item) => (
                <div key={item.lineId} className="order-cart-row">
                  <div>
                    <h4>{item.name}</h4>
                    <p>
                      {formatCurrency(item.unitPrice, item.currency)} each
                      {item.variantId ? " · Variant stock" : ""}
                    </p>
                  </div>
                  <div className="order-cart-actions">
                    <p>{item.unitPrice}</p>
                    <input
                      type="number"
                      min="1"
                      max={item.stock}
                      value={item.quantity}
                      onChange={(event) => updateCartQuantity(item.lineId, event.target.value)}
                    />
                    <button type="button" onClick={() => removeFromCart(item.lineId)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div className="order-total">
                <div className="order-total-left">
                  <span>Discount</span>
                  <div className="order-discount-input">
                    <SelectField
                      value={discountType}
                      onChange={(event) => setDiscountType(event.target.value)}
                      aria-label="Discount type"
                    >
                      <option value="amount">Amount</option>
                      <option value="percent">Percent</option>
                    </SelectField>
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
              {submitError && (
                <InlineNotice
                  tone="error"
                  title="Order not created"
                  message={submitError}
                />
              )}
              {success && (
                <InlineNotice
                  tone="success"
                  title="Order created"
                  message={success}
                />
              )}
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
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderBuilder;
