/* eslint-disable react-hooks/exhaustive-deps */
import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import "./AdminWater.css";
import { AppIcon } from "/src/components/Icon/Icon";
import { faRotateRight } from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { InlineNoticeStack } from "../../components/InlineNotice/InlineNotice";
import WaterKpiGrid from "./components/WaterKpiGrid";
import WaterLedgersSection from "./components/WaterLedgersSection";
import WaterLedgerEditorModal from "./components/WaterLedgerEditorModal";
import WaterOperationsGrid from "./components/WaterOperationsGrid";
import WaterOrderEditorModal from "./components/WaterOrderEditorModal";
import WaterOrderFormCard from "./components/WaterOrderFormCard";
import WaterRestockCard from "./components/WaterRestockCard";
import { buildRestockPeriods, filterEntriesByRestockPeriod } from "./waterPeriodUtils";
import {
  parseMoneyInputValue,
  toMoneyInputValue,
} from "./waterPriceUtils";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { reebsApiResponse } from "../../api/client";
import {
  calculateWaterCostBasis,
  DEFAULT_WATER_UNIT_COST,
} from "../../../shared/waterFinancials";

const DEFAULT_PURCHASE_COST = DEFAULT_WATER_UNIT_COST;
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
      currency: null,
      retailSingle: null,
      retailBulk: null,
      company: null,
      bulkThreshold: null,
      discountLimitBps: null,
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
    cashSalesTotal: 0,
    momoSalesTotal: 0,
    pendingCash: 0,
    pendingMomo: 0,
    cashPosition: 0,
    inventoryValue: 0,
    currentUnitCost: DEFAULT_PURCHASE_COST,
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
  const companyPrice = Math.max(0, toNumber(pricing?.company, 0));
  const retailPrice = Math.max(0, toNumber(pricing?.retailSingle, 0));
  const bulkPrice = Math.max(0, toNumber(pricing?.retailBulk, 0));
  const bulkThreshold = Math.max(1, Math.round(toNumber(pricing?.bulkThreshold, 1)));
  if (saleChannel === "company") return companyPrice;
  return quantity >= bulkThreshold ? bulkPrice : retailPrice;
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
  const cashSalesTotal = sales.reduce((sum, row) => {
    return normalizeSalePaymentMethod(row?.paymentMethod) === "cash"
      ? sum + toNumber(row?.totalAmount)
      : sum;
  }, 0);
  const momoSalesTotal = sales.reduce((sum, row) => {
    return normalizeSalePaymentMethod(row?.paymentMethod) === "momo"
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
  const {
    restockSpend,
    currentUnitCost,
    costOfGoodsSold,
    inventoryValue,
  } = calculateWaterCostBasis({
    restocks,
    sales,
    unitsSold,
    stockOnHand,
    fallbackUnitCost: resolvedPurchaseCost,
  });
  const grossProfit = revenue - costOfGoodsSold;
  const netProfit = grossProfit - extraExpenses;
  const cashPosition = cashCollected - restockSpend - extraExpenses;

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
    cashSalesTotal,
    momoSalesTotal,
    pendingCash,
    pendingMomo,
    cashPosition,
    inventoryValue,
    currentUnitCost,
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
  const [stockPeriodFilter, setStockPeriodFilter] = useState("current");
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [orderForm, setOrderForm] = useState(null);
  const [orderError, setOrderError] = useState("");
  const [orderCustomerMenuOpen, setOrderCustomerMenuOpen] = useState(false);
  const [activeLedgerItem, setActiveLedgerItem] = useState(null);
  const [ledgerForm, setLedgerForm] = useState(null);
  const [ledgerError, setLedgerError] = useState("");
  const { user, authReady } = useAuth();
  const canManageWaterPricing = ["owner", "admin"].includes(
    String(user?.role || "").trim().toLowerCase()
  );
  const [removedRecordIds, setRemovedRecordIds] = useState({
    sale: [],
    expense: [],
    restock: [],
    adjustment: [],
  });

  const [restockForm, setRestockForm] = useState({
    quantity: "",
    unitCost: "",
    date: todayValue(),
    notes: "",
  });
  const [saleForm, setSaleForm] = useState({
    quantity: "",
    saleChannel: "retail",
    paymentMethod: "cash",
    unitPrice: "",
    priceOverrideReason: "",
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
    const response = await reebsApiResponse("/api/water", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Failed to load the water module.");
    }
    setDashboard(data && typeof data === "object" ? data : buildDefaultDashboard());
  };

  const loadVendors = async () => {
    setVendorError("");
    try {
      const response = await reebsApiResponse("/api/vendors", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
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
      const response = await reebsApiResponse("/api/customers", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
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
      setDashboard((previous) => ({
        ...previous,
        product: {
          ...previous.product,
          pricing: buildDefaultDashboard().product.pricing,
        },
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setError("Please sign in to access the water module.");
      setDashboard(buildDefaultDashboard());
      return;
    }
    loadModule();
  }, [authReady, user]);

  const pricing = dashboard?.product?.pricing || buildDefaultDashboard().product.pricing;
  const retailPriceCents = Math.max(0, toNumber(pricing?.retailSingle, 0));

  const handleAction = async (action, payload, successMessage) => {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await reebsApiResponse("/api/water", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
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
  const latestRecordedRestockUnitCost = useMemo(() => {
    const latest = [...dashboardRestocks]
      .sort((left, right) => {
        const dateDifference = new Date(right?.date || 0).getTime() - new Date(left?.date || 0).getTime();
        if (dateDifference !== 0) return dateDifference;
        return Number(right?.id || 0) - Number(left?.id || 0);
      })
      .find((entry) => toNumber(entry?.unitCost, 0) > 0);
    return latest ? toNumber(latest.unitCost, 0) : 0;
  }, [dashboardRestocks]);
  useEffect(() => {
    if (loading || latestRecordedRestockUnitCost <= 0) return;
    setRestockForm((previous) =>
      previous.unitCost
        ? previous
        : { ...previous, unitCost: toMoneyInputValue(latestRecordedRestockUnitCost) }
    );
  }, [latestRecordedRestockUnitCost, loading]);
  const summary = useMemo(
    () =>
      buildWaterSummary({
        restocks,
        sales,
        expenses,
        adjustments,
        purchaseCost: DEFAULT_PURCHASE_COST,
      }),
    [adjustments, expenses, restocks, sales]
  );
  const restockPeriods = useMemo(() => buildRestockPeriods(restocks, formatDate), [restocks]);
  const currentStockPeriod = useMemo(
    () => restockPeriods.find((period) => period.isCurrent) || null,
    [restockPeriods]
  );
  useEffect(() => {
    if (stockPeriodFilter === "current" || stockPeriodFilter === "all") return;
    if (!restockPeriods.some((period) => period.value === stockPeriodFilter)) {
      setStockPeriodFilter("current");
    }
  }, [restockPeriods, stockPeriodFilter]);
  const activeStockPeriod = useMemo(() => {
    if (stockPeriodFilter === "all") return null;
    if (stockPeriodFilter === "current") return currentStockPeriod;
    return restockPeriods.find((period) => period.value === stockPeriodFilter) || currentStockPeriod;
  }, [currentStockPeriod, restockPeriods, stockPeriodFilter]);
  const trackedRestocks = useMemo(
    () => filterEntriesByRestockPeriod(restocks, activeStockPeriod),
    [activeStockPeriod, restocks]
  );
  const trackedSales = useMemo(
    () => filterEntriesByRestockPeriod(sales, activeStockPeriod),
    [activeStockPeriod, sales]
  );
  const trackedExpenses = useMemo(
    () => filterEntriesByRestockPeriod(expenses, activeStockPeriod),
    [activeStockPeriod, expenses]
  );
  const trackedAdjustments = useMemo(
    () => filterEntriesByRestockPeriod(adjustments, activeStockPeriod),
    [activeStockPeriod, adjustments]
  );
  const trackedSummary = useMemo(
    () =>
      buildWaterSummary({
        restocks: trackedRestocks,
        sales: trackedSales,
        expenses: trackedExpenses,
        adjustments: trackedAdjustments,
        purchaseCost: DEFAULT_PURCHASE_COST,
      }),
    [trackedAdjustments, trackedExpenses, trackedRestocks, trackedSales]
  );
  const stockPeriodOptions = useMemo(
    () => [
      { value: "current", label: "Current stock" },
      { value: "all", label: "All time" },
      ...restockPeriods
        .filter((period) => !period.isCurrent)
        .map((period) => ({
          value: period.value,
          label: `Previous · ${period.label}`,
        })),
    ],
    [restockPeriods]
  );
  const stockPeriodDetail = useMemo(() => {
    if (stockPeriodFilter === "all") {
      return "All water activity";
    }
    if (!activeStockPeriod) {
      return "Latest stock activity";
    }
    return activeStockPeriod.isCurrent
      ? `Current stock · ${activeStockPeriod.label}`
      : `Previous stock · ${activeStockPeriod.label}`;
  }, [activeStockPeriod, stockPeriodFilter]);
  const isAllTimeStockView = stockPeriodFilter === "all" || !activeStockPeriod;
  const stockScopeLabel = isAllTimeStockView
    ? "all time"
    : activeStockPeriod?.isCurrent
      ? "this stock window"
      : "this previous stock window";
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
    return trackedSales.filter((sale) => {
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
  }, [customerById, deferredOrderQuery, orderStatusFilter, trackedSales]);
  const unpaidOrderCount = useMemo(
    () =>
      trackedSales.filter((sale) => normalizeSalePaymentStatus(sale.paymentStatus, sale.paymentMethod) !== "paid")
        .length,
    [trackedSales]
  );
  const totalCreditCount = useMemo(
    () =>
      trackedSales.filter(
        (sale) =>
          normalizeSalePaymentMethod(sale.paymentMethod) === "credit" &&
          normalizeSalePaymentStatus(sale.paymentStatus, sale.paymentMethod) !== "paid"
      ).length,
    [trackedSales]
  );
  const salePreview = useMemo(() => {
    const quantity = Math.max(0, Math.round(toNumber(saleForm.quantity, 0)));
    const suggestedUnitPrice = getPreviewUnitPrice(quantity, pricing, saleForm.saleChannel);
    const enteredUnitPrice = canManageWaterPricing
      ? Math.max(0, Math.round((Number(saleForm.unitPrice) || 0) * 100))
      : 0;
    const unitPrice = enteredUnitPrice || suggestedUnitPrice;
    const subtotal = quantity * unitPrice;
    const discountType = normalizeSaleDiscountType(saleForm.discountType);
    const parsedDiscountInput = Number(String(saleForm.discountValue || "").replace(/,/g, "").trim());
    let discountAmount = 0;

    if (subtotal > 0 && discountType !== "none" && Number.isFinite(parsedDiscountInput) && parsedDiscountInput > 0) {
      if (discountType === "amount") {
        discountAmount = Math.round(parsedDiscountInput * 100);
      } else {
        const configuredLimit = Math.max(0, toNumber(pricing?.discountLimitBps, 0)) / 100;
        const percent = Math.min(parsedDiscountInput, configuredLimit);
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
      pricingAvailable: suggestedUnitPrice > 0,
      usesCustomUnitPrice: enteredUnitPrice > 0 && enteredUnitPrice !== suggestedUnitPrice,
      subtotal,
      discountAmount,
      total: Math.max(0, subtotal - discountAmount),
    };
  }, [
    canManageWaterPricing,
    pricing,
    saleForm.discountType,
    saleForm.discountValue,
    saleForm.quantity,
    saleForm.saleChannel,
    saleForm.unitPrice,
  ]);

  const stockTimeline = useMemo(() => {
    const restockRows = trackedRestocks.map((item) => ({
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
    const adjustmentRows = trackedAdjustments.map((item) => ({
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
  }, [trackedAdjustments, trackedRestocks]);

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
  const restockUnitCostInputValue = restockForm.unitCost;
  const restockUnitCost = parseMoneyInputValue(restockUnitCostInputValue) || 0;
  const restockCost = restockQuantity * restockUnitCost;
  const restockSupplierLabel = fixedWaterVendor?.name || WATER_SUPPLIER_NAME;
  const saleCustomerLabel = saleForm.saleChannel === "company" ? "Company name" : "Customer name";
  const configuredBulkThreshold = Math.max(
    1,
    Math.round(toNumber(pricing?.bulkThreshold, 1))
  );
  const saleRateLabel =
    salePreview.usesCustomUnitPrice
      ? "Custom rate"
      : saleForm.saleChannel === "company"
        ? "Company rate"
        : salePreview.quantity >= configuredBulkThreshold
          ? `Bulk rate (${configuredBulkThreshold}+)`
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
  const ledgerRestockUnitCost =
    ledgerForm?.type === "restock" ? parseMoneyInputValue(ledgerForm.unitCost) || 0 : 0;
  const ledgerRestockCost = ledgerRestockQuantity * ledgerRestockUnitCost;
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
      originalUnitPrice: Math.max(0, toNumber(sale?.unitPrice, 0)),
      standardUnitPrice: Math.max(
        0,
        toNumber(sale?.standardUnitPrice, sale?.unitPrice)
      ),
      existingPriceOverrideReason: sale?.priceOverrideReason || "",
      priceOverrideReason: "",
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

  const orderPriceChanged = Boolean(
    orderForm
      && parseMoneyInputValue(orderForm.unitPrice) !== Number(orderForm.originalUnitPrice)
  );

  const handleOrderSubmit = async (event) => {
    event.preventDefault();
    if (!orderForm?.id) return;
    setOrderError("");
    if (orderPriceChanged && !canManageWaterPricing) {
      setOrderError("You do not have permission to change Water prices.");
      return;
    }
    if (orderPriceChanged && !String(orderForm.priceOverrideReason || "").trim()) {
      setOrderError("Add a reason for changing the Water sale price.");
      return;
    }
    const saved = await handleAction(
      "update_sale",
      {
        saleId: orderForm.id,
        quantity: orderForm.quantity,
        saleChannel: orderForm.saleChannel,
        paymentMethod: orderForm.paymentMethod,
        paymentStatus: orderForm.paymentStatus,
        ...(orderPriceChanged
          ? {
              unitPrice: orderForm.unitPrice,
              priceOverrideReason: orderForm.priceOverrideReason,
            }
          : {}),
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
        : window.confirm(`Archive order #${saleId} for ${customerLabel}?`);
    if (!shouldDelete) return;
    setOrderError("");
    const deleted = await handleAction("delete_sale", { saleId }, "Water order archived.");
    if (!deleted) {
      if (Number(activeOrderId) === saleId) {
        setOrderError("Archive failed. Check the message above.");
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
      unitCost: toMoneyInputValue(toNumber(restock?.unitCost, productPurchaseCost)),
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
      if (!ledgerRestockUnitCost) {
        setLedgerError("Enter a cost price per pack greater than zero.");
        return;
      }
      saved = await handleAction(
        "update_restock",
        {
          restockId: ledgerForm.id,
          quantity: ledgerForm.quantity,
          unitCost: toMoneyInputValue(ledgerRestockUnitCost),
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
        : window.confirm(`Archive expense #${expenseId} for ${expenseLabel}?`);
    if (!shouldDelete) return;
    setLedgerError("");
    const deleted = await handleAction("delete_expense", { expenseId }, "Water expense archived.");
    if (!deleted) {
      if (activeLedgerItem?.type === "expense" && Number(activeLedgerItem?.id) === expenseId) {
        setLedgerError("Archive failed. Check the message above.");
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
    if (!restockUnitCost) {
      setError("Enter a restock cost price per pack greater than zero.");
      setStatus("");
      return;
    }
    const saved = await handleAction(
      "restock",
      {
        quantity: restockForm.quantity,
        unitCost: toMoneyInputValue(restockUnitCost),
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
        unitCost: toMoneyInputValue(restockUnitCost),
        date: todayValue(),
        notes: "",
      });
    }
  };

  const handleSaleSubmit = async (event) => {
    event.preventDefault();
    if (!salePreview.pricingAvailable) {
      setError("Water pricing is unavailable. Ask an administrator to configure an active price.");
      setStatus("");
      return;
    }
    if (
      salePreview.usesCustomUnitPrice
      && !String(saleForm.priceOverrideReason || "").trim()
    ) {
      setError("Add a reason for the Water price override.");
      setStatus("");
      return;
    }
    const shouldRefreshCustomers = true;
    const successMessage =
      saleForm.paymentMethod === "credit" ? "Water sale recorded on credit." : "Water sale recorded.";
    const saved = await handleAction(
      "sale",
      {
        quantity: saleForm.quantity,
        saleChannel: saleForm.saleChannel,
        paymentMethod: saleForm.paymentMethod,
        ...(salePreview.usesCustomUnitPrice
          ? {
              unitPrice: saleForm.unitPrice,
              priceOverrideReason: saleForm.priceOverrideReason,
            }
          : {}),
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
        priceOverrideReason: "",
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

  const notices = [
    pricing?.configurationError
      ? {
          key: "water-pricing-configuration",
          tone: "warning",
          title: "Water pricing unavailable",
          message: `${pricing.configurationError} New Water sales are blocked until an authorized administrator schedules the required Water prices in Commercial Settings.`,
          dismissible: false,
        }
      : null,
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
  ];

  const saleCustomerPickerProps = {
    value: saleForm.customerName,
    onChange: (event) => handleSaleCustomerInputChange(event.target.value),
    onClear: () => {
      setSaleForm((prev) => ({
        ...prev,
        customerId: "",
        customerName: "",
        customerPhone: "",
      }));
      setSaleCustomerMenuOpen(false);
    },
    onFocus: () => setSaleCustomerMenuOpen(true),
    onBlur: () => {
      setTimeout(() => {
        setSaleCustomerMenuOpen(false);
      }, 120);
    },
    onKeyDown: handleSaleCustomerInputKeyDown,
    placeholder: `Search or add ${saleCustomerLabel.toLowerCase()}`,
    ariaLabel: `Search or add ${saleCustomerLabel.toLowerCase()}`,
    menuOpen: saleCustomerMenuOpen,
    options: filteredSaleCustomerOptions,
    selectedCustomerId: saleForm.customerId,
    onSelectCustomer: handleSaleCustomerChange,
    typedCustomerName: typedSaleCustomerName,
    matchedTypedCustomer: matchedTypedSaleCustomer,
    onCreateCustomer: commitSaleCustomerInput,
    selectedCustomer: selectedSaleCustomer,
    directoryError: customerError,
    showDirectoryError: !customers.length,
  };

  const orderCustomerPickerProps = {
    value: orderForm?.customerName || "",
    onChange: (event) => handleOrderCustomerInputChange(event.target.value),
    onClear: () => {
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
    },
    onFocus: () => setOrderCustomerMenuOpen(true),
    onBlur: () => {
      setTimeout(() => {
        setOrderCustomerMenuOpen(false);
      }, 120);
    },
    onKeyDown: handleOrderCustomerInputKeyDown,
    placeholder: "Search or add customer",
    ariaLabel: "Search or add customer",
    menuOpen: orderCustomerMenuOpen,
    options: filteredOrderCustomerOptions,
    selectedCustomerId: orderForm?.customerId || "",
    onSelectCustomer: handleOrderCustomerChange,
    typedCustomerName: typedOrderCustomerName,
    matchedTypedCustomer: matchedTypedOrderCustomer,
    onCreateCustomer: commitOrderCustomerInput,
    selectedCustomer: selectedOrderCustomer,
  };

  const saleUnitPriceInputValue = saleForm.unitPrice || toMoneyInputValue(salePreview.suggestedUnitPrice);
  const netMovement = trackedSummary.unitsRestocked + trackedSummary.adjustmentUnits;

  return (
    <div className="water-module-page">
      <div className="water-module-shell">
        <AdminBreadcrumb items={[{ label: "Water" }]} />

        <AdminPageHeader
          className="water-module-header"
          copyClassName="water-module-header-copy"
          title="GWater"
          actionsClassName="admin-header-actions water-module-header-actions"
          actions={
            <button type="button" className="admin-secondary" onClick={loadModule} disabled={loading || saving} aria-label="Refresh GWater data" title="Refresh GWater data">
              <AppIcon icon={faRotateRight} />
            </button>
          }
        />

        <InlineNoticeStack notices={notices} />

        <WaterKpiGrid
          liveSummary={summary}
          trackingSummary={trackedSummary}
          salesCount={trackedSales.length}
          unpaidOrderCount={unpaidOrderCount}
          totalCreditCount={totalCreditCount}
          stockPeriodFilter={stockPeriodFilter}
          setStockPeriodFilter={setStockPeriodFilter}
          stockPeriodOptions={stockPeriodOptions}
          stockPeriodDetail={stockPeriodDetail}
          formatCurrency={formatCurrency}
        />

        <WaterRestockCard
          onSubmit={handleRestockSubmit}
          retailPriceLabel={formatCurrency(retailPriceCents)}
          retailPriceAvailable={retailPriceCents > 0}
          canManageWaterPricing={canManageWaterPricing}
          formatCurrency={formatCurrency}
          quickQuantities={RESTOCK_QUICK_QUANTITIES}
          restockQuantity={restockQuantity}
          quantityValue={restockForm.quantity}
          unitCostValue={restockUnitCostInputValue}
          onSelectQuickQuantity={setRestockQuantityValue}
          onAdjustQuantity={adjustRestockQuantity}
          onQuantityChange={setRestockQuantityValue}
          onUnitCostChange={(nextValue) =>
            setRestockForm((prev) => ({ ...prev, unitCost: nextValue }))
          }
          supplierLabel={restockSupplierLabel}
          restockCost={restockCost}
          saving={saving}
          loading={loading}
        />

        <WaterOrderFormCard
          onSubmit={handleSaleSubmit}
          saleForm={saleForm}
          setSaleForm={setSaleForm}
          saleCustomerLabel={saleCustomerLabel}
          customerPickerProps={saleCustomerPickerProps}
          unitPriceInputValue={saleUnitPriceInputValue}
          canManageWaterPricing={canManageWaterPricing}
          salePreview={salePreview}
          saleRateLabel={saleRateLabel}
          salePaymentLabel={salePaymentLabel}
          saleDiscountType={saleDiscountType}
          salePaymentOptions={SALE_PAYMENT_OPTIONS}
          saleDiscountOptions={SALE_DISCOUNT_OPTIONS}
          onQuantityChange={setSaleQuantityValue}
          onAdjustQuantity={adjustSaleQuantity}
          onDiscountChange={setSaleDiscountValue}
          formatCurrency={formatCurrency}
          saving={saving}
          loading={loading}
          pricingAvailable={salePreview.pricingAvailable}
        />

        <WaterOperationsGrid
          expenseCategoryOptions={EXPENSE_CATEGORY_OPTIONS}
          customExpenseCategory={CUSTOM_EXPENSE_CATEGORY}
          expenseQuickAmounts={EXPENSE_QUICK_AMOUNTS}
          expenseForm={expenseForm}
          setExpenseForm={setExpenseForm}
          expenseAmountValue={expenseAmountValue}
          setExpenseAmountValue={setExpenseAmountValue}
          adjustExpenseAmount={adjustExpenseAmount}
          expenseSummaryLabel={expenseSummaryLabel}
          expenseSummaryAmount={expenseSummaryAmount}
          onExpenseSubmit={handleExpenseSubmit}
          adjustmentQuickQuantities={ADJUSTMENT_QUICK_QUANTITIES}
          adjustmentForm={adjustmentForm}
          setAdjustmentForm={setAdjustmentForm}
          adjustmentQuantity={adjustmentQuantity}
          setAdjustmentQuantityValue={setAdjustmentQuantityValue}
          adjustAdjustmentQuantity={adjustAdjustmentQuantity}
          adjustmentReasonOptions={adjustmentReasonOptions}
          adjustmentReasonOptionsByMode={ADJUSTMENT_REASON_OPTIONS}
          customAdjustmentReason={CUSTOM_ADJUSTMENT_REASON}
          adjustmentHasCustomReason={adjustmentHasCustomReason}
          adjustmentSummaryLabel={adjustmentSummaryLabel}
          onAdjustmentSubmit={handleAdjustmentSubmit}
          formatCurrency={formatCurrency}
          saving={saving}
          loading={loading}
        />

        <WaterLedgersSection
          loading={loading}
          saving={saving}
          filteredSales={filteredSales}
          sales={trackedSales}
          orderQuery={orderQuery}
          setOrderQuery={setOrderQuery}
          orderStatusFilter={orderStatusFilter}
          setOrderStatusFilter={setOrderStatusFilter}
          orderStatusOptions={ORDER_STATUS_FILTER_OPTIONS}
          activeOrderId={activeOrderId}
          openOrderEditor={openOrderEditor}
          handleOrderDelete={handleOrderDelete}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
          normalizeSalePaymentStatus={normalizeSalePaymentStatus}
          getSalePaymentStatusLabel={getSalePaymentStatusLabel}
          stockTimeline={stockTimeline}
          netMovement={netMovement}
          activeLedgerItem={activeLedgerItem}
          openStockEntryEditor={openStockEntryEditor}
          handleStockEntryUndo={handleStockEntryUndo}
          expenses={trackedExpenses}
          stockScopeLabel={stockScopeLabel}
          isAllTimeStockView={isAllTimeStockView}
          openExpenseEditor={openExpenseEditor}
          handleExpenseDelete={handleExpenseDelete}
        />

        <WaterLedgerEditorModal
          activeLedgerItem={activeLedgerItem}
          activeLedgerRecord={activeLedgerRecord}
          ledgerForm={ledgerForm}
          setLedgerForm={setLedgerForm}
          ledgerError={ledgerError}
          orderedVendorOptions={orderedVendorOptions}
          selectedLedgerVendor={selectedLedgerVendor}
          ledgerSelectedVendorName={ledgerSelectedVendorName}
          ledgerRestockQuantity={ledgerRestockQuantity}
          ledgerRestockUnitCost={ledgerRestockUnitCost}
          ledgerRestockCost={ledgerRestockCost}
          ledgerAdjustmentReasonOptions={ledgerAdjustmentReasonOptions}
          ledgerAdjustmentHasCustomReason={ledgerAdjustmentHasCustomReason}
          ledgerAdjustmentQuantity={ledgerAdjustmentQuantity}
          ledgerAdjustmentSummaryLabel={ledgerAdjustmentSummaryLabel}
          resolvedLedgerExpenseCategory={resolvedLedgerExpenseCategory}
          ledgerExpenseSummaryAmount={ledgerExpenseSummaryAmount}
          customAdjustmentReason={CUSTOM_ADJUSTMENT_REASON}
          customExpenseCategory={CUSTOM_EXPENSE_CATEGORY}
          expenseCategoryOptions={EXPENSE_CATEGORY_OPTIONS}
          adjustmentReasonOptionsByMode={ADJUSTMENT_REASON_OPTIONS}
          formatDateTime={formatDateTime}
          formatCurrency={formatCurrency}
          closeLedgerEditor={closeLedgerEditor}
          handleLedgerSubmit={handleLedgerSubmit}
          handleStockEntryUndo={handleStockEntryUndo}
          handleExpenseDelete={handleExpenseDelete}
          saving={saving}
          loading={loading}
        />

        <WaterOrderEditorModal
          activeOrderId={activeOrderId}
          activeOrder={activeOrder}
          orderForm={orderForm}
          setOrderForm={setOrderForm}
          orderPreview={orderPreview}
          orderError={orderError}
          orderPriceChanged={orderPriceChanged}
          canManageWaterPricing={canManageWaterPricing}
          customerPickerProps={orderCustomerPickerProps}
          closeOrderEditor={closeOrderEditor}
          handleOrderSubmit={handleOrderSubmit}
          handleOrderDelete={handleOrderDelete}
          handleOrderPaymentMethodChange={handleOrderPaymentMethodChange}
          normalizeChannel={normalizeChannel}
          normalizeSalePaymentStatus={normalizeSalePaymentStatus}
          getSalePaymentStatusLabel={getSalePaymentStatusLabel}
          salePaymentOptions={SALE_PAYMENT_OPTIONS}
          orderStatusOptions={ORDER_STATUS_FILTER_OPTIONS}
          formatDateTime={formatDateTime}
          formatCurrency={formatCurrency}
          saving={saving}
          loading={loading}
        />
      </div>
    </div>
  );
}

export default AdminWater;
