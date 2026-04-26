/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { StoreModeLayout } from "./components/StoreModeLayout";
import {
  EMAIL_PATTERN,
  LOW_STOCK_THRESHOLD,
  applyInventoryLineQuantityDelta,
  clearStoreModeDraft,
  buildProductSearchText,
  findVariantById,
  getAvailableQuantity,
  getActiveItemVariants,
  getCategory,
  getCustomerLabel,
  getQuantity,
  getStoreModeDraftKey,
  getProductLineKey,
  getUnitPrice,
  getVariantAvailableQty,
  getVariantUnitPrice,
  formatVariantLabel,
  isSaleableProduct,
  isVariantParentItem,
  normalizePhoneDigits,
  normalizeText,
  parseReceiptContact,
  readStoreModeDraft,
  sanitizeDraftCustomer,
  sanitizeDraftOrderItems,
  sanitizeDraftString,
  sortCustomersByName,
  todayValue,
  writeStoreModeDraft,
} from "./storeModeShared";
import "./StoreMode.css";

function StoreMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const customerPickerRef = useRef(null);
  const restoredDraftKeyRef = useRef("");
  const [hoveredImage, setHoveredImage] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState({});
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [error, setError] = useState("");
  const [customersError, setCustomersError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "item", direction: "asc" });
  const [orderItems, setOrderItems] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [momoReference, setMomoReference] = useState("");
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");
  const draftStorageKey = useMemo(() => getStoreModeDraftKey(user), [user]);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia("(max-width: 1024px)");
    const syncViewport = (event) => setIsMobileViewport(event.matches);

    setIsMobileViewport(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
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

  const refreshCustomers = useCallback(async () => {
    setCustomersLoading(true);
    setCustomersError("");
    try {
      const response = await fetch("/.netlify/functions/customers");
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load customers.");
      }
      setCustomers(sortCustomersByName(Array.isArray(payload) ? payload : []));
    } catch (nextError) {
      setCustomersError(nextError.message || "Unable to load customers.");
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCustomers();
  }, [refreshCustomers]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handlePointerDown = (event) => {
      if (!customerPickerRef.current?.contains(event.target)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!draftStorageKey || restoredDraftKeyRef.current === draftStorageKey) return;
    const draft = readStoreModeDraft(draftStorageKey);
    if (draft) {
      setSelectedProductId(Number.isFinite(Number(draft.selectedProductId)) ? Number(draft.selectedProductId) : null);
      setOrderItems(sanitizeDraftOrderItems(draft.orderItems));
      setCustomerName(sanitizeDraftString(draft.customerName, 160));
      setCustomerContact(sanitizeDraftString(draft.customerContact, 160));
      setSelectedCustomer(sanitizeDraftCustomer(draft.selectedCustomer));
      setPaymentMethod(draft.paymentMethod === "momo" ? "momo" : "cash");
      setMomoReference(sanitizeDraftString(draft.momoReference, 120));
      setDiscountType(draft.discountType === "percent" ? "percent" : "amount");
      setDiscountValue(sanitizeDraftString(draft.discountValue, 32));
      setCashReceived(sanitizeDraftString(draft.cashReceived, 32));
      setCustomerDropdownOpen(false);
      setSubmitError("");
      setSuccess("");
    }
    restoredDraftKeyRef.current = draftStorageKey;
  }, [draftStorageKey]);

  const categories = useMemo(() => {
    const values = new Set();
    items.forEach((item) => {
      const category = getCategory(item);
      if (category) values.add(category);
    });
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [items]);

  const orderQtyByLineKey = useMemo(
    () =>
      orderItems.reduce((map, item) => {
        const lineKey = item.lineKey || getProductLineKey(item.productId, item.variantId);
        map.set(lineKey, (map.get(lineKey) || 0) + item.quantity);
        return map;
      }, new Map()),
    [orderItems]
  );

  const orderQtyByProductId = useMemo(
    () =>
      orderItems.reduce((map, item) => {
        const productId = Number(item.productId);
        map.set(productId, (map.get(productId) || 0) + item.quantity);
        return map;
      }, new Map()),
    [orderItems]
  );

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items
      .filter((item) => {
        const stock = getAvailableQuantity(item, orderQtyByLineKey);
        if (needle) {
          const haystack = buildProductSearchText(item);
          if (!haystack.includes(needle)) return false;
        }
        if (categoryFilter !== "all" && getCategory(item) !== categoryFilter) return false;
        if (stockFilter === "in" && stock <= 0) return false;
        if (stockFilter === "low" && (stock <= 0 || stock > LOW_STOCK_THRESHOLD)) return false;
        if (stockFilter === "out" && stock > 0) return false;
        return true;
      })
      .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || "")));
  }, [categoryFilter, items, orderQtyByLineKey, search, stockFilter]);

  const searchTerm = search.trim();
  const hasSearchQuery = Boolean(searchTerm);
  const visibleItems = useMemo(() => {
    if (!hasSearchQuery) return [];
    return filteredItems;
  }, [filteredItems, hasSearchQuery]);

  const emptyStateMessage = hasSearchQuery ? "No items match this filter." : "";

  const normalizedCustomerLookup = useMemo(() => normalizeText(customerName), [customerName]);
  const normalizedCustomerLookupLower = normalizedCustomerLookup.toLowerCase();
  const normalizedCustomerLookupPhone = normalizePhoneDigits(normalizedCustomerLookup);

  const customerMatches = useMemo(() => {
    if (!normalizedCustomerLookupLower && !normalizedCustomerLookupPhone) {
      return customers.slice(0, 8);
    }

    return customers
      .filter((customer) => {
        const haystack = [customer?.name || "", customer?.email || "", customer?.phone || ""]
          .join(" ")
          .toLowerCase();
        const customerPhone = normalizePhoneDigits(customer?.phone);
        return (
          haystack.includes(normalizedCustomerLookupLower) ||
          (normalizedCustomerLookupPhone && customerPhone.includes(normalizedCustomerLookupPhone))
        );
      })
      .slice(0, 8);
  }, [customers, normalizedCustomerLookupLower, normalizedCustomerLookupPhone]);

  const hasExactCustomerMatch = useMemo(() => {
    if (!normalizedCustomerLookup) return false;
    return customers.some((customer) => {
      const customerNameValue = normalizeText(customer?.name).toLowerCase();
      const customerEmailValue = normalizeText(customer?.email).toLowerCase();
      const customerPhoneValue = normalizePhoneDigits(customer?.phone);
      return (
        customerNameValue === normalizedCustomerLookupLower ||
        customerEmailValue === normalizedCustomerLookupLower ||
        (normalizedCustomerLookupPhone && customerPhoneValue === normalizedCustomerLookupPhone)
      );
    });
  }, [customers, normalizedCustomerLookup, normalizedCustomerLookupLower, normalizedCustomerLookupPhone]);

  const showAddCustomerOption = Boolean(normalizedCustomerLookup) && !hasExactCustomerMatch;

  const sortedVisibleItems = useMemo(() => {
    const direction = sortConfig.direction === "asc" ? 1 : -1;
    const compareText = (left, right) => left.localeCompare(right) * direction;
    const compareNumber = (left, right) => (left - right) * direction;

    return [...visibleItems].sort((left, right) => {
      const leftOutOfStock = getAvailableQuantity(left, orderQtyById.get(Number(left?.id)) || 0) <= 0;
      const rightOutOfStock = getAvailableQuantity(right, orderQtyById.get(Number(right?.id)) || 0) <= 0;
      if (leftOutOfStock !== rightOutOfStock) {
        return leftOutOfStock ? 1 : -1;
      }

      switch (sortConfig.key) {
        case "sku":
          return compareText(
            String(left?.sku || `ID ${left?.id || ""}`),
            String(right?.sku || `ID ${right?.id || ""}`)
          );
        case "category":
          return compareText(getCategory(left), getCategory(right));
        case "price":
          return compareNumber(getUnitPrice(left), getUnitPrice(right));
        case "stock":
          return compareNumber(
            getAvailableQuantity(left, orderQtyById.get(Number(left?.id)) || 0),
            getAvailableQuantity(right, orderQtyById.get(Number(right?.id)) || 0)
          );
        case "item":
        default:
          return compareText(String(left?.name || ""), String(right?.name || ""));
      }
    });
  }, [orderQtyById, sortConfig.direction, sortConfig.key, visibleItems]);

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortIndicator = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const sortHeaderClassName = (key) =>
    `store-mode-sort-header${sortConfig.key === key ? " is-active" : ""}`;

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
  const inventoryById = useMemo(
    () => new Map(items.map((item) => [Number(item.id), item])),
    [items]
  );

  useEffect(() => {
    if (!items.length) return;
    setOrderItems((current) => {
      let changed = false;
      const next = current.map((item) => {
        const latest = inventoryById.get(Number(item.productId));
        if (!latest) return item;
        const liveVariant = item.variantId ? findVariantById(latest, item.variantId) : null;
        const syncedName = liveVariant
          ? formatVariantLabel(latest, liveVariant)
          : latest?.name || item.name;
        const synced = {
          ...item,
          lineKey: item.lineKey || getProductLineKey(item.productId, item.variantId),
          name: syncedName,
          productName: latest?.name || item.productName || item.name,
          variantLabel: liveVariant ? formatVariantLabel(latest, liveVariant) : item.variantLabel || "",
          unitPrice: liveVariant ? getVariantUnitPrice(latest, liveVariant) : getUnitPrice(latest),
          stock: liveVariant ? getVariantAvailableQty(liveVariant) : getQuantity(latest),
          currency: latest?.currency || item.currency || "GHS",
        };
        if (
          synced.name !== item.name ||
          synced.productName !== item.productName ||
          synced.variantLabel !== item.variantLabel ||
          synced.unitPrice !== item.unitPrice ||
          synced.stock !== item.stock ||
          synced.currency !== item.currency ||
          synced.lineKey !== item.lineKey
        ) {
          changed = true;
        }
        return synced;
      });
      return changed ? next : current;
    });
  }, [inventoryById, items.length]);

  useEffect(() => {
    setSelectedVariantIds((current) => {
      const next = {};

      items.forEach((item) => {
        if (!isVariantParentItem(item)) return;

        const itemKey = String(item.id);
        const variants = getActiveItemVariants(item);
        if (!variants.length) return;

        const currentSelected = findVariantById(item, current[itemKey]);
        const orderSelected = orderItems.find(
          (entry) => Number(entry.productId) === Number(item.id) && Number(entry.variantId) > 0
        );
        const preferredVariant =
          currentSelected
          || findVariantById(item, orderSelected?.variantId)
          || variants.find((variant) => getVariantAvailableQty(variant) > 0)
          || variants[0];

        if (preferredVariant?.id) {
          next[itemKey] = Number(preferredVariant.id);
        }
      });

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (
        currentKeys.length === nextKeys.length
        && nextKeys.every((key) => Number(current[key]) === Number(next[key]))
      ) {
        return current;
      }
      return next;
    });
  }, [items, orderItems]);

  const itemCount = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.quantity, 0),
    [orderItems]
  );
  const receiptChannel = receiptContact.isValid ? receiptContact.channel : "";
  const canCompleteSale =
    orderItems.length > 0 &&
    (!customerContact.trim() || Boolean(receiptChannel)) &&
    !(paymentMethod === "cash" && cashShortfall > 0) &&
    !(paymentMethod === "momo" && !normalizedMomoReference);
  const canPayLater = orderItems.length > 0 && receiptContact.channel === "email";

  useEffect(() => {
    if (!draftStorageKey || restoredDraftKeyRef.current !== draftStorageKey) return;
    const draft = {
      selectedProductId: Number.isFinite(Number(selectedProductId)) ? Number(selectedProductId) : null,
      orderItems,
      customerName,
      customerContact,
      selectedCustomer,
      paymentMethod,
      momoReference,
      discountType,
      discountValue,
      cashReceived,
    };
    const hasDraft =
      draft.orderItems.length > 0 ||
      Boolean(normalizeText(draft.customerName)) ||
      Boolean(normalizeText(draft.customerContact)) ||
      Boolean(draft.selectedCustomer?.id) ||
      draft.paymentMethod !== "cash" ||
      draft.discountType !== "amount" ||
      Boolean(normalizeText(draft.momoReference)) ||
      Boolean(normalizeText(draft.discountValue)) ||
      Boolean(normalizeText(draft.cashReceived));

    if (hasDraft) {
      writeStoreModeDraft(draftStorageKey, draft);
    } else {
      clearStoreModeDraft(draftStorageKey);
    }
  }, [
    cashReceived,
    customerContact,
    customerName,
    discountType,
    discountValue,
    draftStorageKey,
    momoReference,
    orderItems,
    paymentMethod,
    selectedCustomer,
    selectedProductId,
  ]);

  const addToOrder = (product, variant = null) => {
    const productId = Number(product?.id);
    if (!Number.isFinite(productId) || productId <= 0) return;

    const chosenVariant = isVariantParentItem(product)
      ? variant
        || findVariantById(product, selectedVariantIds[String(productId)])
        || getActiveItemVariants(product).find((entry) => getVariantAvailableQty(entry) > 0)
        || null
      : null;
    const lineKey = getProductLineKey(productId, chosenVariant?.id);
    const stock = chosenVariant
      ? Math.max(0, getVariantAvailableQty(chosenVariant) - (orderQtyByLineKey.get(lineKey) || 0))
      : getAvailableQuantity(product, orderQtyByLineKey);
    if (stock <= 0) return;

    setSelectedProductId(productId);
    if (chosenVariant?.id) {
      setSelectedVariantIds((prev) => {
        if (Number(prev[String(productId)]) === Number(chosenVariant.id)) return prev;
        return { ...prev, [productId]: Number(chosenVariant.id) };
      });
    }
    setOrderItems((current) => {
      const existing = current.find(
        (item) => (item.lineKey || getProductLineKey(item.productId, item.variantId)) === lineKey
      );
      if (existing) {
        if (existing.quantity >= existing.stock) return current;
        return current.map((item) =>
          (item.lineKey || getProductLineKey(item.productId, item.variantId)) === lineKey
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...current,
        {
          lineKey,
          productId,
          variantId: chosenVariant?.id || null,
          productName: product?.name || "Untitled",
          variantLabel: chosenVariant ? formatVariantLabel(product, chosenVariant) : "",
          name: chosenVariant ? formatVariantLabel(product, chosenVariant) : product?.name || "Untitled",
          unitPrice: chosenVariant ? getVariantUnitPrice(product, chosenVariant) : getUnitPrice(product),
          quantity: 1,
          stock: chosenVariant ? getVariantAvailableQty(chosenVariant) : getQuantity(product),
          currency: product?.currency || "GHS",
        },
      ];
    });
    setSubmitError("");
    setSuccess("");
  };

  const removeFromOrder = (lineKey) => {
    setOrderItems((current) =>
      current
        .map((item) =>
          (item.lineKey || getProductLineKey(item.productId, item.variantId)) === lineKey
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
    setSubmitError("");
    setSuccess("");
  };

  const clearLineFromOrder = (lineKey) => {
    setOrderItems((current) =>
      current.filter((item) => (item.lineKey || getProductLineKey(item.productId, item.variantId)) !== lineKey)
    );
    setSubmitError("");
    setSuccess("");
  };

  const clearOrder = () => {
    setOrderItems([]);
    setSelectedProductId(null);
    setCustomerName("");
    setCustomerContact("");
    setSelectedCustomer(null);
    setCustomerDropdownOpen(false);
    setPaymentMethod("cash");
    setMomoReference("");
    setDiscountType("amount");
    setDiscountValue("");
    setCashReceived("");
    setSubmitError("");
    setSuccess("");
    clearStoreModeDraft(draftStorageKey);
  };

  const showImagePreview = useCallback((src, name) => {
    if (!src) return;
    setHoveredImage({ src, name: name || "Product image" });
  }, []);

  const hideImagePreview = useCallback(() => {
    setHoveredImage(null);
  }, []);

  const upsertCustomerDirectory = useCallback((customer) => {
    if (!customer?.id) return;
    setCustomers((current) => {
      const next = current.some((item) => Number(item.id) === Number(customer.id))
        ? current.map((item) => (Number(item.id) === Number(customer.id) ? { ...item, ...customer } : item))
        : [customer, ...current];
      return sortCustomersByName(next);
    });
  }, []);

  const handleCustomerNameChange = (event) => {
    const nextValue = event.target.value;
    setCustomerName(nextValue);
    setCustomerDropdownOpen(true);
    setSubmitError("");
    setSuccess("");

    if (selectedCustomer) {
      const selectedLabel = normalizeText(getCustomerLabel(selectedCustomer));
      if (normalizeText(nextValue) !== selectedLabel) {
        setSelectedCustomer(null);
      }
    }
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomerName(getCustomerLabel(customer));
    setCustomerContact(customer?.email || customer?.phone || "");
    setCustomerDropdownOpen(false);
    setCustomersError("");
    setSubmitError("");
    setSuccess("");
  };

  const handleChooseAddCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName(normalizedCustomerLookup);
    setCustomerDropdownOpen(false);
    setSubmitError("");
    setSuccess("");
  };

  const ensureCustomer = async (contact) => {
    const typedValue = normalizeText(customerName);
    const typedValueIsEmail = EMAIL_PATTERN.test(typedValue);
    const name = typedValue || "Walk-in customer";
    const email =
      contact.channel === "email"
        ? contact.email
        : typedValueIsEmail
          ? typedValue.toLowerCase()
          : "";
    const phone = contact.channel === "whatsapp" ? contact.phone : "";

    if (selectedCustomer?.id) {
      const nextPayload = {
        id: Number(selectedCustomer.id),
        name,
        email: email || selectedCustomer.email || null,
        phone: phone || selectedCustomer.phone || null,
      };

      const hasChanges =
        normalizeText(selectedCustomer.name) !== nextPayload.name ||
        normalizeText(selectedCustomer.email).toLowerCase() !== String(nextPayload.email || "").toLowerCase() ||
        normalizePhoneDigits(selectedCustomer.phone) !== normalizePhoneDigits(nextPayload.phone);

      if (!hasChanges) {
        return selectedCustomer;
      }

      const response = await fetch("/.netlify/functions/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update customer details.");
      }
      setSelectedCustomer(payload);
      upsertCustomerDirectory(payload);
      return payload;
    }

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
    setSelectedCustomer(payload);
    setCustomerName(getCustomerLabel(payload));
    if (!customerContact.trim()) {
      setCustomerContact(payload?.email || payload?.phone || "");
    }
    upsertCustomerDirectory(payload);
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
            variantId: item.variantId || undefined,
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
          const lines = orderItems.filter((item) => Number(item.productId) === Number(product.id));
          if (!lines.length) return product;
          return lines.reduce(
            (nextProduct, lineItem) => applyInventoryLineQuantityDelta(nextProduct, lineItem, -1),
            product
          );
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
    <StoreModeLayout
      onExit={() => navigate("/admin")}
      onRefresh={refreshInventory}
      loading={loading}
      error={error}
      submitError={submitError}
      success={success}
      inventoryProps={{
        search,
        onSearchChange: (event) => setSearch(event.target.value),
        onSearchClear: () => setSearch(""),
        stockFilter,
        onStockFilterChange: setStockFilter,
        categoryFilter,
        onCategoryFilterChange: (event) => setCategoryFilter(event.target.value),
        categories,
        sortKey: sortConfig.key,
        sortHeaderClassName,
        requestSort,
        sortIndicator,
        loading,
        hasSearchQuery,
        visibleItems,
        emptyStateMessage,
        sortedVisibleItems,
        orderQtyByLineKey,
        orderQtyByProductId,
        selectedProductId,
        selectedVariantIds,
        onSelectVariant: (productId, variantId) =>
          setSelectedVariantIds((prev) => ({ ...prev, [productId]: Number(variantId) })),
        isMobileViewport,
        showImagePreview,
        hideImagePreview,
        addToOrder,
      }}
      customerProps={{
        customerPickerRef,
        customerName,
        onCustomerNameChange: handleCustomerNameChange,
        onCustomerFocus: () => setCustomerDropdownOpen(true),
        onCustomerKeyDown: (event) => {
          if (event.key === "Escape") {
            setCustomerDropdownOpen(false);
          }
        },
        customerDropdownOpen,
        customersLoading,
        customerMatches,
        selectedCustomer,
        onSelectCustomer: handleSelectCustomer,
        showAddCustomerOption,
        onChooseAddCustomer: handleChooseAddCustomer,
        normalizedCustomerLookup,
        customerContact,
        onCustomerContactChange: (event) => setCustomerContact(event.target.value),
        customersError,
      }}
      orderProps={{
        itemCount,
        clearOrder,
        orderItems,
        inventoryById,
        submitting,
        removeFromOrder,
        clearLineFromOrder,
        addToOrder,
        subtotal,
        discountAmount,
        total,
        orderCurrency,
      }}
      cartProps={{
        itemCount,
        orderItemsLength: orderItems.length,
        subtotal,
        discountAmount,
        total,
        orderCurrency,
        paymentMethod,
        onPaymentMethodChange: setPaymentMethod,
        discountType,
        onDiscountTypeChange: setDiscountType,
        discountValue,
        onDiscountValueChange: (event) => setDiscountValue(event.target.value),
        cashReceived,
        onCashReceivedChange: (event) => setCashReceived(event.target.value),
        changeDue,
        momoReference,
        onMomoReferenceChange: (event) => setMomoReference(event.target.value),
        submitSale,
        submitting,
        canCompleteSale,
        canPayLater,
        clearOrder,
      }}
      hoveredImage={hoveredImage}
    />
  );
}

export default StoreMode;
