/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faArrowLeft,
  faClock,
  faMinus,
  faMoneyBillWave,
  faPlus,
  faRotateRight,
  faTrash,
  faXmark,
} from "/src/icons/iconSet";
import { useAuth } from "../../components/AuthContext/AuthContext";
import SearchField from "../../components/SearchField/SearchField";
import { getCatalogItemImage } from "../../utils/itemMediaBackgrounds";
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

const DISCOUNT_OPTIONS = [
  { value: "amount", label: "Amount" },
  { value: "percent", label: "%" },
];

const sortCustomersByName = (customers) =>
  [...customers].sort((left, right) =>
    String(left?.name || left?.email || left?.phone || "").localeCompare(
      String(right?.name || right?.email || right?.phone || "")
    )
  );

const getCustomerLabel = (customer) =>
  customer?.name || customer?.email || customer?.phone || `Customer #${customer?.id ?? ""}`;

const getCustomerMeta = (customer) =>
  [customer?.email, customer?.phone].filter(Boolean).join(" · ") || `ID ${customer?.id ?? "-"}`;

const STORE_MODE_DRAFT_VERSION = 1;
const STORE_MODE_DRAFT_PREFIX = "reebs-store-mode-draft";

const sanitizeDraftString = (value, max = 240) =>
  typeof value === "string" ? value.slice(0, max) : "";

const sanitizeDraftOrderItems = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const productId = Number(item?.productId);
      const quantity = Math.max(1, Math.round(Number(item?.quantity) || 0));
      const unitPrice = Number(item?.unitPrice);
      const stock = Number(item?.stock);
      if (!Number.isFinite(productId) || productId <= 0) return null;
      return {
        productId,
        name: sanitizeDraftString(item?.name || "Untitled", 160) || "Untitled",
        quantity,
        unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
        stock: Number.isFinite(stock) && stock >= 0 ? stock : quantity,
        currency: sanitizeDraftString(item?.currency || "GHS", 8) || "GHS",
      };
    })
    .filter(Boolean);
};

const sanitizeDraftCustomer = (value) => {
  if (!value || typeof value !== "object") return null;
  const id = Number(value.id);
  const customer = {
    id: Number.isFinite(id) && id > 0 ? id : null,
    name: sanitizeDraftString(value.name, 160),
    email: sanitizeDraftString(value.email, 160),
    phone: sanitizeDraftString(value.phone, 40),
  };
  return customer.id || customer.name || customer.email || customer.phone ? customer : null;
};

const getStoreModeDraftKey = (user) => {
  const organizationId = Number(user?.organizationId);
  const userId = Number(user?.id);
  if (!Number.isFinite(organizationId) || organizationId <= 0) return "";
  if (!Number.isFinite(userId) || userId <= 0) return "";
  return `${STORE_MODE_DRAFT_PREFIX}:${organizationId}:${userId}`;
};

const readStoreModeDraft = (key) => {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== STORE_MODE_DRAFT_VERSION || !parsed?.data || typeof parsed.data !== "object") {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

const writeStoreModeDraft = (key, data) => {
  if (!key || typeof window === "undefined") return;
  window.sessionStorage.setItem(
    key,
    JSON.stringify({
      version: STORE_MODE_DRAFT_VERSION,
      savedAt: Date.now(),
      data,
    })
  );
};

const clearStoreModeDraft = (key) => {
  if (!key || typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
};

function StoreMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const customerPickerRef = useRef(null);
  const restoredDraftKeyRef = useRef("");
  const [hoveredImage, setHoveredImage] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
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
    const mediaQuery = window.matchMedia("(max-width: 720px)");
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

  const mobileSearchTerm = search.trim();
  const visibleItems = useMemo(() => {
    if (isMobileViewport && !mobileSearchTerm) return [];
    return filteredItems;
  }, [filteredItems, isMobileViewport, mobileSearchTerm]);

  const emptyStateMessage =
    isMobileViewport && !mobileSearchTerm ? "Search for a product to start a sale." : "No items match this filter.";

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

  const orderQtyById = useMemo(
    () => new Map(orderItems.map((item) => [item.productId, item.quantity])),
    [orderItems]
  );

  const sortedVisibleItems = useMemo(() => {
    const direction = sortConfig.direction === "asc" ? 1 : -1;
    const compareText = (left, right) => left.localeCompare(right) * direction;
    const compareNumber = (left, right) => (left - right) * direction;

    return [...visibleItems].sort((left, right) => {
      const leftOutOfStock = getQuantity(left) <= 0;
      const rightOutOfStock = getQuantity(right) <= 0;
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
          return compareNumber(getQuantity(left), getQuantity(right));
        case "item":
        default:
          return compareText(String(left?.name || ""), String(right?.name || ""));
      }
    });
  }, [sortConfig.direction, sortConfig.key, visibleItems]);

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
        const synced = {
          ...item,
          name: latest?.name || item.name,
          unitPrice: getUnitPrice(latest),
          stock: getQuantity(latest),
          currency: latest?.currency || item.currency || "GHS",
        };
        if (
          synced.name !== item.name ||
          synced.unitPrice !== item.unitPrice ||
          synced.stock !== item.stock ||
          synced.currency !== item.currency
        ) {
          changed = true;
        }
        return synced;
      });
      return changed ? next : current;
    });
  }, [inventoryById, items.length]);

  const itemCount = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.quantity, 0),
    [orderItems]
  );
  const summaryMetricCount = paymentMethod === "cash" ? 5 : 3;
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

  const addToOrder = (product) => {
    const productId = Number(product?.id);
    const stock = getQuantity(product);
    if (!Number.isFinite(productId) || productId <= 0 || stock <= 0) return;
    setSelectedProductId(productId);
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
      <div className="store-mode-shell">
        <header className="store-mode-topbar">
          <button type="button" className="store-mode-exit" onClick={() => navigate("/admin/inventory")}>
            <AppIcon icon={faArrowLeft} />
            <span className="store-mode-exit-label store-mode-exit-label--full">Leave Store Mode</span>
            <span className="store-mode-exit-label store-mode-exit-label--short">Exit</span>
          </button>
          <div className="store-mode-topbar-copy">
            <h1>Point of sale</h1>
          </div>
          <button
            type="button"
            className="store-mode-refresh store-mode-refresh--icon"
            onClick={refreshInventory}
            disabled={loading}
            aria-label="Refresh inventory"
            title="Refresh inventory"
          >
            <AppIcon icon={faRotateRight} />
          </button>
        </header>

        {(loading || error || submitError || success) && (
          <div className="store-mode-feedback">
            {loading && <p className="admin-status">Loading stock...</p>}
            {!loading && error && <p className="admin-error">{error}</p>}
            {submitError && <p className="admin-error">{submitError}</p>}
            {success && <p className="admin-success">{success}</p>}
          </div>
        )}

        <section className="store-mode-surface">
          <div className="store-mode-toolbar">
            <SearchField
              className="store-mode-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search item"
              aria-label="Search stock"
            />

            <div className="store-mode-filter-row" role="group" aria-label="Stock filter">
              {[
                { id: "all", label: "All" },
                { id: "in", label: "In stock" },
                { id: "low", label: "Low" },
                { id: "out", label: "Out" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`store-mode-filter-btn ${stockFilter === option.id ? "is-active" : ""}`}
                  onClick={() => setStockFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="store-mode-category">
              <span>Category</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="store-mode-table-scroll">
            <table className="store-mode-table">
              <thead>
                <tr>
                  <th className="store-mode-col store-mode-col--item">
                    <button
                      type="button"
                      className={sortHeaderClassName("item")}
                      onClick={() => requestSort("item")}
                      aria-pressed={sortConfig.key === "item"}
                    >
                      Item <span className="sort-indicator">{sortIndicator("item")}</span>
                    </button>
                  </th>
                  <th className="store-mode-col store-mode-col--sku">
                    <button
                      type="button"
                      className={sortHeaderClassName("sku")}
                      onClick={() => requestSort("sku")}
                      aria-pressed={sortConfig.key === "sku"}
                    >
                      SKU <span className="sort-indicator">{sortIndicator("sku")}</span>
                    </button>
                  </th>
                  <th className="store-mode-col store-mode-col--category">
                    <button
                      type="button"
                      className={sortHeaderClassName("category")}
                      onClick={() => requestSort("category")}
                      aria-pressed={sortConfig.key === "category"}
                    >
                      Category <span className="sort-indicator">{sortIndicator("category")}</span>
                    </button>
                  </th>
                  <th className="store-mode-col store-mode-col--price">
                    <button
                      type="button"
                      className={sortHeaderClassName("price")}
                      onClick={() => requestSort("price")}
                      aria-pressed={sortConfig.key === "price"}
                    >
                      Price <span className="sort-indicator">{sortIndicator("price")}</span>
                    </button>
                  </th>
                  <th className="store-mode-col store-mode-col--stock">
                    <button
                      type="button"
                      className={sortHeaderClassName("stock")}
                      onClick={() => requestSort("stock")}
                      aria-pressed={sortConfig.key === "stock"}
                    >
                      Stock <span className="sort-indicator">{sortIndicator("stock")}</span>
                    </button>
                  </th>
                  <th className="store-mode-col store-mode-col--order">Order</th>
                </tr>
              </thead>
              <tbody>
                {!loading && visibleItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="store-mode-empty">
                      {emptyStateMessage}
                    </td>
                  </tr>
                )}
                {sortedVisibleItems.map((item) => {
                  const productId = Number(item.id);
                  const stock = getQuantity(item);
                  const currentQty = orderQtyById.get(productId) || 0;
                  const isOut = stock <= 0;
                  const isLow = !isOut && stock <= 5;
                  const isSelected = selectedProductId === productId || currentQty > 0;
                  const showCompactOrderControls = isSelected || currentQty > 0;
                  const productName = item.name || "Untitled";
                  const productImage = getCatalogItemImage(item);
                  const productPrice = formatMoney(getUnitPrice(item), item.currency || "GHS");
                  return (
                    <tr
                      key={item.id}
                      className={`${isOut ? "is-out" : isLow ? "is-low" : ""} ${isSelected ? "is-selected" : ""} ${isMobileViewport && !isOut ? "store-mode-row--clickable" : ""}`}
                      onClick={
                        isMobileViewport && !isOut
                          ? () => {
                              addToOrder(item);
                            }
                          : undefined
                      }
                      onKeyDown={
                        isMobileViewport && !isOut
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                addToOrder(item);
                              }
                            }
                          : undefined
                      }
                      tabIndex={isMobileViewport && !isOut ? 0 : undefined}
                      role={isMobileViewport && !isOut ? "button" : undefined}
                    >
                      <td className="store-mode-cell store-mode-cell--item">
                        <div className="store-mode-product">
                          <button
                            type="button"
                            className="store-mode-product-image-trigger"
                            onMouseEnter={() => {
                              if (!isMobileViewport) showImagePreview(productImage, productName);
                            }}
                            onMouseLeave={() => {
                              if (!isMobileViewport) hideImagePreview();
                            }}
                            onFocus={() => {
                              if (!isMobileViewport) showImagePreview(productImage, productName);
                            }}
                            onBlur={() => {
                              if (!isMobileViewport) hideImagePreview();
                            }}
                            aria-label={`Preview ${productName}`}
                          >
                            <img
                              className="store-mode-product-image"
                              src={productImage}
                              alt={productName}
                              loading="lazy"
                            />
                          </button>
                          <div className="store-mode-product-copy">
                            <strong>{productName}</strong>
                            <span className="store-mode-product-price">{productPrice}</span>
                          </div>
                        </div>
                      </td>
                      <td className="store-mode-cell store-mode-cell--sku" data-label="SKU">
                        {item.sku || `ID ${item.id}`}
                      </td>
                      <td className="store-mode-cell store-mode-cell--category" data-label="Category">
                        {getCategory(item)}
                      </td>
                      <td className="store-mode-cell store-mode-cell--price" data-label="Price">{productPrice}</td>
                      <td className="store-mode-cell store-mode-cell--stock" data-label="Stock">
                        <span className={`store-mode-stock-pill ${isOut ? "is-out" : isLow ? "is-low" : ""}`}>
                          {stock}
                        </span>
                      </td>
                      <td className="store-mode-cell store-mode-cell--order" data-label="Order">
                        {!showCompactOrderControls ? (
                          <button
                            type="button"
                            className="store-mode-row-select"
                            onClick={() => setSelectedProductId(productId)}
                            disabled={isOut}
                          >
                            {isOut ? "Out" : "Select"}
                          </button>
                        ) : null}
                        <div className={`store-mode-stepper ${showCompactOrderControls ? "" : "store-mode-stepper--collapsed"}`}>
                          <button
                            type="button"
                            className="store-mode-stepper-btn"
                            onClick={() => removeFromOrder(productId)}
                            disabled={currentQty <= 0}
                            aria-label={`Remove ${item.name || "item"}`}
                          >
                            <AppIcon icon={faMinus} />
                          </button>
                          <span>{currentQty}</span>
                          <button
                            type="button"
                            className="store-mode-stepper-btn"
                            onClick={() => addToOrder(item)}
                            disabled={stock <= 0 || currentQty >= stock}
                            aria-label={`Add ${item.name || "item"}`}
                          >
                            <AppIcon icon={faPlus} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className="store-builder-dock" aria-label="Order builder">
        <div className="store-builder-bar">
          <div className="store-builder-left">
            <section className="store-builder-panel store-builder-panel--customer">
              <div className="store-builder-section-head">
                <span>Customer</span>
                <h3>Walk-in details</h3>
              </div>
              <div className="store-builder-controls">
                <div className="store-builder-inline-fields">
                  <label className="store-builder-field">
                    <span>Customer</span>
                    <div className="store-builder-customer-picker" ref={customerPickerRef}>
                      <input
                        type="text"
                        value={customerName}
                        onChange={handleCustomerNameChange}
                        onFocus={() => setCustomerDropdownOpen(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setCustomerDropdownOpen(false);
                          }
                        }}
                        placeholder="Select or add customer"
                        autoComplete="off"
                      />
                      {customerDropdownOpen ? (
                        <div className="store-builder-customer-menu" role="listbox" aria-label="Customer directory">
                          {customersLoading ? (
                            <div className="store-builder-customer-status">Loading customers...</div>
                          ) : (
                            <>
                              {customerMatches.map((customer) => (
                                <button
                                  key={customer.id}
                                  type="button"
                                  className={`store-builder-customer-option ${selectedCustomer?.id === customer.id ? "is-selected" : ""}`}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => handleSelectCustomer(customer)}
                                >
                                  <strong>{getCustomerLabel(customer)}</strong>
                                  <span>{getCustomerMeta(customer)}</span>
                                </button>
                              ))}

                              {showAddCustomerOption ? (
                                <button
                                  type="button"
                                  className="store-builder-customer-option is-create"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={handleChooseAddCustomer}
                                >
                                  <strong>Add customer</strong>
                                  <span>{normalizedCustomerLookup}</span>
                                </button>
                              ) : null}

                              {!customerMatches.length && !showAddCustomerOption ? (
                                <div className="store-builder-customer-status">No customers found.</div>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <small
                      className={`store-builder-field-note ${customersError ? "is-error" : selectedCustomer?.id ? "is-valid" : ""}`}
                    >
                    </small>
                  </label>

                  <label className="store-builder-field">
                    <span>WhatsApp or email</span>
                    <input
                      type="text"
                      value={customerContact}
                      onChange={(event) => setCustomerContact(event.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="store-builder-panel store-builder-panel--cart">
              <div className="store-builder-summary">
                <div>
                  <h2>{itemCount} {itemCount === 1 ? "item" : "items"}</h2>
                </div>
                <button
                  type="button"
                  className="store-builder-clear"
                  onClick={clearOrder}
                  disabled={!orderItems.length || submitting}
                >
                  <AppIcon icon={faTrash} /> Clear
                </button>
              </div>

              <div className="store-builder-main">
                {orderItems.length ? (
                  <div className="store-builder-strip">
                    {orderItems.map((item) => {
                      const liveProduct = inventoryById.get(Number(item.productId));
                      const maxStock = getQuantity(liveProduct || item);
                      return (
                        <div key={item.productId} className="store-builder-chip">
                          <div className="store-builder-chip-copy">
                            <strong>{item.name}</strong>
                            <span>
                              {formatMoney(item.unitPrice, item.currency || "GHS")} x {item.quantity}
                            </span>
                          </div>
                          <div className="store-builder-chip-actions">
                            <button
                              type="button"
                              className="store-mode-stepper-btn"
                              onClick={() => removeFromOrder(item.productId)}
                              disabled={submitting}
                            >
                              <AppIcon icon={faMinus} />
                            </button>
                            <strong>{formatMoney(item.unitPrice * item.quantity, item.currency || "GHS")}</strong>
                            <button
                              type="button"
                              className="store-mode-stepper-btn"
                              onClick={() => liveProduct && addToOrder(liveProduct)}
                              disabled={submitting || !liveProduct || item.quantity >= maxStock}
                            >
                              <AppIcon icon={faPlus} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="store-builder-empty store-builder-empty--inline">
                    Use the + buttons above to build the order.
                  </p>
                )}
              </div>

              <div
                className="store-builder-inline-totals"
                aria-label="Order totals"
                style={{ gridTemplateColumns: `repeat(${summaryMetricCount}, minmax(0, 1fr))` }}
              >
                <div className="store-builder-inline-total">
                  <span>Subtotal</span>
                  <strong>{formatMoney(subtotal, orderCurrency)}</strong>
                </div>
                <div className="store-builder-inline-total">
                  <span>Discount</span>
                  <strong>-{formatMoney(discountAmount, orderCurrency)}</strong>
                </div>
                <div className="store-builder-inline-total store-builder-inline-total--strong">
                  <span>Total</span>
                  <strong>{formatMoney(total, orderCurrency)}</strong>
                </div>
                {paymentMethod === "cash" && (
                  <>
                    <div className="store-builder-inline-total">
                      <span>Change</span>
                      <strong>{formatMoney(changeDue, orderCurrency)}</strong>
                    </div>
                    <div className="store-builder-inline-total">
                      <span>Due</span>
                      <strong>{formatMoney(cashShortfall, orderCurrency)}</strong>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>

          <section className="store-builder-checkout store-builder-panel store-builder-panel--checkout">
            <div className="store-builder-section-head">
              <span>Checkout</span>
              <h3>Payment and actions</h3>
            </div>
            <div className="store-builder-payment-stack">
              <div className="store-builder-methods" role="group" aria-label="Payment method">
                {PAYMENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`store-builder-method ${paymentMethod === option.value ? "is-active" : ""}`}
                    onClick={() => setPaymentMethod(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="store-builder-field store-builder-field--discount">
                <span>Discount</span>
                <div className="store-builder-discount-row">
                  <div className="store-builder-discount-types" role="group" aria-label="Discount type">
                    {DISCOUNT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`store-builder-discount-toggle ${discountType === option.value ? "is-active" : ""}`}
                        onClick={() => setDiscountType(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={discountType === "percent" ? "100" : undefined}
                    step={discountType === "percent" ? "1" : "0.01"}
                    value={discountValue}
                    onChange={(event) => setDiscountValue(event.target.value)}
                    placeholder={discountType === "percent" ? "0" : "0.00"}
                    className="store-builder-discount-input"
                  />
                </div>
              </div>

              {paymentMethod === "cash" && (
                <label className="store-builder-field store-builder-field--cash">
                  <span>Cash received</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder="0.00"
                  />
                </label>
              )}

              {paymentMethod === "momo" && (
                <label className="store-builder-field store-builder-field--cash">
                  <span>MoMo reference</span>
                  <input
                    type="text"
                    value={momoReference}
                    onChange={(event) => setMomoReference(event.target.value)}
                    placeholder="Transaction ID or sender number"
                  />
                </label>
              )}
            </div>
            <div className="store-builder-actions">
              <button
                type="button"
                className="store-builder-submit store-builder-submit--icon"
                onClick={() => submitSale({ payLater: false })}
                disabled={submitting || !canCompleteSale}
                aria-label={submitting ? "Selling" : "Sell"}
                title={submitting ? "Selling" : "Sell"}
              >
                <AppIcon icon={faMoneyBillWave} />
              </button>
              <button
                type="button"
                className="store-builder-submit store-builder-submit--danger store-builder-submit--icon"
                onClick={clearOrder}
                disabled={!orderItems.length || submitting}
                aria-label="Cancel sale"
                title="Cancel sale"
              >
                <AppIcon icon={faXmark} />
              </button>
              <button
                type="button"
                className="store-builder-submit store-builder-submit--pending store-builder-submit--pay-later"
                onClick={() => submitSale({ payLater: true })}
                disabled={submitting || !canPayLater}
              >
                <AppIcon icon={faClock} /> {submitting ? "Saving..." : "Pay later"}
              </button>
            </div>
          </section>
        </div>
      </aside>

      {hoveredImage ? (
        <div className="store-mode-image-lightbox" aria-hidden="true">
          <div className="store-mode-image-lightbox-frame">
            <img src={hoveredImage.src} alt={hoveredImage.name} />
            <span>{hoveredImage.name}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default StoreMode;
