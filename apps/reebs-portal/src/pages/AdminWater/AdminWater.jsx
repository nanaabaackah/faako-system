/* eslint-disable react-hooks/exhaustive-deps */
import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import "./AdminWater.css";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faBoxesStacked,
  faChartLine,
  faMinus,
  faMoneyCheckDollar,
  faPlus,
  faReceipt,
  faRotateRight,
  faStore,
  faTrash,
  faXmark,
} from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import { InlineNoticeStack } from "../../components/InlineNotice/InlineNotice";
import SearchField from "../../components/SearchField/SearchField";

const DEFAULT_PURCHASE_COST = 2200;
const DEFAULT_RETAIL_PRICE = 2700;
const DEFAULT_BULK_PRICE = 2600;
const DEFAULT_COMPANY_PRICE = 2500;
const DEFAULT_BULK_THRESHOLD = 10;
const WATER_SUPPLIER_NAME = "Ghana Water";
const RESTOCK_QUICK_QUANTITIES = [5, 10, 20, 50];
const ADJUSTMENT_QUICK_QUANTITIES = [1, 3, 5, 10];
const EXPENSE_QUICK_AMOUNTS = [5, 10, 20, 50];
const CUSTOM_EXPENSE_CATEGORY = "__custom__";
const CUSTOM_ADJUSTMENT_REASON = "__custom__";
const SALE_PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "momo", label: "MoMo" },
  { value: "credit", label: "Pay later" },
];
const SALE_DISCOUNT_OPTIONS = [
  { value: "none", label: "No discount" },
  { value: "amount", label: "Amount" },
  { value: "percent", label: "%" },
];
const ORDER_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "unpaid", label: "Unpaid" },
];
const EXPENSE_CATEGORY_OPTIONS = ["Transport", "Labour" ];
const ADJUSTMENT_REASON_OPTIONS = {
  add: ["Count gain", "Returned packs", "Found stock"],
  remove: ["Broken Package", "Free issue"],
};

const buildDefaultDashboard = () => ({
  product: {
    key: "gwater-15pk",
    name: "15pk Gwater",
    inventoryProductId: null,
    linkedVendorIds: [],
    purchaseCost: DEFAULT_PURCHASE_COST,
    pricing: {
      retailSingle: DEFAULT_RETAIL_PRICE,
      retailBulk: DEFAULT_BULK_PRICE,
      company: DEFAULT_COMPANY_PRICE,
      bulkThreshold: DEFAULT_BULK_THRESHOLD,
    },
  },
  summary: {
    stockOnHand: 0,
    unitsRestocked: 0,
    unitsSold: 0,
    adjustmentUnits: 0,
    revenue: 0,
    restockSpend: 0,
    extraExpenses: 0,
    costOfGoodsSold: 0,
    grossProfit: 0,
    netProfit: 0,
    cashCollected: 0,
    outstandingCredit: 0,
    pendingCash: 0,
    pendingMomo: 0,
    cashPosition: 0,
    inventoryValue: 0,
  },
  restocks: [],
  sales: [],
  expenses: [],
  adjustments: [],
});

const todayValue = () => new Date().toISOString().slice(0, 10);

const formatCurrency = (amount) => {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format((Number(amount) || 0) / 100);
  } catch {
    return `GHS ${((Number(amount) || 0) / 100).toFixed(2)}`;
  }
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toMoneyInputValue = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return (amount / 100).toFixed(2);
};

const toPercentInputValue = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return (amount / 100).toFixed(2);
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCustomerName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const normalizeVendorMatchText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeOrderSearchText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getSearchDigits = (value) => String(value || "").replace(/\D/g, "");

const getOrderSearchTokens = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .map((token) => {
      const text = normalizeOrderSearchText(token);
      const digits = getSearchDigits(token);
      if (!text && !digits) return null;
      return { text, digits };
    })
    .filter(Boolean);

const getMoneySearchValues = (amount) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return [];
  return [String(numericAmount), (numericAmount / 100).toFixed(2), formatCurrency(numericAmount)];
};

const getRecommendedWaterVendors = (vendors, productName) => {
  const normalizedProductName = normalizeVendorMatchText(productName);
  if (!normalizedProductName) return [];

  const candidateNeedles = new Set([normalizedProductName]);
  if (normalizedProductName.includes("gwater")) candidateNeedles.add("gwater");
  if (normalizedProductName.includes("water")) candidateNeedles.add("water");

  const stopTokens = new Set(["pk", "pack"]);
  normalizedProductName.split(" ").forEach((token) => {
    if (!token || stopTokens.has(token) || token.length < 4) return;
    if (!/[a-z]/.test(token)) return;
    candidateNeedles.add(token);
  });

  return (Array.isArray(vendors) ? vendors : []).filter((vendor) => {
    const candidateValues = [
      ...(Array.isArray(vendor?.productNames) ? vendor.productNames : []),
      ...(Array.isArray(vendor?.suppliedItems) ? vendor.suppliedItems : []),
    ]
      .map(normalizeVendorMatchText)
      .filter(Boolean);

    return candidateValues.some((candidate) =>
      Array.from(candidateNeedles).some((needle) =>
        candidate === needle || candidate.includes(needle) || needle.includes(candidate)
      )
    );
  });
};

const getPreviewUnitPrice = (quantity, pricing, saleChannel) => {
  if (saleChannel === "company") return pricing.company;
  return quantity >= pricing.bulkThreshold ? pricing.retailBulk : pricing.retailSingle;
};

const normalizeChannel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "company" ? "company" : "retail";
};

const normalizeSalePaymentMethod = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "momo") return "momo";
  if (normalized === "credit") return "credit";
  return "cash";
};

const getSalePaymentLabel = (value) => {
  const normalized = normalizeSalePaymentMethod(value);
  if (normalized === "momo") return "MoMo";
  if (normalized === "credit") return "Pay later";
  return "Cash";
};

const normalizeSaleDiscountType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "amount") return "amount";
  if (normalized === "percent" || normalized === "percentage") return "percent";
  return "none";
};

const normalizeSalePaymentStatus = (value, paymentMethod = "cash") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "paid") return "paid";
  if (normalized === "pending") return "pending";
  if (normalized === "unpaid") return "unpaid";
  const method = normalizeSalePaymentMethod(paymentMethod);
  if (method === "credit") return "unpaid";
  return "paid";
};

const buildWaterSummary = ({
  restocks = [],
  sales = [],
  expenses = [],
  adjustments = [],
  purchaseCost = DEFAULT_PURCHASE_COST,
}) => {
  const resolvedPurchaseCost = Math.max(0, toNumber(purchaseCost, DEFAULT_PURCHASE_COST));
  const unitsRestocked = restocks.reduce((sum, row) => sum + toNumber(row?.quantity), 0);
  const unitsSold = sales.reduce((sum, row) => sum + toNumber(row?.quantity), 0);
  const adjustmentUnits = adjustments.reduce((sum, row) => sum + toNumber(row?.quantityDelta), 0);
  const stockOnHand = Math.max(0, unitsRestocked - unitsSold + adjustmentUnits);
  const restockSpend = restocks.reduce(
    (sum, row) => sum + (toNumber(row?.quantity) * toNumber(row?.unitCost, resolvedPurchaseCost)),
    0
  );
  const revenue = sales.reduce((sum, row) => sum + toNumber(row?.totalAmount), 0);
  const cashCollected = sales.reduce((sum, row) => {
    return normalizeSalePaymentStatus(row?.paymentStatus, row?.paymentMethod) === "paid"
      ? sum + toNumber(row?.totalAmount)
      : sum;
  }, 0);
  const outstandingCredit = sales.reduce((sum, row) => {
    const isCollected = normalizeSalePaymentStatus(row?.paymentStatus, row?.paymentMethod) === "paid";
    return normalizeSalePaymentMethod(row?.paymentMethod) === "credit" && !isCollected
      ? sum + toNumber(row?.totalAmount)
      : sum;
  }, 0);
  const pendingCash = sales.reduce((sum, row) => {
    const isCollected = normalizeSalePaymentStatus(row?.paymentStatus, row?.paymentMethod) === "paid";
    return normalizeSalePaymentMethod(row?.paymentMethod) === "cash" && !isCollected
      ? sum + toNumber(row?.totalAmount)
      : sum;
  }, 0);
  const pendingMomo = sales.reduce((sum, row) => {
    const isCollected = normalizeSalePaymentStatus(row?.paymentStatus, row?.paymentMethod) === "paid";
    return normalizeSalePaymentMethod(row?.paymentMethod) === "momo" && !isCollected
      ? sum + toNumber(row?.totalAmount)
      : sum;
  }, 0);
  const extraExpenses = expenses.reduce((sum, row) => sum + toNumber(row?.amount), 0);
  const costOfGoodsSold = unitsSold * resolvedPurchaseCost;
  const grossProfit = revenue - costOfGoodsSold;
  const netProfit = grossProfit - extraExpenses;
  const cashPosition = cashCollected - restockSpend - extraExpenses;
  const inventoryValue = stockOnHand * resolvedPurchaseCost;

  return {
    stockOnHand,
    unitsRestocked,
    unitsSold,
    adjustmentUnits,
    revenue,
    restockSpend,
    extraExpenses,
    costOfGoodsSold,
    grossProfit,
    netProfit,
    cashCollected,
    outstandingCredit,
    pendingCash,
    pendingMomo,
    cashPosition,
    inventoryValue,
  };
};

const getSalePaymentStatusLabel = (value, paymentMethod = "cash") => {
  const normalized = normalizeSalePaymentStatus(value, paymentMethod);
  if (normalized === "paid") return "Paid";
  if (normalized === "unpaid") return "Unpaid";
  return "Pending";
};

const buildOrderSearchIndex = (sale, linkedCustomer = null) => {
  const paymentStatus = normalizeSalePaymentStatus(sale?.paymentStatus, sale?.paymentMethod);
  const searchValues = [
    sale?.id,
    sale?.customerName,
    sale?.customerId,
    linkedCustomer?.name,
    linkedCustomer?.id,
    linkedCustomer?.phone,
    sale?.customerPhone,
    sale?.paymentReference,
    sale?.providerReference,
    sale?.saleChannel,
    sale?.paymentMethod,
    getSalePaymentLabel(sale?.paymentMethod),
    paymentStatus,
    getSalePaymentStatusLabel(sale?.paymentStatus, sale?.paymentMethod),
    sale?.date,
    formatDate(sale?.date),
    formatDateTime(sale?.date),
    sale?.notes,
    sale?.quantity,
    ...getMoneySearchValues(sale?.unitPrice),
    ...getMoneySearchValues(sale?.totalAmount),
  ].filter(Boolean);

  return {
    text: normalizeOrderSearchText(searchValues.join(" ")),
    digits: searchValues.map(getSearchDigits).filter(Boolean).join(" "),
  };
};

function AdminWater() {
  const [dashboard, setDashboard] = useState(buildDefaultDashboard);
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [, setVendorError] = useState("");
  const [customerError, setCustomerError] = useState("");
  const [saleCustomerMenuOpen, setSaleCustomerMenuOpen] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [orderForm, setOrderForm] = useState(null);
  const [orderError, setOrderError] = useState("");
  const [orderCustomerMenuOpen, setOrderCustomerMenuOpen] = useState(false);
  const [activeLedgerItem, setActiveLedgerItem] = useState(null);
  const [ledgerForm, setLedgerForm] = useState(null);
  const [ledgerError, setLedgerError] = useState("");
  const [removedRecordIds, setRemovedRecordIds] = useState({
    sale: [],
    expense: [],
    restock: [],
    adjustment: [],
  });

  const [restockForm, setRestockForm] = useState({
    quantity: "",
    date: todayValue(),
    notes: "",
  });
  const [saleForm, setSaleForm] = useState({
    quantity: "",
    saleChannel: "retail",
    paymentMethod: "cash",
    unitPrice: "",
    discountType: "none",
    discountValue: "",
    customerId: "",
    customerName: "",
    customerPhone: "",
    date: todayValue(),
    notes: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    category: "",
    customCategory: "",
    amount: "",
    description: "",
    date: todayValue(),
    notes: "",
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    mode: "remove",
    quantityDelta: "",
    reason: "",
    customReason: "",
    date: todayValue(),
    notes: "",
  });

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const loadWater = async () => {
    const response = await fetch("/.netlify/functions/water");
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Failed to load the water module.");
    }
    setDashboard(data && typeof data === "object" ? data : buildDefaultDashboard());
  };

  const loadVendors = async () => {
    setVendorError("");
    try {
      const response = await fetch("/.netlify/functions/vendors");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load vendors.");
      }
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Water vendor load failed", err);
      setVendorError(err.message || "Vendor list is unavailable right now.");
      setVendors([]);
    }
  };

  const loadCustomers = async () => {
    setCustomerError("");
    try {
      const response = await fetch("/.netlify/functions/customers");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load customers.");
      }
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Water customer load failed", err);
      setCustomerError(err.message || "Customer list is unavailable right now.");
      setCustomers([]);
    }
  };

  const loadModule = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadWater(), loadVendors(), loadCustomers()]);
    } catch (err) {
      console.error("Water module load failed", err);
      setError(err.message || "Unable to load the water module.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModule();
  }, []);

  const handleAction = async (action, payload, successMessage) => {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/.netlify/functions/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save water module activity.");
      }
      setDashboard(data && typeof data === "object" ? data : buildDefaultDashboard());
      setStatus(successMessage);
      return true;
    } catch (err) {
      console.error("Water action failed", err);
      setError(err.message || "Unable to save water module activity.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const markRecordRemoved = (type, recordId) => {
    const normalizedId = Number(recordId);
    if (!Number.isFinite(normalizedId) || normalizedId <= 0) return;
    setRemovedRecordIds((prev) => ({
      ...prev,
      [type]: prev[type].includes(normalizedId) ? prev[type] : [...prev[type], normalizedId],
    }));
  };

  const pricing = dashboard?.product?.pricing || buildDefaultDashboard().product.pricing;
  const dashboardRestocks = Array.isArray(dashboard?.restocks) ? dashboard.restocks : [];
  const dashboardSales = Array.isArray(dashboard?.sales) ? dashboard.sales : [];
  const dashboardExpenses = Array.isArray(dashboard?.expenses) ? dashboard.expenses : [];
  const dashboardAdjustments = Array.isArray(dashboard?.adjustments) ? dashboard.adjustments : [];
  const restocks = useMemo(
    () => dashboardRestocks.filter((entry) => !removedRecordIds.restock.includes(Number(entry.id))),
    [dashboardRestocks, removedRecordIds.restock]
  );
  const sales = useMemo(
    () => dashboardSales.filter((entry) => !removedRecordIds.sale.includes(Number(entry.id))),
    [dashboardSales, removedRecordIds.sale]
  );
  const expenses = useMemo(
    () => dashboardExpenses.filter((entry) => !removedRecordIds.expense.includes(Number(entry.id))),
    [dashboardExpenses, removedRecordIds.expense]
  );
  const adjustments = useMemo(
    () => dashboardAdjustments.filter((entry) => !removedRecordIds.adjustment.includes(Number(entry.id))),
    [dashboardAdjustments, removedRecordIds.adjustment]
  );
  const productPurchaseCost = Math.max(
    0,
    toNumber(dashboard?.product?.purchaseCost, buildDefaultDashboard().product.purchaseCost)
  );
  const summary = useMemo(
    () =>
      buildWaterSummary({
        restocks,
        sales,
        expenses,
        adjustments,
        purchaseCost: productPurchaseCost,
      }),
    [adjustments, expenses, productPurchaseCost, restocks, sales]
  );
  const restockById = useMemo(
    () =>
      new Map(
        restocks
          .map((restock) => [Number(restock.id), restock])
          .filter(([id]) => Number.isFinite(id) && id > 0)
      ),
    [restocks]
  );
  const adjustmentById = useMemo(
    () =>
      new Map(
        adjustments
          .map((adjustment) => [Number(adjustment.id), adjustment])
          .filter(([id]) => Number.isFinite(id) && id > 0)
      ),
    [adjustments]
  );
  const expenseById = useMemo(
    () =>
      new Map(
        expenses
          .map((expense) => [Number(expense.id), expense])
          .filter(([id]) => Number.isFinite(id) && id > 0)
      ),
    [expenses]
  );
  const productName = dashboard?.product?.name || buildDefaultDashboard().product.name;
  const hardLinkedVendorIds = useMemo(() => {
    const source = Array.isArray(dashboard?.product?.linkedVendorIds)
      ? dashboard.product.linkedVendorIds
      : [];
    return source
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
  }, [dashboard?.product?.linkedVendorIds]);
  const hardLinkedVendors = useMemo(() => {
    if (!vendors.length || !hardLinkedVendorIds.length) return [];
    const vendorById = new Map(
      vendors.map((vendor) => [Number(vendor.id), vendor]).filter(([id]) => Number.isFinite(id) && id > 0)
    );
    return hardLinkedVendorIds.map((vendorId) => vendorById.get(vendorId)).filter(Boolean);
  }, [hardLinkedVendorIds, vendors]);
  const fallbackRecommendedVendors = useMemo(
    () => getRecommendedWaterVendors(vendors, productName),
    [productName, vendors]
  );
  const suggestedVendors = useMemo(
    () => (hardLinkedVendorIds.length ? hardLinkedVendors : fallbackRecommendedVendors),
    [fallbackRecommendedVendors, hardLinkedVendorIds.length, hardLinkedVendors]
  );
  const suggestedVendorIds = useMemo(
    () => new Set(suggestedVendors.map((vendor) => Number(vendor.id)).filter((id) => Number.isFinite(id) && id > 0)),
    [suggestedVendors]
  );
  const orderedVendorOptions = useMemo(() => {
    if (!vendors.length || !suggestedVendors.length) return vendors;
    return [
      ...suggestedVendors,
      ...vendors.filter((vendor) => !suggestedVendorIds.has(Number(vendor.id))),
    ];
  }, [suggestedVendorIds, suggestedVendors, vendors]);
  const customerById = useMemo(
    () =>
      new Map(
        customers
          .map((customer) => [Number(customer.id), customer])
          .filter(([id]) => Number.isFinite(id) && id > 0)
      ),
    [customers]
  );
  const deferredOrderQuery = useDeferredValue(orderQuery);
  const filteredSales = useMemo(() => {
    const queryTokens = getOrderSearchTokens(deferredOrderQuery);
    return sales.filter((sale) => {
      const paymentStatus = normalizeSalePaymentStatus(sale.paymentStatus, sale.paymentMethod);
      if (orderStatusFilter !== "all" && paymentStatus !== orderStatusFilter) return false;
      if (!queryTokens.length) return true;
      const saleCustomerId = Number(sale.customerId);
      const linkedCustomer =
        Number.isFinite(saleCustomerId) && saleCustomerId > 0 ? customerById.get(saleCustomerId) : null;
      const searchIndex = buildOrderSearchIndex(sale, linkedCustomer);
      return queryTokens.every(({ text, digits }) => {
        const matchesText = text ? searchIndex.text.includes(text) : false;
        const matchesDigits = digits ? searchIndex.digits.includes(digits) : false;
        return matchesText || matchesDigits;
      });
    });
  }, [customerById, deferredOrderQuery, orderStatusFilter, sales]);
  const unpaidOrderCount = useMemo(
    () => sales.filter((sale) => normalizeSalePaymentStatus(sale.paymentStatus, sale.paymentMethod) !== "paid").length,
    [sales]
  );
  const totalCreditCount = useMemo(
    () =>
      sales.filter(
        (sale) =>
          normalizeSalePaymentMethod(sale.paymentMethod) === "credit" &&
          normalizeSalePaymentStatus(sale.paymentStatus, sale.paymentMethod) !== "paid"
      ).length,
    [sales]
  );
  const pendingMomoCount = useMemo(
    () =>
      sales.filter(
        (sale) =>
          normalizeSalePaymentMethod(sale.paymentMethod) === "momo" &&
          normalizeSalePaymentStatus(sale.paymentStatus, sale.paymentMethod) === "pending"
      ).length,
    [sales]
  );
  const pendingCashCount = useMemo(
    () =>
      sales.filter(
        (sale) =>
          normalizeSalePaymentMethod(sale.paymentMethod) === "cash" &&
          normalizeSalePaymentStatus(sale.paymentStatus, sale.paymentMethod) === "pending"
      ).length,
    [sales]
  );

  const salePreview = useMemo(() => {
    const quantity = Math.max(0, Math.round(toNumber(saleForm.quantity, 0)));
    const suggestedUnitPrice = getPreviewUnitPrice(quantity, pricing, saleForm.saleChannel);
    const enteredUnitPrice = Math.max(0, Math.round((Number(saleForm.unitPrice) || 0) * 100));
    const unitPrice = enteredUnitPrice || suggestedUnitPrice;
    const subtotal = quantity * unitPrice;
    const discountType = normalizeSaleDiscountType(saleForm.discountType);
    const parsedDiscountInput = Number(String(saleForm.discountValue || "").replace(/,/g, "").trim());
    let discountAmount = 0;

    if (subtotal > 0 && discountType !== "none" && Number.isFinite(parsedDiscountInput) && parsedDiscountInput > 0) {
      if (discountType === "amount") {
        discountAmount = Math.round(parsedDiscountInput * 100);
      } else {
        const percent = Math.min(parsedDiscountInput, 99.99);
        discountAmount = Math.round((subtotal * percent) / 100);
      }
      if (discountAmount >= subtotal) {
        discountAmount = Math.max(subtotal - 1, 0);
      }
    }

    return {
      quantity,
      unitPrice,
      suggestedUnitPrice,
      usesCustomUnitPrice: enteredUnitPrice > 0 && enteredUnitPrice !== suggestedUnitPrice,
      subtotal,
      discountAmount,
      total: Math.max(0, subtotal - discountAmount),
    };
  }, [pricing, saleForm.discountType, saleForm.discountValue, saleForm.quantity, saleForm.saleChannel, saleForm.unitPrice]);

  const stockTimeline = useMemo(() => {
    const restockRows = restocks.map((item) => ({
      id: `restock-${item.id}`,
      sourceId: Number(item.id) || null,
      type: "restock",
      label: "Restock",
      date: item.date,
      quantity: toNumber(item.quantity),
      detail: item.vendorName || "Unassigned vendor",
      note: item.notes || "",
      vendorId: Number(item.vendorId) || null,
      vendorName: item.vendorName || "",
      unitCost: toNumber(item.unitCost),
      createdAt: item.createdAt || "",
      amount: toNumber(item.quantity) * toNumber(item.unitCost),
    }));
    const adjustmentRows = adjustments.map((item) => ({
      id: `adjustment-${item.id}`,
      sourceId: Number(item.id) || null,
      type: "adjustment",
      label: "Correction",
      date: item.date,
      quantity: toNumber(item.quantityDelta),
      detail: item.reason || "Manual correction",
      note: item.notes || "",
      reason: item.reason || "",
      quantityDelta: toNumber(item.quantityDelta),
      createdAt: item.createdAt || "",
      amount: null,
    }));
    return [...restockRows, ...adjustmentRows].sort((a, b) => {
      const timeA = new Date(a.date || 0).getTime();
      const timeB = new Date(b.date || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });
  }, [adjustments, restocks]);

  const fixedWaterVendor = useMemo(() => {
    const normalizedSupplierName = normalizeVendorMatchText(WATER_SUPPLIER_NAME);
    const vendorPool = hardLinkedVendors.length ? hardLinkedVendors : vendors;
    return (
      vendorPool.find((vendor) => {
        const normalizedVendorName = normalizeVendorMatchText(vendor?.name);
        if (!normalizedVendorName) return false;
        return (
          normalizedVendorName === normalizedSupplierName ||
          normalizedVendorName.includes(normalizedSupplierName) ||
          normalizedSupplierName.includes(normalizedVendorName)
        );
      }) || null
    );
  }, [hardLinkedVendors, vendors]);

  const selectedSaleCustomer = useMemo(() => {
    const customerId = Number(saleForm.customerId);
    if (!Number.isFinite(customerId) || customerId <= 0) return null;
    return customers.find((customer) => customer.id === customerId) || null;
  }, [customers, saleForm.customerId]);
  const activeOrder = useMemo(() => {
    if (!activeOrderId) return null;
    return sales.find((sale) => Number(sale.id) === Number(activeOrderId)) || null;
  }, [activeOrderId, sales]);
  const activeLedgerRecord = useMemo(() => {
    if (!activeLedgerItem?.type || !activeLedgerItem?.id) return null;
    const recordId = Number(activeLedgerItem.id);
    if (!Number.isFinite(recordId) || recordId <= 0) return null;
    if (activeLedgerItem.type === "restock") return restockById.get(recordId) || null;
    if (activeLedgerItem.type === "adjustment") return adjustmentById.get(recordId) || null;
    if (activeLedgerItem.type === "expense") return expenseById.get(recordId) || null;
    return null;
  }, [activeLedgerItem, adjustmentById, expenseById, restockById]);
  const selectedOrderCustomer = useMemo(() => {
    const customerId = Number(orderForm?.customerId);
    if (!Number.isFinite(customerId) || customerId <= 0) return null;
    return customers.find((customer) => customer.id === customerId) || null;
  }, [customers, orderForm?.customerId]);
  const selectedLedgerVendor = useMemo(() => {
    if (ledgerForm?.type !== "restock") return null;
    const vendorId = Number(ledgerForm.vendorId);
    if (!Number.isFinite(vendorId) || vendorId <= 0) return null;
    return vendors.find((vendor) => Number(vendor.id) === vendorId) || null;
  }, [ledgerForm, vendors]);
  const deferredSaleCustomerQuery = useDeferredValue(saleForm.customerName || "");
  const deferredOrderCustomerQuery = useDeferredValue(orderForm?.customerName || "");
  const typedSaleCustomerName = String(saleForm.customerName || "").trim();
  const matchedTypedSaleCustomer = useMemo(() => {
    if (!typedSaleCustomerName) return null;
    const normalizedName = normalizeCustomerName(typedSaleCustomerName);
    if (!normalizedName) return null;
    return (
      customers.find((customer) => normalizeCustomerName(customer.name) === normalizedName) || null
    );
  }, [customers, typedSaleCustomerName]);
  const filteredSaleCustomerOptions = useMemo(() => {
    if (!customers.length) return [];
    const nameQuery = normalizeCustomerName(deferredSaleCustomerQuery);
    const phoneQuery = String(saleForm.customerName || "")
      .replace(/\D/g, "")
      .trim();
    const source =
      nameQuery || phoneQuery
        ? customers.filter((customer) => {
            const matchesName = normalizeCustomerName(customer.name).includes(nameQuery);
            const matchesPhone = phoneQuery
              ? String(customer.phone || "").replace(/\D/g, "").includes(phoneQuery)
              : false;
            return matchesName || matchesPhone;
          })
        : customers;
    return source.slice(0, nameQuery || phoneQuery ? 12 : 8);
  }, [customers, deferredSaleCustomerQuery, saleForm.customerName]);
  const typedOrderCustomerName = String(orderForm?.customerName || "").trim();
  const matchedTypedOrderCustomer = useMemo(() => {
    if (!typedOrderCustomerName) return null;
    const normalizedName = normalizeCustomerName(typedOrderCustomerName);
    if (!normalizedName) return null;
    return (
      customers.find((customer) => normalizeCustomerName(customer.name) === normalizedName) || null
    );
  }, [customers, typedOrderCustomerName]);
  const filteredOrderCustomerOptions = useMemo(() => {
    if (!customers.length) return [];
    const nameQuery = normalizeCustomerName(deferredOrderCustomerQuery);
    const phoneQuery = String(orderForm?.customerName || "")
      .replace(/\D/g, "")
      .trim();
    const source =
      nameQuery || phoneQuery
        ? customers.filter((customer) => {
            const matchesName = normalizeCustomerName(customer.name).includes(nameQuery);
            const matchesPhone = phoneQuery
              ? String(customer.phone || "").replace(/\D/g, "").includes(phoneQuery)
              : false;
            return matchesName || matchesPhone;
          })
        : customers;
    return source.slice(0, nameQuery || phoneQuery ? 12 : 8);
  }, [customers, deferredOrderCustomerQuery, orderForm?.customerName]);

  const restockQuantity = Math.max(0, Math.round(toNumber(restockForm.quantity, 0)));
  const restockCost = restockQuantity * DEFAULT_PURCHASE_COST;
  const restockSupplierLabel = fixedWaterVendor?.name || WATER_SUPPLIER_NAME;
  const saleCustomerLabel = saleForm.saleChannel === "company" ? "Company name" : "Customer name";
  const saleRateLabel =
    salePreview.usesCustomUnitPrice
      ? "Custom rate"
      : saleForm.saleChannel === "company"
        ? "Company rate"
        : salePreview.quantity >= pricing.bulkThreshold
          ? `Bulk rate (${pricing.bulkThreshold}+)`
          : "Retail rate";
  const salePaymentLabel = getSalePaymentLabel(saleForm.paymentMethod);
  const saleDiscountType = normalizeSaleDiscountType(saleForm.discountType);
  const resolvedExpenseCategory =
    expenseForm.category === CUSTOM_EXPENSE_CATEGORY
      ? expenseForm.customCategory.trim()
      : expenseForm.category.trim();
  const expenseAmountValue = Math.max(0, Number(expenseForm.amount) || 0);
  const expenseSummaryAmount = Math.round(expenseAmountValue * 100);
  const expenseSummaryLabel = resolvedExpenseCategory || "Expense";
  const adjustmentHasCustomReason = adjustmentForm.reason === CUSTOM_ADJUSTMENT_REASON;
  const resolvedAdjustmentReason = adjustmentHasCustomReason
    ? adjustmentForm.customReason.trim()
    : adjustmentForm.reason.trim();
  const ledgerRestockQuantity =
    ledgerForm?.type === "restock" ? Math.max(0, Math.round(toNumber(ledgerForm.quantity, 0))) : 0;
  const ledgerRestockCost = ledgerRestockQuantity * DEFAULT_PURCHASE_COST;
  const ledgerSelectedVendorName = selectedLedgerVendor?.name || "";
  const ledgerAdjustmentQuantity =
    ledgerForm?.type === "adjustment"
      ? Math.max(0, Math.round(toNumber(ledgerForm.quantityDelta, 0)))
      : 0;
  const ledgerAdjustmentReasonOptions =
    ledgerForm?.type === "adjustment" ? ADJUSTMENT_REASON_OPTIONS[ledgerForm.mode] || [] : [];
  const ledgerAdjustmentHasCustomReason =
    ledgerForm?.type === "adjustment" && ledgerForm.reason === CUSTOM_ADJUSTMENT_REASON;
  const resolvedLedgerAdjustmentReason =
    ledgerForm?.type !== "adjustment"
      ? ""
      : ledgerAdjustmentHasCustomReason
        ? ledgerForm.customReason.trim()
        : ledgerForm.reason.trim();
  const ledgerAdjustmentSummaryLabel =
    ledgerForm?.type !== "adjustment"
      ? ""
      : ledgerForm.mode === "add"
        ? `Add ${ledgerAdjustmentQuantity || 0} pack${ledgerAdjustmentQuantity === 1 ? "" : "s"} back to stock`
        : `Remove ${ledgerAdjustmentQuantity || 0} pack${ledgerAdjustmentQuantity === 1 ? "" : "s"} from stock`;
  const ledgerExpenseAmountValue =
    ledgerForm?.type === "expense" ? Math.max(0, Number(ledgerForm.amount) || 0) : 0;
  const ledgerExpenseSummaryAmount = Math.round(ledgerExpenseAmountValue * 100);
  const resolvedLedgerExpenseCategory =
    ledgerForm?.type !== "expense"
      ? ""
      : ledgerForm.category === CUSTOM_EXPENSE_CATEGORY
        ? ledgerForm.customCategory.trim()
        : ledgerForm.category.trim();

  const setSaleQuantityValue = (nextValue) => {
    if (nextValue === "" || nextValue === null || nextValue === undefined) {
      setSaleForm((prev) => ({ ...prev, quantity: "" }));
      return;
    }
    const parsed = Math.round(toNumber(nextValue, 0));
    setSaleForm((prev) => ({
      ...prev,
      quantity: parsed <= 0 ? "" : String(parsed),
    }));
  };

  const setRestockQuantityValue = (nextValue) => {
    if (nextValue === "" || nextValue === null || nextValue === undefined) {
      setRestockForm((prev) => ({ ...prev, quantity: "" }));
      return;
    }
    const parsed = Math.round(toNumber(nextValue, 0));
    setRestockForm((prev) => ({
      ...prev,
      quantity: parsed <= 0 ? "" : String(parsed),
    }));
  };

  const adjustRestockQuantity = (delta) => {
    const current = Math.max(0, Math.round(toNumber(restockForm.quantity, 0)));
    const next = current + delta;
    setRestockQuantityValue(next <= 0 ? 1 : next);
  };

  const adjustSaleQuantity = (delta) => {
    const current = Math.max(0, Math.round(toNumber(saleForm.quantity, 0)));
    const next = current + delta;
    setSaleQuantityValue(next <= 0 ? 1 : next);
  };

  const setSaleDiscountValue = (nextValue) => {
    if (nextValue === "" || nextValue === null || nextValue === undefined) {
      setSaleForm((prev) => ({ ...prev, discountValue: "" }));
      return;
    }
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSaleForm((prev) => ({ ...prev, discountValue: "" }));
      return;
    }
    const normalized = Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
    setSaleForm((prev) => ({ ...prev, discountValue: normalized }));
  };

  const setExpenseAmountValue = (nextValue) => {
    if (nextValue === "" || nextValue === null || nextValue === undefined) {
      setExpenseForm((prev) => ({ ...prev, amount: "" }));
      return;
    }
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setExpenseForm((prev) => ({ ...prev, amount: "" }));
      return;
    }
    const normalized = Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
    setExpenseForm((prev) => ({ ...prev, amount: normalized }));
  };

  const adjustExpenseAmount = (delta) => {
    const current = Math.max(0, Number(expenseForm.amount) || 0);
    const next = current + delta;
    setExpenseAmountValue(next <= 0 ? 1 : Number(next.toFixed(2)));
  };

  const adjustmentQuantity = Math.max(0, Math.round(toNumber(adjustmentForm.quantityDelta, 0)));
  const adjustmentSignedQuantity =
    adjustmentForm.mode === "add" ? adjustmentQuantity : adjustmentQuantity * -1;
  const adjustmentReasonOptions = ADJUSTMENT_REASON_OPTIONS[adjustmentForm.mode] || [];
  const adjustmentSummaryLabel =
    adjustmentForm.mode === "add"
      ? `Add ${adjustmentQuantity || 0} pack${adjustmentQuantity === 1 ? "" : "s"} back to stock`
      : `Remove ${adjustmentQuantity || 0} pack${adjustmentQuantity === 1 ? "" : "s"} from stock`;

  const setAdjustmentQuantityValue = (nextValue) => {
    if (nextValue === "" || nextValue === null || nextValue === undefined) {
      setAdjustmentForm((prev) => ({ ...prev, quantityDelta: "" }));
      return;
    }
    const parsed = Math.round(toNumber(nextValue, 0));
    setAdjustmentForm((prev) => ({
      ...prev,
      quantityDelta: parsed <= 0 ? "" : String(parsed),
    }));
  };

  const adjustAdjustmentQuantity = (delta) => {
    const current = Math.max(0, Math.round(toNumber(adjustmentForm.quantityDelta, 0)));
    const next = current + delta;
    setAdjustmentQuantityValue(next <= 0 ? 1 : next);
  };

  const openOrderEditor = (sale) => {
    const linkedCustomerId = Number(sale?.customerId);
    const linkedCustomer =
      Number.isFinite(linkedCustomerId) && linkedCustomerId > 0
        ? customerById.get(linkedCustomerId)
        : null;
    setActiveLedgerItem(null);
    setLedgerForm(null);
    setLedgerError("");
    setOrderCustomerMenuOpen(false);
    setActiveOrderId(Number(sale?.id) || null);
    setOrderError("");
    setOrderForm({
      id: Number(sale?.id) || null,
      customerId:
        Number.isFinite(linkedCustomerId) && linkedCustomerId > 0 ? String(linkedCustomerId) : "",
      customerName: sale?.customerName || "",
      customerPhone: linkedCustomer?.phone || "",
      saleChannel: normalizeChannel(sale?.saleChannel),
      paymentMethod: normalizeSalePaymentMethod(sale?.paymentMethod),
      paymentStatus: normalizeSalePaymentStatus(sale?.paymentStatus, sale?.paymentMethod),
      quantity: String(Math.max(1, toNumber(sale?.quantity, 1))),
      unitPrice: toMoneyInputValue(sale?.unitPrice),
      discountType: normalizeSaleDiscountType(sale?.discountType),
      discountValue:
        normalizeSaleDiscountType(sale?.discountType) === "amount"
          ? toMoneyInputValue(sale?.discountValue)
          : normalizeSaleDiscountType(sale?.discountType) === "percent"
            ? toPercentInputValue(sale?.discountValue)
            : "",
      paymentReference: sale?.paymentReference || "",
      providerReference: sale?.providerReference || "",
      date: sale?.date ? String(sale.date).slice(0, 10) : todayValue(),
      notes: sale?.notes || "",
      updatedAt: sale?.updatedAt || "",
      updatedByName: sale?.updatedByName || "",
    });
  };

  const closeOrderEditor = () => {
    setActiveOrderId(null);
    setOrderForm(null);
    setOrderError("");
    setOrderCustomerMenuOpen(false);
  };

  const orderPreview = useMemo(() => {
    if (!orderForm) return null;
    const quantity = Math.max(0, Math.round(toNumber(orderForm.quantity, 0)));
    const unitPrice = Math.max(0, Math.round((Number(orderForm.unitPrice) || 0) * 100));
    const subtotal = quantity * unitPrice;
    const discountType = normalizeSaleDiscountType(orderForm.discountType);
    const parsedDiscountInput = Number(String(orderForm.discountValue || "").replace(/,/g, "").trim());
    let discountAmount = 0;

    if (subtotal > 0 && discountType !== "none" && Number.isFinite(parsedDiscountInput) && parsedDiscountInput > 0) {
      if (discountType === "amount") {
        discountAmount = Math.round(parsedDiscountInput * 100);
      } else {
        const percent = Math.min(parsedDiscountInput, 99.99);
        discountAmount = Math.round((subtotal * percent) / 100);
      }
      if (discountAmount >= subtotal) {
        discountAmount = Math.max(subtotal - 1, 0);
      }
    }

    return {
      quantity,
      unitPrice,
      subtotal,
      discountAmount,
      total: Math.max(0, subtotal - discountAmount),
    };
  }, [orderForm]);

  const handleOrderSubmit = async (event) => {
    event.preventDefault();
    if (!orderForm?.id) return;
    setOrderError("");
    const saved = await handleAction(
      "update_sale",
      {
        saleId: orderForm.id,
        quantity: orderForm.quantity,
        saleChannel: orderForm.saleChannel,
        paymentMethod: orderForm.paymentMethod,
        paymentStatus: orderForm.paymentStatus,
        unitPrice: orderForm.unitPrice,
        customerId: orderForm.customerId ? Number(orderForm.customerId) : null,
        customerName: orderForm.customerName,
        customerPhone: orderForm.customerPhone,
        date: orderForm.date,
        notes: orderForm.notes,
      },
      "Water order updated."
    );
    if (!saved) {
      setOrderError("Order update failed. Check the message above.");
      return;
    }
    await loadCustomers();
    closeOrderEditor();
  };

  const handleOrderDelete = async (sale, event = null) => {
    event?.stopPropagation?.();
    const saleId = Number(sale?.id);
    if (!Number.isFinite(saleId) || saleId <= 0) return;
    const customerLabel = String(sale?.customerName || "this order").trim();
    const shouldDelete =
      typeof window === "undefined"
        ? true
        : window.confirm(`Delete order #${saleId} for ${customerLabel}? This cannot be undone.`);
    if (!shouldDelete) return;
    setOrderError("");
    const deleted = await handleAction("delete_sale", { saleId }, "Water order deleted.");
    if (!deleted) {
      if (Number(activeOrderId) === saleId) {
        setOrderError("Delete failed. Check the message above.");
      }
      return;
    }
    markRecordRemoved("sale", saleId);
    if (Number(activeOrderId) === saleId) {
      closeOrderEditor();
    }
  };

  const handleOrderCustomerChange = (nextValue) => {
    const customerId = Number(nextValue);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      setOrderForm((prev) => (prev ? { ...prev, customerId: "" } : prev));
      return;
    }
    const customer = customerById.get(customerId);
    setOrderForm((prev) =>
      prev
        ? {
            ...prev,
            customerId: String(customerId),
            customerName: customer?.name || prev.customerName,
            customerPhone: customer?.phone || prev.customerPhone,
          }
        : prev
    );
    setOrderCustomerMenuOpen(false);
  };

  const handleOrderCustomerInputChange = (nextValue) => {
    setOrderCustomerMenuOpen(true);
    setOrderForm((prev) => {
      if (!prev) return prev;
      const normalizedValue = normalizeCustomerName(nextValue);
      const normalizedSelectedName = normalizeCustomerName(selectedOrderCustomer?.name);
      const keepLinkedCustomer = normalizedValue && normalizedValue === normalizedSelectedName;
      const selectedPhone = String(selectedOrderCustomer?.phone || "").trim();
      const shouldClearPhone =
        !keepLinkedCustomer && prev.customerId && selectedPhone && String(prev.customerPhone || "").trim() === selectedPhone;
      return {
        ...prev,
        customerName: nextValue,
        customerId: keepLinkedCustomer ? prev.customerId : "",
        customerPhone: shouldClearPhone ? "" : prev.customerPhone,
      };
    });
  };

  const commitOrderCustomerInput = () => {
    const typedName = typedOrderCustomerName;
    if (!typedName) {
      setOrderForm((prev) => (prev ? { ...prev, customerId: "", customerName: "" } : prev));
      setOrderCustomerMenuOpen(false);
      return;
    }
    if (matchedTypedOrderCustomer?.id) {
      handleOrderCustomerChange(String(matchedTypedOrderCustomer.id));
      return;
    }
    setOrderForm((prev) =>
      prev
        ? {
            ...prev,
            customerId: "",
            customerName: typedName,
          }
        : prev
    );
    setOrderCustomerMenuOpen(false);
  };

  const handleOrderCustomerInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitOrderCustomerInput();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOrderCustomerMenuOpen(false);
    }
  };

  const handleSaleCustomerChange = (nextValue) => {
    const customerId = Number(nextValue);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      setSaleForm((prev) => ({ ...prev, customerId: "" }));
      return;
    }
    const customer = customerById.get(customerId);
    setSaleForm((prev) => ({
      ...prev,
      customerId: String(customerId),
      customerName: customer?.name || prev.customerName,
      customerPhone: customer?.phone || prev.customerPhone,
    }));
    setSaleCustomerMenuOpen(false);
  };

  const handleSaleCustomerInputChange = (nextValue) => {
    setSaleCustomerMenuOpen(true);
    setSaleForm((prev) => {
      const normalizedValue = normalizeCustomerName(nextValue);
      const normalizedSelectedName = normalizeCustomerName(selectedSaleCustomer?.name);
      const keepLinkedCustomer = normalizedValue && normalizedValue === normalizedSelectedName;
      const selectedPhone = String(selectedSaleCustomer?.phone || "").trim();
      const shouldClearPhone =
        !keepLinkedCustomer &&
        prev.customerId &&
        selectedPhone &&
        String(prev.customerPhone || "").trim() === selectedPhone;
      return {
        ...prev,
        customerName: nextValue,
        customerId: keepLinkedCustomer ? prev.customerId : "",
        customerPhone: shouldClearPhone ? "" : prev.customerPhone,
      };
    });
  };

  const commitSaleCustomerInput = () => {
    const typedName = typedSaleCustomerName;
    if (!typedName) {
      setSaleForm((prev) => ({ ...prev, customerId: "", customerName: "" }));
      setSaleCustomerMenuOpen(false);
      return;
    }
    if (matchedTypedSaleCustomer?.id) {
      handleSaleCustomerChange(String(matchedTypedSaleCustomer.id));
      return;
    }
    setSaleForm((prev) => ({
      ...prev,
      customerId: "",
      customerName: typedName,
    }));
    setSaleCustomerMenuOpen(false);
  };

  const handleSaleCustomerInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitSaleCustomerInput();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setSaleCustomerMenuOpen(false);
    }
  };

  const handleOrderPaymentMethodChange = (nextValue) => {
    const paymentMethod = normalizeSalePaymentMethod(nextValue);
    setOrderForm((prev) => {
      if (!prev) return prev;
      const nextStatus =
        paymentMethod === "credit"
          ? "unpaid"
          : prev.paymentMethod === "credit" && prev.paymentStatus === "unpaid"
            ? "paid"
            : prev.paymentStatus;
      return {
        ...prev,
        paymentMethod,
        paymentStatus: normalizeSalePaymentStatus(nextStatus, paymentMethod),
      };
    });
  };

  const closeLedgerEditor = () => {
    setActiveLedgerItem(null);
    setLedgerForm(null);
    setLedgerError("");
  };

  const openRestockEditor = (restock) => {
    const linkedVendorId = Number(restock?.vendorId);
    const linkedVendor =
      Number.isFinite(linkedVendorId) && linkedVendorId > 0
        ? vendors.find((vendor) => Number(vendor.id) === linkedVendorId) || null
        : null;
    setActiveOrderId(null);
    setOrderForm(null);
    setOrderError("");
    setActiveLedgerItem({ type: "restock", id: Number(restock?.id) || null });
    setLedgerError("");
    setLedgerForm({
      type: "restock",
      id: Number(restock?.id) || null,
      quantity: String(Math.max(1, toNumber(restock?.quantity, 1))),
      vendorId:
        Number.isFinite(linkedVendorId) && linkedVendorId > 0 ? String(linkedVendorId) : "",
      vendorName: linkedVendor?.name || restock?.vendorName || "",
      date: restock?.date ? String(restock.date).slice(0, 10) : todayValue(),
      notes: restock?.notes || "",
    });
  };

  const openAdjustmentEditor = (adjustment) => {
    const signedQuantity = toNumber(adjustment?.quantityDelta, 0);
    const mode = signedQuantity < 0 ? "remove" : "add";
    const quantity = Math.max(1, Math.abs(signedQuantity) || 1);
    const reason = String(adjustment?.reason || "").trim();
    const reasonOptions = ADJUSTMENT_REASON_OPTIONS[mode] || [];
    const useKnownReason = reasonOptions.includes(reason);
    setActiveOrderId(null);
    setOrderForm(null);
    setOrderError("");
    setActiveLedgerItem({ type: "adjustment", id: Number(adjustment?.id) || null });
    setLedgerError("");
    setLedgerForm({
      type: "adjustment",
      id: Number(adjustment?.id) || null,
      mode,
      quantityDelta: String(quantity),
      reason: useKnownReason ? reason : CUSTOM_ADJUSTMENT_REASON,
      customReason: useKnownReason ? "" : reason,
      date: adjustment?.date ? String(adjustment.date).slice(0, 10) : todayValue(),
      notes: adjustment?.notes || "",
    });
  };

  const openExpenseEditor = (expense) => {
    const category = String(expense?.category || "").trim();
    const useKnownCategory = EXPENSE_CATEGORY_OPTIONS.includes(category);
    setActiveOrderId(null);
    setOrderForm(null);
    setOrderError("");
    setActiveLedgerItem({ type: "expense", id: Number(expense?.id) || null });
    setLedgerError("");
    setLedgerForm({
      type: "expense",
      id: Number(expense?.id) || null,
      category: useKnownCategory ? category : CUSTOM_EXPENSE_CATEGORY,
      customCategory: useKnownCategory ? "" : category,
      amount: toMoneyInputValue(expense?.amount),
      description: expense?.description || "",
      date: expense?.date ? String(expense.date).slice(0, 10) : todayValue(),
      notes: expense?.notes || "",
    });
  };

  const openStockEntryEditor = (entry) => {
    if (entry?.type === "restock") {
      const source = restockById.get(Number(entry.sourceId)) || entry;
      openRestockEditor(source);
      return;
    }
    if (entry?.type === "adjustment") {
      const source = adjustmentById.get(Number(entry.sourceId)) || entry;
      openAdjustmentEditor(source);
    }
  };

  const handleLedgerSubmit = async (event) => {
    event.preventDefault();
    if (!ledgerForm?.type || !ledgerForm?.id) return;
    setLedgerError("");

    let saved = false;
    if (ledgerForm.type === "restock") {
      saved = await handleAction(
        "update_restock",
        {
          restockId: ledgerForm.id,
          quantity: ledgerForm.quantity,
          vendorId: ledgerForm.vendorId ? Number(ledgerForm.vendorId) : null,
          vendorName: ledgerSelectedVendorName || ledgerForm.vendorName,
          date: ledgerForm.date,
          notes: ledgerForm.notes,
        },
        "Water restock updated."
      );
    } else if (ledgerForm.type === "adjustment") {
      if (!resolvedLedgerAdjustmentReason) {
        setLedgerError("Choose a reason for this correction.");
        return;
      }
      saved = await handleAction(
        "update_adjustment",
        {
          adjustmentId: ledgerForm.id,
          quantityDelta:
            ledgerForm.mode === "add" ? ledgerAdjustmentQuantity : ledgerAdjustmentQuantity * -1,
          reason: resolvedLedgerAdjustmentReason,
          date: ledgerForm.date,
          notes: ledgerForm.notes,
        },
        "Water correction updated."
      );
    } else if (ledgerForm.type === "expense") {
      if (!resolvedLedgerExpenseCategory) {
        setLedgerError("Choose an expense category or add a custom one.");
        return;
      }
      saved = await handleAction(
        "update_expense",
        {
          expenseId: ledgerForm.id,
          category: resolvedLedgerExpenseCategory,
          amount: ledgerForm.amount,
          description: ledgerForm.description.trim() || `${resolvedLedgerExpenseCategory} expense`,
          date: ledgerForm.date,
          notes: ledgerForm.notes,
        },
        "Water expense updated."
      );
    }

    if (!saved) {
      setLedgerError("Update failed. Check the message above.");
      return;
    }

    closeLedgerEditor();
  };

  const handleExpenseDelete = async (expense, event = null) => {
    event?.stopPropagation?.();
    const expenseId = Number(expense?.id);
    if (!Number.isFinite(expenseId) || expenseId <= 0) return;
    const expenseLabel = String(expense?.description || expense?.category || "this expense").trim();
    const shouldDelete =
      typeof window === "undefined"
        ? true
        : window.confirm(`Delete expense #${expenseId} for ${expenseLabel}? This cannot be undone.`);
    if (!shouldDelete) return;
    setLedgerError("");
    const deleted = await handleAction("delete_expense", { expenseId }, "Water expense deleted.");
    if (!deleted) {
      if (activeLedgerItem?.type === "expense" && Number(activeLedgerItem?.id) === expenseId) {
        setLedgerError("Delete failed. Check the message above.");
      }
      return;
    }
    markRecordRemoved("expense", expenseId);
    if (activeLedgerItem?.type === "expense" && Number(activeLedgerItem?.id) === expenseId) {
      closeLedgerEditor();
    }
  };

  const handleStockEntryUndo = async (entry, event = null) => {
    event?.stopPropagation?.();
    const sourceId = Number(entry?.sourceId ?? entry?.id);
    if (!Number.isFinite(sourceId) || sourceId <= 0) return;
    const isRestock = entry?.type === "restock";
    const isAdjustment = entry?.type === "adjustment";
    if (!isRestock && !isAdjustment) return;
    const entryLabel = isRestock ? "restock" : "stock correction";
    const detailLabel = String(entry?.detail || entry?.label || entryLabel).trim();
    const shouldUndo =
      typeof window === "undefined"
        ? true
        : window.confirm(`Undo ${entryLabel} #${sourceId} for ${detailLabel}? This cannot be undone.`);
    if (!shouldUndo) return;
    setLedgerError("");
    const deleted = await handleAction(
      isRestock ? "delete_restock" : "delete_adjustment",
      isRestock ? { restockId: sourceId } : { adjustmentId: sourceId },
      isRestock ? "Restock undone." : "Stock correction undone."
    );
    if (!deleted) {
      if (activeLedgerItem?.type === entry?.type && Number(activeLedgerItem?.id) === sourceId) {
        setLedgerError("Undo failed. Check the message above.");
      }
      return;
    }
    markRecordRemoved(isRestock ? "restock" : "adjustment", sourceId);
    if (activeLedgerItem?.type === entry?.type && Number(activeLedgerItem?.id) === sourceId) {
      closeLedgerEditor();
    }
  };

  const handleRestockSubmit = async (event) => {
    event.preventDefault();
    const saved = await handleAction(
      "restock",
      {
        quantity: restockForm.quantity,
        vendorId: Number.isFinite(Number(fixedWaterVendor?.id)) ? Number(fixedWaterVendor.id) : null,
        vendorName: restockSupplierLabel,
        date: restockForm.date,
        notes: restockForm.notes,
      },
      "Water stock updated."
    );
    if (saved) {
      setRestockForm({
        quantity: "",
        date: todayValue(),
        notes: "",
      });
    }
  };

  const handleSaleSubmit = async (event) => {
    event.preventDefault();
    const shouldRefreshCustomers = true;
    const successMessage =
      saleForm.paymentMethod === "credit" ? "Water sale recorded on credit." : "Water sale recorded.";
    const saved = await handleAction(
      "sale",
      {
        quantity: saleForm.quantity,
        saleChannel: saleForm.saleChannel,
        paymentMethod: saleForm.paymentMethod,
        unitPrice: saleForm.unitPrice || toMoneyInputValue(salePreview.suggestedUnitPrice),
        discountType: saleForm.discountType,
        discountValue: saleForm.discountValue,
        customerId: saleForm.customerId ? Number(saleForm.customerId) : null,
        customerName: saleForm.customerName,
        customerPhone: saleForm.customerPhone,
        date: saleForm.date,
        notes: saleForm.notes,
      },
      successMessage
    );
    if (saved) {
      setSaleForm((prev) => ({
        ...prev,
        paymentMethod: "cash",
        unitPrice: "",
        discountType: "none",
        discountValue: "",
        customerId: "",
        quantity: "",
        customerName: "",
        customerPhone: "",
        date: todayValue(),
        notes: "",
      }));
      setSaleCustomerMenuOpen(false);
      if (shouldRefreshCustomers) {
        await loadCustomers();
      }
    }
  };

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();
    if (!resolvedExpenseCategory) {
      setError("Choose an expense category or add a custom one.");
      setStatus("");
      return;
    }
    const saved = await handleAction(
      "expense",
      {
        category: resolvedExpenseCategory,
        amount: expenseForm.amount,
        description: expenseForm.description.trim() || `${resolvedExpenseCategory} expense`,
        date: expenseForm.date,
        notes: expenseForm.notes,
      },
      "Water expense recorded."
    );
    if (saved) {
      setExpenseForm({
        category: "",
        customCategory: "",
        amount: "",
        description: "",
        date: todayValue(),
        notes: "",
      });
    }
  };

  const handleAdjustmentSubmit = async (event) => {
    event.preventDefault();
    if (!resolvedAdjustmentReason) {
      setError("Choose a stock correction reason or add a custom one.");
      setStatus("");
      return;
    }
    const saved = await handleAction(
      "adjustment",
      {
        quantityDelta: adjustmentSignedQuantity,
        reason: resolvedAdjustmentReason,
        date: adjustmentForm.date,
        notes: adjustmentForm.notes,
      },
      "Water stock correction saved."
    );
    if (saved) {
      setAdjustmentForm((prev) => ({
        ...prev,
        quantityDelta: "",
        reason: "",
        customReason: "",
        date: todayValue(),
        notes: "",
      }));
    }
  };

  return (
    <div className="water-module-page">
      <div className="water-module-shell">
        <AdminBreadcrumb items={[{ label: "Water" }]} />

        <header className="water-module-header">
          <div>
            <h1>GWater</h1>
          </div>
          <button type="button" className="admin-secondary" onClick={loadModule} disabled={loading || saving}>
            <AppIcon icon={faRotateRight} /> 
          </button>
        </header>

        <InlineNoticeStack
          notices={[
            error
              ? {
                  key: "water-error",
                  tone: "error",
                  title: "Water update failed",
                  message: error,
                }
              : null,
            status
              ? {
                  key: "water-success",
                  tone: "success",
                  title: "Water update saved",
                  message: status,
                }
              : null,
          ]}
        />

        <section className="water-module-kpis">
          <article className="water-module-kpi bubble-card">
            <p className="water-module-kpi-label">In stock</p>
            <div className="water-module-kpi-value">
              <AppIcon icon={faBoxesStacked} />
              <strong>{summary.stockOnHand}</strong>
            </div>
            <span>Inventory value {formatCurrency(summary.inventoryValue)}</span>
          </article>
          <article className="water-module-kpi bubble-card">
            <p className="water-module-kpi-label">Orders</p>
            <div className="water-module-kpi-value">
              <AppIcon icon={faReceipt} />
              <strong>{sales.length}</strong>
            </div>
            <span>{unpaidOrderCount} open</span>
          </article>
          <article className="water-module-kpi bubble-card">
            <p className="water-module-kpi-label">Revenue</p>
            <div className="water-module-kpi-value">
              <AppIcon icon={faReceipt} />
              <strong>{formatCurrency(summary.revenue)}</strong>
            </div>
            <span>
              {summary.unitsSold} packs sold, {formatCurrency(summary.cashCollected)} collected
            </span>
          </article>
          <article className="water-module-kpi bubble-card">
            <p className="water-module-kpi-label">Gross profit</p>
            <div className="water-module-kpi-value">
              <AppIcon icon={faChartLine} />
              <strong>{formatCurrency(summary.grossProfit)}</strong>
            </div>
            <span>After {formatCurrency(summary.costOfGoodsSold)} COGS</span>
          </article>
          <article className="water-module-kpi bubble-card">
            <p className="water-module-kpi-label">Cash position</p>
            <div className="water-module-kpi-value">
              <AppIcon icon={faMoneyCheckDollar} />
              <strong>{formatCurrency(summary.cashPosition)}</strong>
            </div>
            <span>{formatCurrency(summary.cashCollected)} collected</span>
          </article>
          <article className="water-module-kpi bubble-card">
            <p className="water-module-kpi-label">Total credit</p>
            <div className="water-module-kpi-value">
              <AppIcon icon={faMoneyCheckDollar} />
              <strong>{formatCurrency(summary.outstandingCredit)}</strong>
            </div>
            <span>{totalCreditCount} credit orders</span>
          </article>
          <article className="water-module-kpi bubble-card">
            <p className="water-module-kpi-label">Extra expenses</p>
            <div className="water-module-kpi-value">
              <AppIcon icon={faStore} />
              <strong>{formatCurrency(summary.extraExpenses)}</strong>
            </div>
            <span>Net profit {formatCurrency(summary.netProfit)}</span>
          </article>
          <article className="water-module-kpi bubble-card">
            <p className="water-module-kpi-label">Pending cash</p>
            <div className="water-module-kpi-value">
              <AppIcon icon={faMoneyCheckDollar} />
              <strong>{pendingCashCount}</strong>
            </div>
            <span>{formatCurrency(summary.pendingCash)} pending</span>
          </article>
          <article className="water-module-kpi bubble-card">
            <p className="water-module-kpi-label">Pending MoMo</p>
            <div className="water-module-kpi-value">
              <AppIcon icon={faMoneyCheckDollar} />
              <strong>{pendingMomoCount}</strong>
            </div>
            <span>{formatCurrency(summary.pendingMomo)} pending</span>
          </article>
        </section>

        <section className="water-module-network-grid">
          <article className="admin-card water-module-card water-module-card--full bubble-card">
            <div className="water-module-card-head">
              <div>
                <h3>Restock</h3>
              </div>
            </div>
            <form className="water-module-form" onSubmit={handleRestockSubmit}>
              <div className="water-module-sale-block">
                <div className="water-module-inline-head">
                  <span className="water-module-field-label">Quantity</span>
                </div>
                <div className="water-module-quick-actions">
                  {RESTOCK_QUICK_QUANTITIES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`water-module-quick-btn ${restockQuantity === value ? "is-active" : ""}`}
                      onClick={() => setRestockQuantityValue(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="water-module-stepper" aria-label="Restock quantity control">
                  <button
                    type="button"
                    className="water-module-stepper-btn"
                    onClick={() => adjustRestockQuantity(-1)}
                    aria-label="Reduce restock quantity"
                  >
                    <AppIcon icon={faMinus} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={restockForm.quantity}
                    onChange={(event) => setRestockQuantityValue(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="water-module-stepper-btn"
                    onClick={() => adjustRestockQuantity(1)}
                    aria-label="Increase restock quantity"
                  >
                    <AppIcon icon={faPlus} />
                  </button>
                </div>
              </div>
              <div className="water-module-inline-summary">
                <span>{restockSupplierLabel}</span>
                <strong>Cost: {formatCurrency(restockCost)}</strong>
              </div>
              <button
                type="submit"
                className="admin-primary water-module-sale-submit"
                disabled={saving || loading}
              >
                <AppIcon icon={faPlus} />{" "}
                {saving
                  ? "Saving..."
                  : restockQuantity > 0
                    ? `Add ${restockQuantity} pack${restockQuantity === 1 ? "" : "s"}`
                    : "Add stock"}
              </button>
            </form>
          </article>
        </section>

        <section className="water-module-order-section">
          <article className="admin-card water-module-card">
            <div className="water-module-card-head">
              <div>
                <h3>New order</h3>
              </div>
            </div>
            <form className="water-module-form water-module-order-form" onSubmit={handleSaleSubmit}>
              <div className="water-module-sale-block water-module-order-form-block water-module-order-form-block--customer">
                <label>
                  <div className="water-module-inline-head">
                    <span className="water-module-field-label">{saleCustomerLabel}</span>
                  </div>
                  <div className="water-module-customer-picker water-order-customer-picker">
                    <SearchField
                      value={saleForm.customerName}
                      onChange={(event) => handleSaleCustomerInputChange(event.target.value)}
                      onClear={() => {
                        setSaleForm((prev) => ({
                          ...prev,
                          customerId: "",
                          customerName: "",
                          customerPhone: "",
                        }));
                        setSaleCustomerMenuOpen(false);
                      }}
                      onFocus={() => setSaleCustomerMenuOpen(true)}
                      onBlur={() => {
                        setTimeout(() => {
                          setSaleCustomerMenuOpen(false);
                        }, 120);
                      }}
                      onKeyDown={handleSaleCustomerInputKeyDown}
                      placeholder={`Search or add ${saleCustomerLabel.toLowerCase()}`}
                      aria-label={`Search or add ${saleCustomerLabel.toLowerCase()}`}
                      inputClassName="water-order-customer-search"
                      required
                    />
                    {saleCustomerMenuOpen ? (
                      customers.length || typedSaleCustomerName ? (
                        <div className="water-module-customer-options" role="listbox" aria-label="Customer directory">
                          {filteredSaleCustomerOptions.map((customer) => {
                            const isActive = String(customer.id) === String(saleForm.customerId);
                            return (
                              <button
                                key={customer.id}
                                type="button"
                                className={`water-module-customer-option ${isActive ? "is-active" : ""}`}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleSaleCustomerChange(String(customer.id))}
                              >
                                <span>{customer.name}</span>
                                <small>{customer.phone ? customer.phone : `#${customer.id}`}</small>
                              </button>
                            );
                          })}
                          {typedSaleCustomerName && !matchedTypedSaleCustomer ? (
                            <button
                              type="button"
                              className="water-module-customer-option water-order-customer-option--create"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={commitSaleCustomerInput}
                            >
                              <span>Create "{typedSaleCustomerName}"</span>
                              <small>Press Enter</small>
                            </button>
                          ) : null}
                        </div>
                      ) : null
                    ) : null}
                    {selectedSaleCustomer ? (
                      <p className="water-module-inline-note">
                        REEBS #{selectedSaleCustomer.id}
                        {selectedSaleCustomer.phone ? ` · ${selectedSaleCustomer.phone}` : ""}
                      </p>
                    ) : typedSaleCustomerName && !matchedTypedSaleCustomer ? (
                      <p className="water-module-inline-note">New customer on save.</p>
                    ) : null}
                    {customerError && !customers.length ? (
                      <p className="water-module-inline-note">{customerError}</p>
                    ) : null}
                  </div>
                </label>
                <div className="water-module-sale-inline-grid">
                  <label>
                  <div className="water-module-inline-head">
                    <span className="water-module-field-label">Phone Number (Optional)</span>
                  </div>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={saleForm.customerPhone}
                      onChange={(event) =>
                        setSaleForm((prev) => ({ ...prev, customerPhone: event.target.value }))
                      }
                      placeholder="024 000 0000"
                    />
                  </label>
                  <label>
                    <div className="water-module-inline-head">
                      <span className="water-module-field-label">Date</span>
                    </div>
                    <input
                      type="date"
                      value={saleForm.date}
                      onChange={(event) =>
                        setSaleForm((prev) => ({ ...prev, date: event.target.value }))
                      }
                      required
                    />
                  </label>
                </div>
              </div>
              <div className="water-module-order-form-columns">
                <div className="water-module-order-form-column">
                  <div className="water-module-sale-block water-module-order-form-block">
                    <span className="water-module-field-label">Customer type</span>
                    <div className="water-module-toggle-row" role="radiogroup" aria-label="Customer type">
                      <button
                        type="button"
                        className={`water-module-toggle-btn ${saleForm.saleChannel === "retail" ? "is-active" : ""}`}
                        onClick={() => setSaleForm((prev) => ({ ...prev, saleChannel: "retail" }))}
                        aria-pressed={saleForm.saleChannel === "retail"}
                      >
                        Retail
                      </button>
                      <button
                        type="button"
                        className={`water-module-toggle-btn ${saleForm.saleChannel === "company" ? "is-active" : ""}`}
                        onClick={() => setSaleForm((prev) => ({ ...prev, saleChannel: "company" }))}
                        aria-pressed={saleForm.saleChannel === "company"}
                      >
                        Company
                      </button>
                    </div>
                  </div>
                  <div className="water-module-sale-block water-module-order-form-block">
                    <div className="water-module-inline-head">
                      <span className="water-module-field-label">Payment</span>
                    </div>
                    <div className="water-module-quick-actions" role="radiogroup" aria-label="Payment method">
                      {SALE_PAYMENT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`water-module-quick-btn ${
                            saleForm.paymentMethod === option.value ? "is-active" : ""
                          }`}
                          onClick={() =>
                            setSaleForm((prev) => ({
                              ...prev,
                              paymentMethod: option.value,
                            }))
                          }
                          aria-pressed={saleForm.paymentMethod === option.value}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="water-module-order-form-column water-module-order-form-column--divided">
                  <div className="water-module-sale-block water-module-order-form-block">
                    <div className="water-module-inline-head">
                      <span className="water-module-field-label">Quantity</span>
                    </div>
                    <div className="water-module-stepper" aria-label="Sale quantity control">
                      <button
                        type="button"
                        className="water-module-stepper-btn"
                        onClick={() => adjustSaleQuantity(-1)}
                        aria-label="Reduce quantity"
                      >
                        <AppIcon icon={faMinus} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={saleForm.quantity}
                        onChange={(event) => setSaleQuantityValue(event.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="water-module-stepper-btn"
                        onClick={() => adjustSaleQuantity(1)}
                        aria-label="Increase quantity"
                      >
                        <AppIcon icon={faPlus} />
                      </button>
                    </div>
                  </div>
                  <div className="water-module-sale-block water-module-order-form-block">
                    <label>
                      <span className="water-module-field-label">Price Per Pack</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={saleForm.unitPrice || toMoneyInputValue(salePreview.suggestedUnitPrice)}
                        onChange={(event) =>
                          setSaleForm((prev) => ({ ...prev, unitPrice: event.target.value }))
                        }
                        placeholder="0.00"
                        required
                      />
                    </label>
                    {salePreview.usesCustomUnitPrice ? (
                      <p className="water-module-inline-note">
                        Default {formatCurrency(salePreview.suggestedUnitPrice)}.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="water-module-sale-block water-module-order-form-block water-module-order-form-block--full">
                <div className="water-module-inline-head">
                  <span className="water-module-field-label">Discount</span>
                </div>
                <div className="water-module-quick-actions" role="radiogroup" aria-label="Discount type">
                  {SALE_DISCOUNT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`water-module-quick-btn ${
                        saleDiscountType === option.value ? "is-active" : ""
                      }`}
                      onClick={() =>
                        setSaleForm((prev) => ({
                          ...prev,
                          discountType: option.value,
                          discountValue: option.value === "none" ? "" : prev.discountValue,
                        }))
                      }
                      aria-pressed={saleDiscountType === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {saleDiscountType !== "none" ? (
                  <label>
                    {saleDiscountType === "amount" ? "Discount amount (GHS)" : "Discount percent"}
                    <input
                      type="number"
                      min="0.01"
                      max={saleDiscountType === "percent" ? "99.99" : undefined}
                      step="0.01"
                      inputMode="decimal"
                      value={saleForm.discountValue}
                      onChange={(event) => setSaleDiscountValue(event.target.value)}
                      placeholder={saleDiscountType === "amount" ? "0.00" : "5"}
                      required
                    />
                  </label>
                ) : null}
              </div>
              <div className="water-module-order-form-actions">
                <div className="water-module-order-form-summary">
                  <div>
                    <span>{saleRateLabel}</span>
                    <strong>{formatCurrency(salePreview.unitPrice)}</strong>
                  </div>
                  <div>
                    <span>Payment</span>
                    <strong>{salePaymentLabel}</strong>
                  </div>
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatCurrency(salePreview.subtotal)}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>{formatCurrency(salePreview.total)}</strong>
                  </div>
                  {salePreview.discountAmount > 0 ? (
                    <div className="water-module-order-form-summary-item--full">
                      <span>Discount</span>
                      <strong>{formatCurrency(salePreview.discountAmount)}</strong>
                    </div>
                  ) : null}
                </div>
                
                <button type="submit" className="admin-primary water-module-sale-submit" disabled={saving || loading}>
                  <AppIcon icon={faReceipt} /> {saving ? "Saving..." : `Record ${formatCurrency(salePreview.total)}`}
                </button>
              </div>
            </form>
          </article>
        </section>

        <section className="water-module-grid">
          <article className="admin-card water-module-card">
            <div className="water-module-card-head">
              <div>
                <h3>Expenses</h3>
              </div>
            </div>
            <form className="water-module-form" onSubmit={handleExpenseSubmit}>
              <div className="water-module-sale-block">
                <div className="water-module-inline-head">
                  <span className="water-module-field-label">Category</span>
                </div>
                <div className="water-module-quick-actions">
                  {EXPENSE_CATEGORY_OPTIONS.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`water-module-quick-btn ${expenseForm.category === category ? "is-active" : ""}`}
                      onClick={() =>
                        setExpenseForm((prev) => ({
                          ...prev,
                          category,
                          customCategory: "",
                        }))
                      }
                    >
                      {category}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`water-module-quick-btn ${
                      expenseForm.category === CUSTOM_EXPENSE_CATEGORY ? "is-active" : ""
                    }`}
                    onClick={() =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        category: CUSTOM_EXPENSE_CATEGORY,
                      }))
                    }
                  >
                    Other
                  </button>
                </div>
                {expenseForm.category === CUSTOM_EXPENSE_CATEGORY ? (
                  <label>
                    Custom category
                    <input
                      type="text"
                      value={expenseForm.customCategory}
                      onChange={(event) =>
                        setExpenseForm((prev) => ({ ...prev, customCategory: event.target.value }))
                      }
                      placeholder="Delivery, airtime, loading fee..."
                      required
                    />
                  </label>
                ) : null}
              </div>

              <div className="water-module-sale-block">
                <div className="water-module-inline-head">
                  <span className="water-module-field-label">Amount</span>
                </div>
                <div className="water-module-quick-actions">
                  {EXPENSE_QUICK_AMOUNTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`water-module-quick-btn ${expenseAmountValue === value ? "is-active" : ""}`}
                      onClick={() => setExpenseAmountValue(value)}
                    >
                      {formatCurrency(value * 100)}
                    </button>
                  ))}
                </div>
                <div className="water-module-stepper" aria-label="Expense amount control">
                  <button
                    type="button"
                    className="water-module-stepper-btn"
                    onClick={() => adjustExpenseAmount(-1)}
                    aria-label="Reduce expense amount"
                  >
                    <AppIcon icon={faMinus} />
                  </button>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={expenseForm.amount}
                    onChange={(event) => setExpenseAmountValue(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="water-module-stepper-btn"
                    onClick={() => adjustExpenseAmount(1)}
                    aria-label="Increase expense amount"
                  >
                    <AppIcon icon={faPlus} />
                  </button>
                </div>
              </div>

              <div className="water-module-inline-summary">
                <span>{expenseSummaryLabel}</span>
                <strong>{formatCurrency(expenseSummaryAmount)}</strong>
              </div>
              
              <button
                type="submit"
                className="admin-primary water-module-sale-submit"
                disabled={saving || loading}
              >
                <AppIcon icon={faMoneyCheckDollar} />{" "}
                {saving ? "Saving..." : `Log ${formatCurrency(expenseSummaryAmount)}`}
              </button>
            </form>
          </article>

          <article className="admin-card water-module-card">
            <div className="water-module-card-head">
              <div>
                <h3>Correction</h3>
              </div>
            </div>
            <form className="water-module-form" onSubmit={handleAdjustmentSubmit}>
              <div className="water-module-adjustment-block">
                <div className="water-module-toggle-row" role="radiogroup" aria-label="Correction type">
                  <button
                    type="button"
                    className={`water-module-toggle-btn ${adjustmentForm.mode === "remove" ? "is-active is-danger" : ""}`}
                    onClick={() =>
                      setAdjustmentForm((prev) => ({
                        ...prev,
                        mode: "remove",
                        reason:
                          prev.reason === CUSTOM_ADJUSTMENT_REASON ||
                          ADJUSTMENT_REASON_OPTIONS.remove.includes(prev.reason)
                            ? prev.reason
                            : "",
                      }))
                    }
                    aria-pressed={adjustmentForm.mode === "remove"}
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className={`water-module-toggle-btn ${adjustmentForm.mode === "add" ? "is-active is-success" : ""}`}
                    onClick={() =>
                      setAdjustmentForm((prev) => ({
                        ...prev,
                        mode: "add",
                        reason:
                          prev.reason === CUSTOM_ADJUSTMENT_REASON ||
                          ADJUSTMENT_REASON_OPTIONS.add.includes(prev.reason)
                            ? prev.reason
                            : "",
                      }))
                    }
                    aria-pressed={adjustmentForm.mode === "add"}
                  >
                    Add back
                  </button>
                </div>
              </div>
              <div className="water-module-adjustment-block">
                <div className="water-module-inline-head">
                  <span className="water-module-field-label">Quantity</span>
                </div>
                <div className="water-module-quick-actions">
                  {ADJUSTMENT_QUICK_QUANTITIES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`water-module-quick-btn ${adjustmentQuantity === value ? "is-active" : ""}`}
                      onClick={() => setAdjustmentQuantityValue(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="water-module-stepper" aria-label="Correction quantity control">
                  <button
                    type="button"
                    className="water-module-stepper-btn"
                    onClick={() => adjustAdjustmentQuantity(-1)}
                    aria-label="Reduce correction quantity"
                  >
                    <AppIcon icon={faMinus} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={adjustmentForm.quantityDelta}
                    onChange={(event) => setAdjustmentQuantityValue(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="water-module-stepper-btn"
                    onClick={() => adjustAdjustmentQuantity(1)}
                    aria-label="Increase correction quantity"
                  >
                    <AppIcon icon={faPlus} />
                  </button>
                </div>
              </div>
              <div className="water-module-adjustment-block">
                <div className="water-module-inline-head">
                  <span className="water-module-field-label">Reason</span>
                </div>
                <div className="water-module-quick-actions">
                  {adjustmentReasonOptions.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className={`water-module-quick-btn ${adjustmentForm.reason === reason ? "is-active" : ""}`}
                      onClick={() => setAdjustmentForm((prev) => ({ ...prev, reason }))}
                    >
                      {reason}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`water-module-quick-btn ${
                      adjustmentForm.reason === CUSTOM_ADJUSTMENT_REASON ? "is-active" : ""
                    }`}
                    onClick={() =>
                      setAdjustmentForm((prev) => ({
                        ...prev,
                        reason: CUSTOM_ADJUSTMENT_REASON,
                      }))
                    }
                  >
                    Other
                  </button>
                </div>
                {adjustmentHasCustomReason ? (
                  <label>
                    Custom reason
                    <input
                      type="text"
                      value={adjustmentForm.customReason}
                      onChange={(event) =>
                        setAdjustmentForm((prev) => ({ ...prev, customReason: event.target.value }))
                      }
                      placeholder="Breakage, count fix, returned packs..."
                      required
                    />
                  </label>
                ) : null}
              </div>
              <div className="water-module-inline-summary">
                <span>{adjustmentForm.mode === "add" ? "Stock increase" : "Stock decrease"}</span>
                <strong>{adjustmentSummaryLabel}</strong>
              </div>
              <button type="submit" className="admin-primary water-module-sale-submit" disabled={saving || loading}>
                <AppIcon icon={faBoxesStacked} /> {saving ? "Saving..." : "Save correction"}
              </button>
            </form>
          </article>
        </section>

        <section className="water-module-ledgers">
          <article className="admin-card water-module-table-card water-module-table-card--orders">
            <div className="water-module-card-head">
              <div>
                <h3>Orders</h3>
              </div>
              <span className="water-module-card-tag">
                {filteredSales.length}/{sales.length}
              </span>
            </div>
            {loading ? (
              <p className="water-module-empty">Loading orders...</p>
            ) : sales.length ? (
              <>
                <div className="water-module-orders-toolbar">
                  <SearchField
                    value={orderQuery}
                    onChange={(event) => setOrderQuery(event.target.value)}
                    onClear={() => setOrderQuery("")}
                    placeholder="Search customer, phone, order #"
                    aria-label="Search orders"
                    className="water-module-orders-search"
                  />
                  <div className="water-module-status-filters" aria-label="Order status filters">
                    {ORDER_STATUS_FILTER_OPTIONS.map((option) => {
                      const isActive = orderStatusFilter === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`water-module-status-filter ${isActive ? "is-active" : ""}`}
                          onClick={() => setOrderStatusFilter(option.value)}
                          aria-pressed={isActive}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {filteredSales.length ? (
                  <div className="water-module-table-wrap">
                    <table className="water-module-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Customer</th>
                          <th>Status</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Total</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSales.map((sale) => {
                          const paymentStatus = normalizeSalePaymentStatus(
                            sale.paymentStatus,
                            sale.paymentMethod
                          );
                          const isActive = Number(activeOrderId) === Number(sale.id);
                          return (
                            <tr
                              key={sale.id}
                              className={`water-module-order-row ${isActive ? "is-active" : ""}`}
                              onClick={() => openOrderEditor(sale)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  openOrderEditor(sale);
                                }
                              }}
                              tabIndex={0}
                              aria-label={`Edit water order ${sale.id}`}
                            >
                              <td>{formatDate(sale.date)}</td>
                              <td>
                                <div className="water-module-order-primary">
                                  <strong>{sale.customerName || "Walk-in"}</strong>
                                </div>
                              </td>
                              <td>
                                <div className="water-module-order-status">
                                  <span className={`water-module-order-pill is-${paymentStatus}`}>
                                    {getSalePaymentStatusLabel(sale.paymentStatus, sale.paymentMethod)}
                                  </span>
                                </div>
                              </td>
                              <td>{toNumber(sale.quantity)}</td>
                              <td>{formatCurrency(sale.unitPrice)}</td>
                              <td>
                                <div className="water-module-order-total">
                                  <strong>{formatCurrency(sale.totalAmount)}</strong>
                                </div>
                              </td>
                              <td className="water-module-order-actions">
                                <button
                                  type="button"
                                  className="water-module-row-delete"
                                  onClick={(event) => handleOrderDelete(sale, event)}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  aria-label={`Delete water order ${sale.id}`}
                                  disabled={saving || loading}
                                >
                                  <AppIcon icon={faTrash} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="water-module-empty">No orders match this filter.</p>
                )}
              </>
            ) : (
              <p className="water-module-empty">No orders yet.</p>
            )}
          </article>

          <article className="admin-card water-module-table-card">
            <div className="water-module-card-head">
              <div>
                <h3>Stock Movement</h3>
              </div>
              <span className="water-module-card-tag">
                Net movement {summary.unitsRestocked + summary.adjustmentUnits}
              </span>
            </div>
            {loading ? (
              <p className="water-module-empty">Loading stock history...</p>
            ) : stockTimeline.length ? (
              <div className="water-module-table-wrap water-module-table-wrap--stock">
                <table className="water-module-table water-module-table--stock">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Details</th>
                      <th>Qty</th>
                      <th>Value</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {stockTimeline.map((entry) => {
                      const isActive =
                        activeLedgerItem?.type === entry.type &&
                        Number(activeLedgerItem?.id) === Number(entry.sourceId);
                      return (
                      <tr
                        key={entry.id}
                        className={`water-module-click-row ${isActive ? "is-active" : ""}`}
                        onClick={() => openStockEntryEditor(entry)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openStockEntryEditor(entry);
                          }
                        }}
                        tabIndex={0}
                        aria-label={`Edit ${entry.label.toLowerCase()} ${entry.sourceId || ""}`}
                      >
                        <td data-label="Date">{formatDate(entry.date)}</td>
                        <td data-label="Type">{entry.label}</td>
                        <td data-label="Details">{entry.detail}</td>
                        <td
                          data-label="Qty"
                          className={entry.quantity < 0 ? "is-negative" : "is-positive"}
                        >
                          {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                        </td>
                        <td data-label="Value">
                          {entry.amount === null ? "—" : formatCurrency(entry.amount)}
                        </td>
                        <td className="water-module-order-actions">
                          <button
                            type="button"
                            className="water-module-row-undo"
                            onClick={(event) => handleStockEntryUndo(entry, event)}
                            onKeyDown={(event) => event.stopPropagation()}
                            aria-label={`Undo ${entry.label.toLowerCase()} ${entry.sourceId || ""}`}
                            disabled={saving || loading}
                          >
                            <AppIcon icon={faRotateRight} />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="water-module-empty">No stock movement recorded yet.</p>
            )}
          </article>

          <article className="admin-card water-module-table-card">
            <div className="water-module-card-head">
              <div>
                <h3>Expenses</h3>
              </div>
            </div>
            {loading ? (
              <p className="water-module-empty">Loading expenses...</p>
            ) : expenses.length ? (
              <div className="water-module-table-wrap">
                <table className="water-module-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => {
                      const isActive =
                        activeLedgerItem?.type === "expense" &&
                        Number(activeLedgerItem?.id) === Number(expense.id);
                      return (
                      <tr
                        key={expense.id}
                        className={`water-module-click-row ${isActive ? "is-active" : ""}`}
                        onClick={() => openExpenseEditor(expense)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openExpenseEditor(expense);
                          }
                        }}
                        tabIndex={0}
                        aria-label={`Edit water expense ${expense.id}`}
                      >
                        <td>{formatDate(expense.date)}</td>
                        <td>{expense.category}</td>
                        <td>{expense.description}</td>
                        <td>{formatCurrency(expense.amount)}</td>
                        <td className="water-module-order-actions">
                          <button
                            type="button"
                            className="water-module-row-delete"
                            onClick={(event) => handleExpenseDelete(expense, event)}
                            onKeyDown={(event) => event.stopPropagation()}
                            aria-label={`Delete water expense ${expense.id}`}
                            disabled={saving || loading}
                          >
                            <AppIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="water-module-empty">No extra expenses logged yet.</p>
            )}
          </article>
        </section>

        {activeLedgerItem && ledgerForm ? (
          <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="water-ledger-modal-title">
            <div className="admin-modal-panel water-order-modal bubble-card">
              <header>
                <div>
                  <p className="water-module-eyebrow">
                    {activeLedgerItem.type === "restock"
                      ? "Edit restock"
                      : activeLedgerItem.type === "adjustment"
                        ? "Edit correction"
                        : "Edit expense"}
                  </p>
                  <h2 id="water-ledger-modal-title">
                    {activeLedgerItem.type === "restock"
                      ? `Restock #${activeLedgerItem.id}`
                      : activeLedgerItem.type === "adjustment"
                        ? `Correction #${activeLedgerItem.id}`
                        : `Expense #${activeLedgerItem.id}`}
                  </h2>
                  {activeLedgerRecord?.createdAt ? (
                    <div className="water-order-modal-meta">
                      <span className="admin-modal-meta">Created {formatDateTime(activeLedgerRecord.createdAt)}</span>
                    </div>
                  ) : null}
                </div>
                <button type="button" className="admin-close" onClick={closeLedgerEditor} aria-label="Close">
                  <AppIcon icon={faXmark} />
                </button>
              </header>

              <form className="water-module-form water-order-modal-form" onSubmit={handleLedgerSubmit}>
                {ledgerForm.type === "restock" ? (
                  <>
                    <div className="water-order-modal-grid">
                      <label>
                        Link vendor
                        <select
                          value={ledgerForm.vendorId}
                          onChange={(event) => {
                            const nextVendorId = event.target.value;
                            const nextVendor =
                              orderedVendorOptions.find(
                                (vendor) => String(vendor.id) === String(nextVendorId)
                              ) || null;
                            setLedgerForm((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    vendorId: nextVendorId,
                                    vendorName: nextVendor?.name || prev.vendorName,
                                  }
                                : prev
                            );
                          }}
                        >
                          <option value="">No link</option>
                          {orderedVendorOptions.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Vendor
                        <input
                          type="text"
                          value={ledgerForm.vendorName}
                          onChange={(event) =>
                            setLedgerForm((prev) =>
                              prev ? { ...prev, vendorName: event.target.value } : prev
                            )
                          }
                          placeholder="Vendor name"
                          disabled={Boolean(selectedLedgerVendor)}
                        />
                      </label>
                      <label>
                        Qty
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={ledgerForm.quantity}
                          onChange={(event) =>
                            setLedgerForm((prev) =>
                              prev ? { ...prev, quantity: event.target.value } : prev
                            )
                          }
                          required
                        />
                      </label>
                      <label>
                        Date
                        <input
                          type="date"
                          value={ledgerForm.date}
                          onChange={(event) =>
                            setLedgerForm((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                          }
                          required
                        />
                      </label>
                      <label className="water-order-modal-field--wide">
                        Notes
                        <textarea
                          rows="3"
                          value={ledgerForm.notes}
                          onChange={(event) =>
                            setLedgerForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                          }
                          placeholder="Optional"
                        />
                      </label>
                    </div>

                    <div className="water-order-modal-summary bubble-card">
                      <div>
                        <span>Qty</span>
                        <strong>{ledgerRestockQuantity}</strong>
                      </div>
                      <div>
                        <span>Cost</span>
                        <strong>{formatCurrency(ledgerRestockCost)}</strong>
                      </div>
                      <div>
                        <span>Vendor</span>
                        <strong>{ledgerSelectedVendorName || ledgerForm.vendorName || "Unassigned"}</strong>
                      </div>
                    </div>
                  </>
                ) : null}

                {ledgerForm.type === "adjustment" ? (
                  <>
                    <div className="water-order-modal-grid">
                      <label>
                        Type
                        <select
                          value={ledgerForm.mode}
                          onChange={(event) =>
                            setLedgerForm((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    mode: event.target.value,
                                    reason:
                                      prev.reason === CUSTOM_ADJUSTMENT_REASON ||
                                      (ADJUSTMENT_REASON_OPTIONS[event.target.value] || []).includes(prev.reason)
                                        ? prev.reason
                                        : "",
                                  }
                                : prev
                            )
                          }
                        >
                          <option value="remove">Remove</option>
                          <option value="add">Add back</option>
                        </select>
                      </label>
                      <label>
                        Qty
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={ledgerForm.quantityDelta}
                          onChange={(event) =>
                            setLedgerForm((prev) =>
                              prev ? { ...prev, quantityDelta: event.target.value } : prev
                            )
                          }
                          required
                        />
                      </label>
                      <label>
                        Reason
                        <select
                          value={ledgerForm.reason}
                          onChange={(event) =>
                            setLedgerForm((prev) =>
                              prev ? { ...prev, reason: event.target.value } : prev
                            )
                          }
                        >
                          <option value="">Choose reason</option>
                          {ledgerAdjustmentReasonOptions.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                          <option value={CUSTOM_ADJUSTMENT_REASON}>Custom</option>
                        </select>
                      </label>
                      <label>
                        Date
                        <input
                          type="date"
                          value={ledgerForm.date}
                          onChange={(event) =>
                            setLedgerForm((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                          }
                          required
                        />
                      </label>
                      {ledgerAdjustmentHasCustomReason ? (
                        <label className="water-order-modal-field--wide">
                          Custom reason
                          <input
                            type="text"
                            value={ledgerForm.customReason}
                            onChange={(event) =>
                              setLedgerForm((prev) =>
                                prev ? { ...prev, customReason: event.target.value } : prev
                              )
                            }
                            placeholder="Breakage, count fix..."
                            required
                          />
                        </label>
                      ) : null}
                      <label className="water-order-modal-field--wide">
                        Notes
                        <textarea
                          rows="3"
                          value={ledgerForm.notes}
                          onChange={(event) =>
                            setLedgerForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                          }
                          placeholder="Optional"
                        />
                      </label>
                    </div>

                    <div className="water-order-modal-summary bubble-card">
                      <div>
                        <span>Effect</span>
                        <strong>{ledgerForm.mode === "add" ? "Stock in" : "Stock out"}</strong>
                      </div>
                      <div>
                        <span>Qty</span>
                        <strong>{ledgerAdjustmentQuantity}</strong>
                      </div>
                      <div>
                        <span>Summary</span>
                        <strong>{ledgerAdjustmentSummaryLabel || "Set correction"}</strong>
                      </div>
                    </div>
                  </>
                ) : null}

                {ledgerForm.type === "expense" ? (
                  <>
                    <div className="water-order-modal-grid">
                      <label>
                        Category
                        <select
                          value={ledgerForm.category}
                          onChange={(event) =>
                            setLedgerForm((prev) =>
                              prev ? { ...prev, category: event.target.value } : prev
                            )
                          }
                        >
                          <option value="">Choose category</option>
                          {EXPENSE_CATEGORY_OPTIONS.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                          <option value={CUSTOM_EXPENSE_CATEGORY}>Other</option>
                        </select>
                      </label>
                      <label>
                        Amount
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          value={ledgerForm.amount}
                          onChange={(event) =>
                            setLedgerForm((prev) => (prev ? { ...prev, amount: event.target.value } : prev))
                          }
                          required
                        />
                      </label>
                      {ledgerForm.category === CUSTOM_EXPENSE_CATEGORY ? (
                        <label className="water-order-modal-field--wide">
                          Custom category
                          <input
                            type="text"
                            value={ledgerForm.customCategory}
                            onChange={(event) =>
                              setLedgerForm((prev) =>
                                prev ? { ...prev, customCategory: event.target.value } : prev
                              )
                            }
                            placeholder="Transport, labour..."
                            required
                          />
                        </label>
                      ) : null}
                      <label className="water-order-modal-field--wide">
                        Description
                        <input
                          type="text"
                          value={ledgerForm.description}
                          onChange={(event) =>
                            setLedgerForm((prev) =>
                              prev ? { ...prev, description: event.target.value } : prev
                            )
                          }
                          placeholder="Expense detail"
                          required
                        />
                      </label>
                      <label>
                        Date
                        <input
                          type="date"
                          value={ledgerForm.date}
                          onChange={(event) =>
                            setLedgerForm((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                          }
                          required
                        />
                      </label>
                      <label className="water-order-modal-field--wide">
                        Notes
                        <textarea
                          rows="3"
                          value={ledgerForm.notes}
                          onChange={(event) =>
                            setLedgerForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                          }
                          placeholder="Optional"
                        />
                      </label>
                    </div>

                    <div className="water-order-modal-summary bubble-card">
                      <div>
                        <span>Category</span>
                        <strong>{resolvedLedgerExpenseCategory || "Expense"}</strong>
                      </div>
                      <div>
                        <span>Amount</span>
                        <strong>{formatCurrency(ledgerExpenseSummaryAmount)}</strong>
                      </div>
                    </div>
                  </>
                ) : null}

                {ledgerError ? <p className="water-module-feedback water-module-feedback--error">{ledgerError}</p> : null}

                <div className="water-order-modal-actions">
                  {ledgerForm.type === "restock" || ledgerForm.type === "adjustment" ? (
                    <button
                      type="button"
                      className="admin-secondary water-order-undo-btn"
                      onClick={(event) =>
                        handleStockEntryUndo(
                          {
                            type: ledgerForm.type,
                            sourceId: activeLedgerRecord?.id ?? activeLedgerItem?.id,
                            label: ledgerForm.type === "restock" ? "Restock" : "Correction",
                            detail:
                              ledgerForm.type === "restock"
                                ? ledgerSelectedVendorName || ledgerForm.vendorName
                                : ledgerAdjustmentSummaryLabel || ledgerForm.reason,
                          },
                          event
                        )
                      }
                      disabled={saving || loading}
                    >
                      <AppIcon icon={faRotateRight} /> Undo
                    </button>
                  ) : null}
                  {ledgerForm.type === "expense" ? (
                    <button
                      type="button"
                      className="admin-secondary water-order-delete-btn"
                      onClick={(event) => handleExpenseDelete(activeLedgerRecord, event)}
                      disabled={saving || loading}
                    >
                      <AppIcon icon={faTrash} /> Delete
                    </button>
                  ) : null}
                  <button type="button" className="admin-secondary" onClick={closeLedgerEditor}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-primary" disabled={saving || loading}>
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {activeOrderId && orderForm ? (
          <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="water-order-modal-title">
            <div className="admin-modal-panel water-order-modal water-order-editor-modal bubble-card">
              <header>
                <div>
                  <p className="water-module-eyebrow">Edit order</p>
                  <h2 id="water-order-modal-title">Order #{activeOrderId}</h2>
                  <div className="water-order-modal-meta">
                    <span
                      className={`water-module-order-pill is-${normalizeSalePaymentStatus(
                        orderForm.paymentStatus,
                        orderForm.paymentMethod
                      )}`}
                    >
                      {getSalePaymentStatusLabel(orderForm.paymentStatus, orderForm.paymentMethod)}
                    </span>
                    {activeOrder?.createdAt ? (
                      <span className="admin-modal-meta">Created {formatDateTime(activeOrder.createdAt)}</span>
                    ) : null}
                    {orderForm.updatedAt ? (
                      <span className="admin-modal-meta">
                        Edited {formatDateTime(orderForm.updatedAt)}
                        {orderForm.updatedByName ? ` by ${orderForm.updatedByName}` : ""}
                      </span>
                    ) : null}
                  </div>
                </div>
                <button type="button" className="admin-close" onClick={closeOrderEditor} aria-label="Close">
                  <AppIcon icon={faXmark} />
                </button>
              </header>

              <form className="water-module-form water-order-modal-form water-order-editor-form" onSubmit={handleOrderSubmit}>
                <div className="water-order-modal-grid">
                  <label className="water-order-modal-field--wide">
                    Customer
                    <div className="water-module-customer-picker water-order-customer-picker">
                      <SearchField
                      value={orderForm.customerName}
                        onChange={(event) => handleOrderCustomerInputChange(event.target.value)}
                        onClear={() => {
                          setOrderForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  customerId: "",
                                  customerName: "",
                                  customerPhone: "",
                                }
                              : prev
                          );
                          setOrderCustomerMenuOpen(false);
                        }}
                        onFocus={() => setOrderCustomerMenuOpen(true)}
                        onBlur={() => {
                          setTimeout(() => {
                            setOrderCustomerMenuOpen(false);
                          }, 120);
                        }}
                        onKeyDown={handleOrderCustomerInputKeyDown}
                        placeholder="Search or add customer"
                        aria-label="Search or add customer"
                        inputClassName="water-order-customer-search"
                        required
                      />
                      {orderCustomerMenuOpen ? (
                        customers.length || typedOrderCustomerName ? (
                          <div className="water-module-customer-options" role="listbox" aria-label="Customer directory">
                            {filteredOrderCustomerOptions.map((customer) => {
                              const isActive = String(customer.id) === String(orderForm.customerId);
                              return (
                                <button
                                  key={customer.id}
                                  type="button"
                                  className={`water-module-customer-option ${isActive ? "is-active" : ""}`}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => handleOrderCustomerChange(String(customer.id))}
                                >
                                  <span>{customer.name}</span>
                                  <small>
                                    {customer.phone ? customer.phone : `#${customer.id}`}
                                  </small>
                                </button>
                              );
                            })}
                            {typedOrderCustomerName && !matchedTypedOrderCustomer ? (
                              <button
                                type="button"
                                className="water-module-customer-option water-order-customer-option--create"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={commitOrderCustomerInput}
                              >
                                <span>Create "{typedOrderCustomerName}"</span>
                                <small>Press Enter</small>
                              </button>
                            ) : null}
                          </div>
                        ) : null
                      ) : null}
                      {selectedOrderCustomer ? (
                        <p className="water-module-inline-note">
                          REEBS #{selectedOrderCustomer.id}
                          {selectedOrderCustomer.phone ? ` · ${selectedOrderCustomer.phone}` : ""}
                        </p>
                      ) : typedOrderCustomerName && !matchedTypedOrderCustomer ? (
                        <p className="water-module-inline-note">New customer on save.</p>
                      ) : null}
                    </div>
                  </label>
                  <label>
                    Phone
                    <input
                      type="tel"
                      inputMode="tel"
                      value={orderForm.customerPhone}
                      onChange={(event) =>
                        setOrderForm((prev) => (prev ? { ...prev, customerPhone: event.target.value } : prev))
                      }
                      placeholder="024 000 0000"
                    />
                  </label>
                  <label>
                    Type
                    <select
                      value={orderForm.saleChannel}
                      onChange={(event) =>
                        setOrderForm((prev) =>
                          prev ? { ...prev, saleChannel: normalizeChannel(event.target.value) } : prev
                        )
                      }
                    >
                      <option value="retail">Retail</option>
                      <option value="company">Company</option>
                    </select>
                  </label>
                  <label>
                    Qty
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={orderForm.quantity}
                      onChange={(event) =>
                        setOrderForm((prev) => (prev ? { ...prev, quantity: event.target.value } : prev))
                      }
                      required
                    />
                  </label>
                  <label>
                    Sale price
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={orderForm.unitPrice}
                      onChange={(event) =>
                        setOrderForm((prev) => (prev ? { ...prev, unitPrice: event.target.value } : prev))
                      }
                      required
                    />
                  </label>
                  <label>
                    Payment
                    <select
                      value={orderForm.paymentMethod}
                      onChange={(event) => handleOrderPaymentMethodChange(event.target.value)}
                    >
                      {SALE_PAYMENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={orderForm.paymentStatus}
                      onChange={(event) =>
                        setOrderForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                paymentStatus: normalizeSalePaymentStatus(event.target.value, prev.paymentMethod),
                              }
                            : prev
                        )
                      }
                    >
                      {ORDER_STATUS_FILTER_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      value={orderForm.date}
                      onChange={(event) =>
                        setOrderForm((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                      }
                      required
                    />
                  </label>
                  <label className="water-order-modal-field--wide">
                    Notes
                    <textarea
                      rows="3"
                      value={orderForm.notes}
                      onChange={(event) =>
                        setOrderForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                      }
                      placeholder="Optional"
                    />
                  </label>
                </div>

                <div className="water-order-modal-summary bubble-card">
                  <div>
                    <span>Reference</span>
                    <strong>{orderForm.paymentReference || `WATER-${orderForm.id}`}</strong>
                  </div>
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatCurrency(orderPreview?.subtotal)}</strong>
                  </div>
                  {orderPreview?.discountAmount ? (
                    <div>
                      <span>Discount</span>
                      <strong>{formatCurrency(orderPreview.discountAmount)}</strong>
                    </div>
                  ) : null}
                  <div>
                    <span>Total</span>
                    <strong>{formatCurrency(orderPreview?.total)}</strong>
                  </div>
                </div>

                {orderError ? <p className="water-module-feedback water-module-feedback--error">{orderError}</p> : null}

                <div className="water-order-modal-actions">
                  <button
                    type="button"
                    className="admin-secondary water-order-delete-btn"
                    onClick={(event) => handleOrderDelete(activeOrder, event)}
                    disabled={saving || loading}
                  >
                    <AppIcon icon={faTrash} /> Delete
                  </button>
                  <button type="button" className="admin-secondary" onClick={closeOrderEditor}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-primary" disabled={saving || loading}>
                    {saving ? "Saving..." : "Save order"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default AdminWater;
