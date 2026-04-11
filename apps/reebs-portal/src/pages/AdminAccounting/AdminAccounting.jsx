/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { SelectField } from "@faako/ui";
import "./AdminAccounting.css";
import { AppIcon } from "/src/components/Icon/Icon";
import { faRotateRight, faWandMagicSparkles } from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { InlineNotice } from "../../components/InlineNotice/InlineNotice";
import {
  EXPENSE_CATEGORY_LABELS,
  getExpenseCategoryStyle,
  normalizeExpenseCategory,
} from "../../data/expenseCategories";

const formatCurrency = (amount) => {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    return `GHS ${Math.round(amount || 0)}`;
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

const isWithinRange = (value, start, end) => {
  if (!start || !end) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date < end;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDocumentType = (document) =>
  String(document?.documentType || "").trim().toLowerCase() === "receipt" ? "receipt" : "invoice";

const getDocumentDate = (document) =>
  document?.issueDate || document?.eventDate || document?.createdAt || document?.updatedAt || null;

const getDocumentTotal = (document) => {
  const grandTotal = document?.summary?.grandTotal ?? document?.grandTotal;
  return Math.max(0, toNumber(grandTotal));
};

const getDocumentReference = (document) => {
  const reference = String(document?.invoiceNumber || "").trim();
  if (reference) return reference;
  if (document?.id) return `Draft-${document.id}`;
  return "Draft";
};

const getDocumentCustomer = (document) =>
  document?.customer?.name || document?.customerName || document?.customer?.email || "-";

const getDocumentSourceKey = (document) => {
  const sourceType = String(document?.sourceType || "").trim().toLowerCase();
  const sourceId = Number(document?.sourceId);
  if (!sourceType || sourceType === "manual" || !Number.isFinite(sourceId) || sourceId <= 0) return "";
  return `${sourceType}-${sourceId}`;
};

const loadLocalState = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return { ...fallback, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return fallback;
  }
};

const CORPORATE_RATE_MAP = {
  general: { label: "General rate", rate: 0.25 },
  hotel: { label: "Hotel industry", rate: 0.22 },
  mining: { label: "Mining & upstream petroleum", rate: 0.35 },
  nonTraditional: { label: "Non-traditional exports", rate: 0.08 },
  bankAgriLeasing: { label: "Banks (agri/leasing income)", rate: 0.2 },
  lottery: { label: "Lottery operators (gross gaming)", rate: 0.2 },
  custom: { label: "Custom rate", rate: null },
};

const HISTORICAL_START_YEAR = 2024;
const HISTORICAL_INPUT_YEARS = (() => {
  const currentYear = new Date().getFullYear();
  const lastHistoricalYear = Math.max(HISTORICAL_START_YEAR, currentYear - 1);
  return Array.from(
    { length: lastHistoricalYear - HISTORICAL_START_YEAR + 1 },
    (_, index) => HISTORICAL_START_YEAR + index
  );
})();
const DEFAULT_HISTORICAL_YEAR = HISTORICAL_INPUT_YEARS[0] || HISTORICAL_START_YEAR;
const MANUAL_SALES_MONTHS = [
  { key: "jan", label: "Jan", monthIndex: 0 },
  { key: "feb", label: "Feb", monthIndex: 1 },
  { key: "mar", label: "Mar", monthIndex: 2 },
  { key: "apr", label: "Apr", monthIndex: 3 },
  { key: "may", label: "May", monthIndex: 4 },
  { key: "jun", label: "Jun", monthIndex: 5 },
  { key: "jul", label: "Jul", monthIndex: 6 },
  { key: "aug", label: "Aug", monthIndex: 7 },
  { key: "sep", label: "Sep", monthIndex: 8 },
  { key: "oct", label: "Oct", monthIndex: 9 },
  { key: "nov", label: "Nov", monthIndex: 10 },
  { key: "dec", label: "Dec", monthIndex: 11 },
];
const MANUAL_SALES_DEFAULTS = Object.fromEntries(
  MANUAL_SALES_MONTHS.map(({ key }) => [key, "0"])
);
const EMPTY_MANUAL_SALES_PAYLOAD = Object.fromEntries(
  MANUAL_SALES_MONTHS.map(({ key }) => [key, 0])
);

const normalizeManualSalesPayload = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return MANUAL_SALES_MONTHS.reduce((acc, month) => {
    const amount = Math.max(0, toNumber(source[month.key]));
    acc[month.key] = Math.round(amount * 100) / 100;
    return acc;
  }, { ...EMPTY_MANUAL_SALES_PAYLOAD });
};

const toHistoricalSalesInputs = (value) => {
  const normalized = normalizeManualSalesPayload(value);
  return MANUAL_SALES_MONTHS.reduce((acc, month) => {
    acc[month.key] = String(normalized[month.key] || 0);
    return acc;
  }, { ...MANUAL_SALES_DEFAULTS });
};

const serializeHistoricalSalesInputs = (value) =>
  JSON.stringify(normalizeManualSalesPayload(value));

const createEmptyHistoricalSalesRecordMap = () =>
  Object.fromEntries(HISTORICAL_INPUT_YEARS.map((year) => [year, { ...EMPTY_MANUAL_SALES_PAYLOAD }]));

const createHistoricalSalesDraftMap = (value = {}) =>
  Object.fromEntries(
    HISTORICAL_INPUT_YEARS.map((year) => [year, toHistoricalSalesInputs(value[year])])
  );

function AdminAccounting() {
  const [windowKey, setWindowKey] = useState("allTime");
  const [viewMode, setViewMode] = useState("overview"); // overview | activity | statements | taxes
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("info");
  const [isFetching, setIsFetching] = useState(false);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listLoaded, setListLoaded] = useState(false);
  const balanceDefaults = {
    cashOnHand: "0",
    bankBalance: "0",
    accountsReceivable: "0",
    inventoryValue: "0",
    prepaidExpenses: "0",
    otherCurrentAssets: "0",
    fixedAssets: "0",
    otherAssets: "0",
    accountsPayable: "0",
    taxesPayable: "0",
    accruedExpenses: "0",
    shortTermLoans: "0",
    longTermLoans: "0",
    ownerEquity: "0",
    retainedEarnings: "0",
  };
  const ghTaxDefaults = {
    vatCoreRate: "0.125",
    nhilRate: "0.025",
    getFundRate: "0.025",
    covidRate: "0",
    corporateRate: "0.25",
    corporateCategory: "general",
    gslCategory: "categoryC",
    fsrlEnabled: false,
  };
  const taxInputDefaults = {
    exemptSales: "0",
    inputVatCredits: "0",
    allowableDeductions: "0",
    withholdingCredits: "0",
    grossProduction: "0",
  };
  const [balanceInputs, setBalanceInputs] = useState(() =>
    loadLocalState("reebs_accounting_balances_v1", balanceDefaults)
  );
  const [ghanaTaxConfig, setGhanaTaxConfig] = useState(() =>
    loadLocalState("reebs_ghana_tax_v1", ghTaxDefaults)
  );
  const [taxInputs, setTaxInputs] = useState(() =>
    loadLocalState("reebs_ghana_tax_inputs_v1", taxInputDefaults)
  );
  const [accountingConfigLoaded, setAccountingConfigLoaded] = useState(false);
  const [accountingConfigSaving, setAccountingConfigSaving] = useState("");
  const [accountingConfigError, setAccountingConfigError] = useState("");
  const [historicalSalesByYear, setHistoricalSalesByYear] = useState(() =>
    createEmptyHistoricalSalesRecordMap()
  );
  const [historicalSalesDrafts, setHistoricalSalesDrafts] = useState(() =>
    createHistoricalSalesDraftMap(createEmptyHistoricalSalesRecordMap())
  );
  const [selectedHistoricalYear, setSelectedHistoricalYear] = useState(DEFAULT_HISTORICAL_YEAR);
  const [historicalSalesLoaded, setHistoricalSalesLoaded] = useState(false);
  const [historicalSalesSaving, setHistoricalSalesSaving] = useState(false);
  const [historicalSalesError, setHistoricalSalesError] = useState("");
  const balanceInputsEditedRef = useRef(false);
  const taxInputsEditedRef = useRef(false);
  const ghanaTaxConfigEditedRef = useRef(false);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const parsePercent = (value) => {
    const raw = Number(value);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw > 1 ? raw / 100 : raw;
  };

  const fetchJson = async (url, init) => {
    const res = await fetch(url, init);
    const text = await res.text();
    const json = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })();
    if (!res.ok) throw new Error(json?.error || "Failed to load data.");
    return json;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setAccountingConfigError("");
      try {
        const result = await fetchJson("/.netlify/functions/accounting-config");
        if (cancelled) return;
        if (result?.balanceInputs && !balanceInputsEditedRef.current) {
          setBalanceInputs((prev) => ({ ...prev, ...result.balanceInputs }));
        }
        if (result?.taxInputs && !taxInputsEditedRef.current) {
          setTaxInputs((prev) => ({ ...prev, ...result.taxInputs }));
        }
        if (result?.ghanaTaxConfig && !ghanaTaxConfigEditedRef.current) {
          setGhanaTaxConfig((prev) => ({ ...prev, ...result.ghanaTaxConfig }));
        }
      } catch (err) {
        if (cancelled) return;
        setAccountingConfigError(err.message || "Unable to load saved accounting settings.");
      } finally {
        if (!cancelled) {
          setAccountingConfigLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setHistoricalSalesError("");
      try {
        const result = await fetchJson("/.netlify/functions/accounting-history");
        if (cancelled) return;
        const nextRecords = createEmptyHistoricalSalesRecordMap();
        const rows = Array.isArray(result?.years) ? result.years : [];
        rows.forEach((row) => {
          const year = Number(row?.year);
          if (!HISTORICAL_INPUT_YEARS.includes(year)) return;
          nextRecords[year] = normalizeManualSalesPayload(row?.monthlySales);
        });
        setHistoricalSalesByYear(nextRecords);
        setHistoricalSalesDrafts(createHistoricalSalesDraftMap(nextRecords));
      } catch (err) {
        if (cancelled) return;
        setHistoricalSalesError(err.message || "Unable to load saved historical sales.");
        setHistoricalSalesByYear(createEmptyHistoricalSalesRecordMap());
        setHistoricalSalesDrafts(createHistoricalSalesDraftMap(createEmptyHistoricalSalesRecordMap()));
      } finally {
        if (!cancelled) {
          setHistoricalSalesLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const yearMatch = /^year(\d{4})$/.exec(windowKey || "");
    const matchedYear = Number(yearMatch?.[1] || 0);
    if (!HISTORICAL_INPUT_YEARS.includes(matchedYear)) return;
    setSelectedHistoricalYear(matchedYear);
  }, [windowKey]);

  const pushNotice = (message, tone = "info") => {
    setNotice(message);
    setNoticeTone(tone);
  };

  const clearNotice = () => {
    setNotice("");
    setNoticeTone("info");
  };

  const fetchData = async (key = windowKey) => {
    if (!data) setLoading(true);
    setIsFetching(true);
    setError("");
    clearNotice();
    try {
      const result = await fetchJson(`/.netlify/functions/financials?window=${key}`);
      setData(result);
    } catch (err) {
      console.error("Financials failed", err);
      setError(err.message || "Unable to load financial stats.");
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchData("allTime");
  }, []);

  const fetchListData = async () => {
    setListLoading(true);
    setListError("");
    try {
      const [ordersRes, bookingsRes, documentsRes, expensesRes] = await Promise.all([
        fetchJson("/.netlify/functions/orders"),
        fetchJson("/.netlify/functions/bookings"),
        fetchJson("/.netlify/functions/invoice-documents?compact=1"),
        fetchJson("/.netlify/functions/expenses"),
      ]);
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);
      setBookings(Array.isArray(bookingsRes) ? bookingsRes : []);
      setDocuments(Array.isArray(documentsRes) ? documentsRes : []);
      setExpenses(Array.isArray(expensesRes) ? expensesRes : []);
      setListLoaded(true);
    } catch (err) {
      console.error("List fetch failed", err);
      setListError(err.message || "Unable to load linked financial activity.");
      setListLoaded(false);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode !== "activity") return;
    if (listLoaded) return;
    fetchListData();
  }, [viewMode, listLoaded]);

  const selectedHistoricalInputs = useMemo(
    () => historicalSalesDrafts[selectedHistoricalYear] || { ...MANUAL_SALES_DEFAULTS },
    [historicalSalesDrafts, selectedHistoricalYear]
  );
  const selectedHistoricalSavedValues = useMemo(
    () => historicalSalesByYear[selectedHistoricalYear] || { ...EMPTY_MANUAL_SALES_PAYLOAD },
    [historicalSalesByYear, selectedHistoricalYear]
  );
  const historicalSalesDirty =
    serializeHistoricalSalesInputs(selectedHistoricalInputs)
    !== serializeHistoricalSalesInputs(selectedHistoricalSavedValues);
  const lastHistoricalYear =
    HISTORICAL_INPUT_YEARS[HISTORICAL_INPUT_YEARS.length - 1] || selectedHistoricalYear;
  const selectedHistoricalYearTotal = useMemo(
    () =>
      MANUAL_SALES_MONTHS.reduce(
        (sum, month) => sum + Math.max(0, toNumber(selectedHistoricalInputs[month.key])),
        0
      ),
    [selectedHistoricalInputs]
  );
  const historicalSalesMonths = useMemo(
    () =>
      HISTORICAL_INPUT_YEARS.flatMap((year) =>
        MANUAL_SALES_MONTHS.map((month) => {
          const start = new Date(Date.UTC(year, month.monthIndex, 1));
          const end = new Date(Date.UTC(year, month.monthIndex + 1, 1));
          const savedValues = historicalSalesByYear[year] || EMPTY_MANUAL_SALES_PAYLOAD;
          return {
            ...month,
            year,
            amount: Math.max(0, toNumber(savedValues[month.key])),
            start,
            end,
            dateKey: start.toISOString().slice(0, 10),
          };
        })
      ),
    [historicalSalesByYear]
  );
  const historicalSalesInWindow = useMemo(() => {
    if (!data?.startDate || !data?.endDate) return [];
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    return historicalSalesMonths.filter(
      (month) => month.amount > 0 && month.end > start && month.start < end
    );
  }, [data?.endDate, data?.startDate, historicalSalesMonths]);
  const historicalSalesWindowTotal = useMemo(
    () => historicalSalesInWindow.reduce((sum, month) => sum + month.amount, 0),
    [historicalSalesInWindow]
  );

  const revenueSplit = useMemo(() => {
    const retail = (data?.revenueByCategory?.retail || 0) + historicalSalesWindowTotal;
    const rental = data?.revenueByCategory?.rental || 0;
    const other = data?.revenueByCategory?.other || 0;
    const total = retail + rental + other || 1;
    return {
      retail,
      rental,
      other,
      retailPct: Math.round((retail / total) * 100),
      rentalPct: Math.round((rental / total) * 100),
      otherPct: Math.round((other / total) * 100),
    };
  }, [data, historicalSalesWindowTotal]);

  const cashflowTrend = useMemo(() => {
    const baseRows = Array.isArray(data?.cashflow) ? data.cashflow : [];
    if (!historicalSalesInWindow.length) return baseRows;
    const totals = new Map();
    baseRows.forEach((entry) => {
      totals.set(entry.date, {
        date: entry.date,
        revenue: toNumber(entry.revenue),
      });
    });
    historicalSalesInWindow.forEach((entry) => {
      const existing = totals.get(entry.dateKey);
      totals.set(entry.dateKey, {
        date: entry.dateKey,
        revenue: (existing?.revenue || 0) + entry.amount,
      });
    });
    return Array.from(totals.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [data?.cashflow, historicalSalesInWindow]);
  const totalRevenue = useMemo(() => data?.revenue || 0, [data]);
  const grossRevenue = useMemo(
    () => totalRevenue + historicalSalesWindowTotal,
    [historicalSalesWindowTotal, totalRevenue]
  );
  const financeSummary = useMemo(() => data?.summary || null, [data]);
  const expenseWindowLabel = data?.expenseWindowLabel || data?.windowLabel || "";
  const hasHistoricalSalesInWindow = historicalSalesWindowTotal > 0;
  const windowLabel = data?.windowLabel || "";
  const cashflowWindowLabel = hasHistoricalSalesInWindow
    ? `${windowLabel || "Selected window"} + saved historical carry-over`
    : windowLabel
      ? `Daily revenue in ${windowLabel}`
      : "Daily revenue";
  const expenseBreakdown = useMemo(() => {
    const rows = Array.isArray(data?.expenseBreakdown) ? data.expenseBreakdown : [];
    const totals = new Map();
    rows.forEach((row) => {
      const category = normalizeExpenseCategory(row?.category) || "Operational";
      const amount = toNumber(row?.amount);
      totals.set(category, (totals.get(category) || 0) + amount);
    });
    const ordered = [
      ...EXPENSE_CATEGORY_LABELS,
      ...Array.from(totals.keys())
        .filter((category) => !EXPENSE_CATEGORY_LABELS.includes(category))
        .sort((a, b) => a.localeCompare(b)),
    ];
    return ordered
      .map((category) => ({
        category,
        amount: totals.get(category) || 0,
      }))
      .filter((entry) => entry.amount > 0);
  }, [data]);
  const expenseBreakdownTotal = useMemo(
    () => expenseBreakdown.reduce((sum, entry) => sum + toNumber(entry.amount), 0),
    [expenseBreakdown]
  );
  const topExpenseCategories = useMemo(
    () => [...expenseBreakdown].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [expenseBreakdown]
  );

  const windowStart = useMemo(
    () => (data?.startDate ? new Date(data.startDate) : null),
    [data?.startDate]
  );
  const windowEnd = useMemo(
    () => (data?.endDate ? new Date(data.endDate) : null),
    [data?.endDate]
  );

  const filteredOrders = useMemo(
    () => orders.filter((order) => isWithinRange(order.orderDate, windowStart, windowEnd)),
    [orders, windowStart, windowEnd]
  );

  const filteredBookings = useMemo(
    () => bookings.filter((booking) => isWithinRange(booking.eventDate, windowStart, windowEnd)),
    [bookings, windowStart, windowEnd]
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((expense) => isWithinRange(expense.date, windowStart, windowEnd)),
    [expenses, windowStart, windowEnd]
  );

  const listRows = useMemo(() => {
    const orderRows = filteredOrders.map((order) => ({
      id: `order-${order.id}`,
      type: "Receipt",
      number: order.orderNumber || `ORD-${order.id}`,
      customer: order.customerName || "-",
      date: order.orderDate,
      status: order.status || "posted",
      direction: "in",
      detail: "Order",
      total: Number(order.total || 0),
    }));
    const bookingRows = filteredBookings.map((booking) => ({
      id: `booking-${booking.id}`,
      type: "Invoice",
      number: `INV-${booking.id}`,
      customer: booking.customerName || "-",
      date: booking.eventDate,
      status: booking.status || "confirmed",
      direction: "in",
      detail: "Booking",
      total: Number(booking.totalAmount || 0) / 100,
    }));
    const expenseRows = filteredExpenses.map((expense) => ({
      id: `expense-${expense.id}`,
      type: "Expense",
      number: expense.category || "Expense",
      customer: expense.description || "-",
      date: expense.date,
      status: expense.maintenanceStatus || "posted",
      direction: "out",
      detail: expense.category || "Expense",
      total: Number(expense.amount || 0),
    }));
    return [...orderRows, ...bookingRows, ...expenseRows].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [filteredBookings, filteredExpenses, filteredOrders]);

  const receiptsTotal = useMemo(
    () => filteredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [filteredOrders]
  );
  const invoicesTotal = useMemo(
    () => filteredBookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0) / 100, 0),
    [filteredBookings]
  );
  const expensesTotal = useMemo(
    () => filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [filteredExpenses]
  );
  const combinedTotal = receiptsTotal + invoicesTotal;
  const linkedMoneyIn = combinedTotal;
  const linkedNet = linkedMoneyIn - expensesTotal;
  const recentLinkedRows = useMemo(() => listRows.slice(0, 8), [listRows]);
  const updateBalance = (field) => (event) => {
    const value = event.target.value;
    balanceInputsEditedRef.current = true;
    setBalanceInputs((prev) => ({ ...prev, [field]: value }));
  };

  const updateTaxInput = (field) => (event) => {
    const value = event.target.value;
    taxInputsEditedRef.current = true;
    setTaxInputs((prev) => ({ ...prev, [field]: value }));
  };

  const updateHistoricalSales = (field) => (event) => {
    const value = event.target.value;
    const sanitized = typeof value === "string" ? value.replace(/^-+/, "") : value;
    setHistoricalSalesDrafts((prev) => ({
      ...prev,
      [selectedHistoricalYear]: {
        ...(prev[selectedHistoricalYear] || MANUAL_SALES_DEFAULTS),
        [field]: sanitized,
      },
    }));
  };

  const updateGhanaTax = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    ghanaTaxConfigEditedRef.current = true;
    setGhanaTaxConfig((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "corporateRate") {
        next.corporateCategory = "custom";
      }
      return next;
    });
  };

  const updateCorporateCategory = (event) => {
    const value = event.target.value;
    const mapped = CORPORATE_RATE_MAP[value];
    ghanaTaxConfigEditedRef.current = true;
    setGhanaTaxConfig((prev) => ({
      ...prev,
      corporateCategory: value,
      corporateRate: mapped?.rate == null ? prev.corporateRate : String(mapped.rate),
    }));
  };

  const cashOnHand = toNumber(balanceInputs.cashOnHand);
  const bankBalance = toNumber(balanceInputs.bankBalance);
  const accountsReceivable = toNumber(balanceInputs.accountsReceivable);
  const inventoryValue = toNumber(balanceInputs.inventoryValue);
  const prepaidExpenses = toNumber(balanceInputs.prepaidExpenses);
  const otherCurrentAssets = toNumber(balanceInputs.otherCurrentAssets);
  const fixedAssets = toNumber(balanceInputs.fixedAssets);
  const otherAssets = toNumber(balanceInputs.otherAssets);
  const accountsPayable = toNumber(balanceInputs.accountsPayable);
  const taxesPayable = toNumber(balanceInputs.taxesPayable);
  const accruedExpenses = toNumber(balanceInputs.accruedExpenses);
  const shortTermLoans = toNumber(balanceInputs.shortTermLoans);
  const longTermLoans = toNumber(balanceInputs.longTermLoans);
  const ownerEquity = toNumber(balanceInputs.ownerEquity);
  const retainedEarnings = toNumber(balanceInputs.retainedEarnings);
  const currentAssets =
    cashOnHand +
    bankBalance +
    accountsReceivable +
    inventoryValue +
    prepaidExpenses +
    otherCurrentAssets;
  const currentLiabilities = accountsPayable + taxesPayable + accruedExpenses + shortTermLoans;
  const totalAssets = currentAssets + fixedAssets + otherAssets;
  const totalLiabilities = currentLiabilities + longTermLoans;
  const periodNetProfit = toNumber(financeSummary?.netProfit || 0);
  const equityBase = ownerEquity + retainedEarnings;
  const totalEquity = equityBase + periodNetProfit;
  const balanceGap = totalAssets - (totalLiabilities + totalEquity);
  const workingCapital = currentAssets - currentLiabilities;
  const quickAssets = cashOnHand + bankBalance + accountsReceivable;
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : null;
  const quickRatio = currentLiabilities > 0 ? quickAssets / currentLiabilities : null;

  const corporateCategory = ghanaTaxConfig.corporateCategory || "general";
  const vatCoreRate = parsePercent(ghanaTaxConfig.vatCoreRate);
  const nhilRate = parsePercent(ghanaTaxConfig.nhilRate);
  const getFundRate = parsePercent(ghanaTaxConfig.getFundRate);
  const covidRate = parsePercent(ghanaTaxConfig.covidRate);
  const corporateRate = parsePercent(ghanaTaxConfig.corporateRate);
  const vatTotalRate = vatCoreRate + nhilRate + getFundRate + covidRate;
  const exemptSales = toNumber(taxInputs.exemptSales);
  const salesBaseForTax = Math.max(combinedTotal, grossRevenue);
  const taxableSales = Math.max(0, salesBaseForTax - exemptSales);
  const outputVat = taxableSales * vatTotalRate;
  const inputVatCredits = toNumber(taxInputs.inputVatCredits);
  const vatPayable = Math.max(0, outputVat - inputVatCredits);
  const grossProduction = toNumber(taxInputs.grossProduction);
  const profitBeforeTax =
    toNumber(financeSummary?.grossProfit || 0) - toNumber(financeSummary?.operatingExpenses || 0);
  const profitBeforeTaxBase = Math.max(0, profitBeforeTax);
  const allowableDeductions = toNumber(taxInputs.allowableDeductions);
  const taxableIncome = Math.max(0, profitBeforeTax - allowableDeductions);
  const corporateTaxDue = taxableIncome * corporateRate;
  const gslCategory = ghanaTaxConfig.gslCategory || "none";
  let gslDue = 0;
  if (gslCategory === "categoryA") gslDue = profitBeforeTaxBase * 0.05;
  if (gslCategory === "categoryBGold") gslDue = Math.max(0, grossProduction) * 0.03;
  if (gslCategory === "categoryBOther") gslDue = Math.max(0, grossProduction) * 0.01;
  if (gslCategory === "categoryC") gslDue = profitBeforeTaxBase * 0.025;
  const fsrlDue = ghanaTaxConfig.fsrlEnabled ? profitBeforeTaxBase * 0.05 : 0;
  const withholdingCredits = toNumber(taxInputs.withholdingCredits);
  const totalTaxDue = Math.max(
    0,
    vatPayable + corporateTaxDue + gslDue + fsrlDue - withholdingCredits
  );
  const grossFormulaGap =
    toNumber(financeSummary?.revenue || 0) +
    toNumber(financeSummary?.rentalIncome || 0) -
    toNumber(financeSummary?.cogs || 0) -
    toNumber(financeSummary?.grossProfit || 0);
  const netFormulaGap =
    toNumber(financeSummary?.grossProfit || 0) -
    toNumber(financeSummary?.operatingExpenses || 0) -
    toNumber(financeSummary?.netProfit || 0);
  const expenseTieOutGap =
    expenseBreakdownTotal - toNumber(financeSummary?.operatingExpenses || 0);

  const withinTolerance = (value) => Math.abs(toNumber(value)) <= 1;
  const toMoneyString = (value) => toNumber(value).toFixed(2);

  const autoFillBalanceInputs = () => {
    const revenue = grossRevenue;
    const cogs = toNumber(financeSummary?.cogs || 0);
    const operatingExpenses = toNumber(financeSummary?.operatingExpenses || 0);
    const projectedLiquid = Math.max(0, revenue - cogs - operatingExpenses);
    const nextCurrentAssets = {
      cashOnHand: projectedLiquid * 0.15,
      bankBalance: projectedLiquid * 0.45,
      accountsReceivable: Math.max(0, revenue * 0.2),
      inventoryValue: Math.max(cogs * 0.3, 0),
      prepaidExpenses: Math.max(operatingExpenses * 0.05, 0),
      otherCurrentAssets: Math.max(operatingExpenses * 0.03, 0),
      fixedAssets: toNumber(balanceInputs.fixedAssets),
      otherAssets: toNumber(balanceInputs.otherAssets),
    };
    const nextLiabilities = {
      accountsPayable: Math.max(cogs * 0.25, 0),
      taxesPayable: Math.max(totalTaxDue, 0),
      accruedExpenses: Math.max(operatingExpenses * 0.12, 0),
      shortTermLoans: toNumber(balanceInputs.shortTermLoans),
      longTermLoans: toNumber(balanceInputs.longTermLoans),
    };

    const nextTotalAssets =
      nextCurrentAssets.cashOnHand +
      nextCurrentAssets.bankBalance +
      nextCurrentAssets.accountsReceivable +
      nextCurrentAssets.inventoryValue +
      nextCurrentAssets.prepaidExpenses +
      nextCurrentAssets.otherCurrentAssets +
      nextCurrentAssets.fixedAssets +
      nextCurrentAssets.otherAssets;

    const nextTotalLiabilities =
      nextLiabilities.accountsPayable +
      nextLiabilities.taxesPayable +
      nextLiabilities.accruedExpenses +
      nextLiabilities.shortTermLoans +
      nextLiabilities.longTermLoans;

    const equityBaseTarget = nextTotalAssets - nextTotalLiabilities - periodNetProfit;
    const ownerEquityAuto = equityBaseTarget * 0.65;
    const retainedEarningsAuto = equityBaseTarget - ownerEquityAuto;

    balanceInputsEditedRef.current = true;
    setBalanceInputs({
      cashOnHand: toMoneyString(nextCurrentAssets.cashOnHand),
      bankBalance: toMoneyString(nextCurrentAssets.bankBalance),
      accountsReceivable: toMoneyString(nextCurrentAssets.accountsReceivable),
      inventoryValue: toMoneyString(nextCurrentAssets.inventoryValue),
      prepaidExpenses: toMoneyString(nextCurrentAssets.prepaidExpenses),
      otherCurrentAssets: toMoneyString(nextCurrentAssets.otherCurrentAssets),
      fixedAssets: toMoneyString(nextCurrentAssets.fixedAssets),
      otherAssets: toMoneyString(nextCurrentAssets.otherAssets),
      accountsPayable: toMoneyString(nextLiabilities.accountsPayable),
      taxesPayable: toMoneyString(nextLiabilities.taxesPayable),
      accruedExpenses: toMoneyString(nextLiabilities.accruedExpenses),
      shortTermLoans: toMoneyString(nextLiabilities.shortTermLoans),
      longTermLoans: toMoneyString(nextLiabilities.longTermLoans),
      ownerEquity: toMoneyString(ownerEquityAuto),
      retainedEarnings: toMoneyString(retainedEarningsAuto),
    });
    pushNotice(
      "Balance inputs auto-filled from recorded revenue, costs, expense, and tax estimates. Click Save to store them.",
      "info"
    );
  };

  const autoFillTaxInputs = () => {
    const salesBase = Math.max(0, grossRevenue);
    const operatingExpenses = toNumber(financeSummary?.operatingExpenses || 0);
    const defaultExemptSales = salesBase * 0.05;
    const estimatedInputVat = operatingExpenses * vatCoreRate;
    taxInputsEditedRef.current = true;
    setTaxInputs({
      exemptSales: toMoneyString(defaultExemptSales),
      inputVatCredits: toMoneyString(estimatedInputVat),
      allowableDeductions: toMoneyString(operatingExpenses),
      withholdingCredits: toMoneyString(0),
      grossProduction: toMoneyString(salesBase),
    });
    pushNotice("Tax inputs auto-filled from the selected window. Review them, then click Save.", "info");
  };

  const resetGhanaTaxRates = () => {
    ghanaTaxConfigEditedRef.current = true;
    setGhanaTaxConfig(ghTaxDefaults);
    pushNotice("Ghana tax rates reset to default template values. Click Save to keep them.", "info");
  };

  const saveAccountingConfigSection = async (section) => {
    if (accountingConfigSaving) return;

    const sectionPayload = {};
    let successMessage = "Accounting settings saved.";

    if (section === "balances") {
      sectionPayload.balanceInputs = balanceInputs;
      successMessage = "Balance sheet inputs saved.";
    } else if (section === "taxInputs") {
      sectionPayload.taxInputs = taxInputs;
      successMessage = "Tax inputs saved.";
    } else if (section === "taxRates") {
      sectionPayload.ghanaTaxConfig = ghanaTaxConfig;
      successMessage = "Ghana tax rates saved.";
    } else {
      return;
    }

    setAccountingConfigSaving(section);
    setAccountingConfigError("");

    try {
      const result = await fetchJson("/.netlify/functions/accounting-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sectionPayload),
      });

      if (result?.balanceInputs) {
        setBalanceInputs(result.balanceInputs);
      }
      if (result?.taxInputs) {
        setTaxInputs(result.taxInputs);
      }
      if (result?.ghanaTaxConfig) {
        setGhanaTaxConfig(result.ghanaTaxConfig);
      }

      if (section === "balances") balanceInputsEditedRef.current = false;
      if (section === "taxInputs") taxInputsEditedRef.current = false;
      if (section === "taxRates") ghanaTaxConfigEditedRef.current = false;

      pushNotice(successMessage, "success");
    } catch (err) {
      setAccountingConfigError(err.message || "Unable to save accounting settings.");
    } finally {
      setAccountingConfigSaving("");
      setAccountingConfigLoaded(true);
    }
  };

  const changeHistoricalYear = async (yearValue) => {
    const year = Number(yearValue);
    if (!HISTORICAL_INPUT_YEARS.includes(year)) return;
    setSelectedHistoricalYear(year);
    const nextWindowKey = `year${year}`;
    setWindowKey(nextWindowKey);
    await fetchData(nextWindowKey);
  };

  const saveHistoricalSales = async () => {
    if (!historicalSalesLoaded || historicalSalesSaving || !historicalSalesDirty) return;

    const year = selectedHistoricalYear;
    const currentInputs = selectedHistoricalInputs;
    setHistoricalSalesSaving(true);
    setHistoricalSalesError("");

    try {
      const result = await fetchJson("/.netlify/functions/accounting-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year,
          monthlySales: normalizeManualSalesPayload(currentInputs),
        }),
      });

      const savedValues = normalizeManualSalesPayload(result?.monthlySales);
      setHistoricalSalesByYear((prev) => ({
        ...prev,
        [year]: savedValues,
      }));
      setHistoricalSalesDrafts((prev) => ({
        ...prev,
        [year]: toHistoricalSalesInputs(savedValues),
      }));

      const nextYear = HISTORICAL_INPUT_YEARS.find((candidate) => candidate > year);
      if (nextYear) {
        await changeHistoricalYear(nextYear);
        pushNotice(`Saved ${year} historical sales. Continue with ${nextYear}.`, "success");
      } else {
        pushNotice(`Saved ${year} historical sales.`, "success");
      }
    } catch (err) {
      setHistoricalSalesError(err.message || `Unable to save ${year} sales to the database.`);
    } finally {
      setHistoricalSalesSaving(false);
    }
  };

  const clearHistoricalSales = () => {
    setHistoricalSalesDrafts((prev) => ({
      ...prev,
      [selectedHistoricalYear]: { ...MANUAL_SALES_DEFAULTS },
    }));
    setHistoricalSalesError("");
  };

  return (
    <div className="accounting-page">
      <div className="accounting-shell">
        <AdminBreadcrumb items={[{ label: "Accounting" }]} />

        <AdminPageHeader
          title="Accounting"
        />

        <section className="glass-card accounting-toolbar" aria-label="Accounting controls">
          <div className="accounting-filters accounting-toolbar-row">
            <div className="accounting-filters-left">
              <label className="accounting-filter">
                Date filter
                <SelectField
                  value={windowKey}
                  onChange={(event) => {
                    const next = event.target.value;
                    setWindowKey(next);
                    fetchData(next);
                  }}
                >
                  <option value="today">Today</option>
                  <option value="allTime">All time</option>
                  {HISTORICAL_INPUT_YEARS.map((year) => (
                    <option key={year} value={`year${year}`}>
                      {year}
                    </option>
                  ))}
                  <option value="thisMonth">This month</option>
                  <option value="lastMonth">Last month</option>
                  <option value="thisQuarter">This quarter</option>
                  <option value="lastQuarter">Last quarter</option>
                  <option value="thisYear">This year</option>
                  <option value="lastYear">Last year</option>
                </SelectField>
              </label>
            </div>
            <div className="accounting-right">
              <div className="accounting-views">
                <div className="accounting-tabs" role="tablist" aria-label="Accounting view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "overview"}
                    className={viewMode === "overview" ? "is-active" : ""}
                    onClick={() => setViewMode("overview")}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "activity"}
                    className={viewMode === "activity" ? "is-active" : ""}
                    onClick={() => setViewMode("activity")}
                  >
                    Activity
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "statements"}
                    className={viewMode === "statements" ? "is-active" : ""}
                    onClick={() => setViewMode("statements")}
                  >
                    Statements
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "taxes"}
                    className={viewMode === "taxes" ? "is-active" : ""}
                    onClick={() => setViewMode("taxes")}
                  >
                    Tax
                  </button>
                </div>
              </div>
              <div className="accounting-actions">
                <button type="button" className="accounting-secondary" onClick={() => fetchData(windowKey)}>
                  <AppIcon icon={faRotateRight} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {loading && <p className="accounting-status">Loading financial metrics…</p>}
        {!loading && isFetching && data && (
          <p className="accounting-status">Refreshing calculations…</p>
        )}
        {!loading && !error && !accountingConfigLoaded && (
          <p className="accounting-status">Loading saved accounting settings…</p>
        )}
        {!loading && error && (
          <div className="accounting-inline">
            <InlineNotice
              tone="error"
              title="Financials unavailable"
              message={error}
            />
            <button type="button" className="accounting-secondary" onClick={() => fetchData(windowKey)}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && accountingConfigError && (
          <InlineNotice
            tone="error"
            title="Accounting settings not saved"
            message={accountingConfigError}
          />
        )}
        {!loading && !error && notice && (
          <InlineNotice
            tone={noticeTone}
            title={noticeTone === "success" ? "Accounting updated" : "Review ready"}
            message={notice}
          />
        )}

        {!loading && !error && data && (viewMode === "statements" || viewMode === "taxes") && (
          <section className="accounting-panels accounting-panels-stack">
            <div className="glass-card accounting-panel">
              <div className="accounting-panel-head">
                <div>
                  <p className="accounting-panel-label">Historical carry-over</p>
                  <h3>Enter {selectedHistoricalYear} monthly sales</h3>
                  <p className="accounting-panel-sub">
                    Use the handwritten book totals, save each year, then move forward. Ongoing sales still flow in automatically as new orders are recorded.
                  </p>
                </div>
                <div className="accounting-panel-actions">
                  <label className="accounting-field">
                    Historical year
                    <SelectField
                      value={selectedHistoricalYear}
                      onChange={(event) => changeHistoricalYear(event.target.value)}
                      disabled={!historicalSalesLoaded || historicalSalesSaving}
                    >
                      {HISTORICAL_INPUT_YEARS.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </SelectField>
                  </label>
                  <button
                    type="button"
                    className="accounting-secondary"
                    onClick={saveHistoricalSales}
                    disabled={!historicalSalesLoaded || historicalSalesSaving || !historicalSalesDirty}
                  >
                    {historicalSalesSaving ? "Saving..." : `Save ${selectedHistoricalYear}`}
                  </button>
                  <button
                    type="button"
                    className="accounting-secondary"
                    onClick={clearHistoricalSales}
                    disabled={!historicalSalesLoaded || historicalSalesSaving}
                  >
                    Clear {selectedHistoricalYear}
                  </button>
                </div>
              </div>
              <div className="accounting-form-grid">
                {historicalSalesMonths.map((month) => (
                  month.year === selectedHistoricalYear ? (
                    <label key={`${month.year}-${month.key}`} className="accounting-field">
                      {month.label} {selectedHistoricalYear}
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={selectedHistoricalInputs[month.key]}
                        onChange={updateHistoricalSales(month.key)}
                        disabled={!historicalSalesLoaded || historicalSalesSaving}
                      />
                    </label>
                  ) : null
                ))}
              </div>
              {historicalSalesError && (
                <InlineNotice
                  tone="error"
                  title="Historical sales not saved"
                  message={historicalSalesError}
                  compact
                />
              )}
              <div className="accounting-pnl">
                <div className="accounting-pnl-row">
                  <span>Input total for {selectedHistoricalYear}</span>
                  <strong>{formatCurrency(selectedHistoricalYearTotal)}</strong>
                </div>
                <div className="accounting-pnl-row">
                  <span>Applied in {windowLabel || "selected window"}</span>
                  <strong>{formatCurrency(historicalSalesWindowTotal)}</strong>
                </div>
              </div>
              <p className="accounting-muted">
                {historicalSalesError
                  ? "The current values are still on screen. Edit and save again to retry."
                  : !historicalSalesLoaded
                  ? "Loading saved historical sales from the database…"
                  : historicalSalesSaving
                    ? `Saving ${selectedHistoricalYear} sales to the database…`
                    : historicalSalesDirty
                      ? `Unsaved changes for ${selectedHistoricalYear}. Click Save to store them${selectedHistoricalYear < lastHistoricalYear ? ` and continue with ${selectedHistoricalYear + 1}` : ""}.`
                      : `Saved per organization in the database. ${selectedHistoricalYear} is up to date.`}
              </p>
              <p className="accounting-muted">
                Saved historical totals are included in gross revenue, revenue mix, cash flow, and VAT sales. They do not change COGS, item-level sales, or profit-based taxes until detailed receipts are entered.
              </p>
            </div>
          </section>
        )}

        {!loading && !error && data && viewMode === "overview" && (
          <>
            <section className="accounting-kpis">
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Money in</p>
                <h3 className="accounting-kpi-value">{formatCurrency(linkedMoneyIn)}</h3>
                <p className="accounting-kpi-sub">{data.orders || 0} receipts · {data.bookings || 0} invoices</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Money out</p>
                <h3 className="accounting-kpi-value">{formatCurrency(expensesTotal)}</h3>
                <p className="accounting-kpi-sub">{expenseWindowLabel || data.windowLabel || ""}</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Gross profit</p>
                <h3 className="accounting-kpi-value">{formatCurrency(financeSummary?.grossProfit || 0)}</h3>
                <p className="accounting-kpi-sub">Before expenses</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Net profit</p>
                <h3 className="accounting-kpi-value">{formatCurrency(financeSummary?.netProfit || 0)}</h3>
                <p className="accounting-kpi-sub">{data.windowLabel || ""}</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Cash + bank</p>
                <h3 className="accounting-kpi-value">{formatCurrency(cashOnHand + bankBalance)}</h3>
                <p className="accounting-kpi-sub">Working capital {formatCurrency(workingCapital)}</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Tax due</p>
                <h3 className="accounting-kpi-value">{formatCurrency(totalTaxDue)}</h3>
                <p className="accounting-kpi-sub">Receivables {formatCurrency(accountsReceivable)}</p>
              </div>
            </section>

            <section className="accounting-panels accounting-panels-stack">
              <div className="glass-card accounting-panel accounting-panel--margins">
                <div className="accounting-panel-head">
                  <div>
                    <h3>Profit & Loss</h3>
                    <p className="accounting-panel-sub">{data.windowLabel || ""}</p>
                  </div>
                </div>
                {loading && !financeSummary ? (
                  <p className="accounting-muted">Reconciling ledgers…</p>
                ) : error && !financeSummary ? (
                  <p className="accounting-error">{error}</p>
                ) : financeSummary ? (
                  <div className="accounting-pnl">
                    <div className="accounting-pnl-row">
                      <span>Receipts</span>
                      <span>{formatCurrency(financeSummary.revenue)}</span>
                    </div>
                    <div className="accounting-pnl-row">
                      <span>Booking invoices</span>
                      <span>{formatCurrency(financeSummary.rentalIncome)}</span>
                    </div>
                    <div className="accounting-pnl-row accounting-negative">
                      <span>Cost of goods sold</span>
                      <span>-{formatCurrency(financeSummary.cogs)}</span>
                    </div>
                    <div className="accounting-pnl-row">
                      <span>Gross profit</span>
                      <span>{formatCurrency(financeSummary.grossProfit)}</span>
                    </div>
                    <div className="accounting-pnl-row accounting-negative">
                      <span>Operating expenses</span>
                      <span>-{formatCurrency(financeSummary.operatingExpenses)}</span>
                    </div>
                    {expenseBreakdown.length > 0 && (
                      <>
                        {expenseBreakdown.map((entry) => (
                          <div key={entry.category} className="accounting-pnl-row accounting-pnl-row-sub accounting-negative">
                            <span>
                              <span className="expenses-tag" style={getExpenseCategoryStyle(entry.category)}>
                                {entry.category}
                              </span>
                            </span>
                            <span>-{formatCurrency(entry.amount)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    <div className="accounting-pnl-row total">
                      <strong>Net profit</strong>
                      <strong>{formatCurrency(financeSummary.netProfit)}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="accounting-muted">No reconciliation data in this window.</p>
                )}
                {hasHistoricalSalesInWindow && (
                  <p className="accounting-muted">
                    Saved historical sales of {formatCurrency(historicalSalesWindowTotal)} are included in gross revenue above, but this margin view stays live-only until detailed receipts are entered.
                  </p>
                )}
              </div>

              <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <p className="accounting-panel-label">Activity</p>
                    <h3>Linked money flow</h3>
                    <p className="accounting-panel-sub">{data.windowLabel || ""}</p>
                  </div>
                </div>
                {listError ? (
                  <p className="accounting-error">{listError}</p>
                ) : listLoading && !recentLinkedRows.length ? (
                  <p className="accounting-muted">Loading linked activity…</p>
                ) : recentLinkedRows.length === 0 ? (
                  <p className="accounting-muted">No linked activity in this window.</p>
                ) : (
                  <div className="accounting-table accounting-table-shell">
                    <div className="admin-table-scroll">
                      <table>
                      <thead>
                        <tr>
                          <th className="table-row-index">#</th>
                          <th>Type</th>
                          <th>Reference</th>
                          <th>Contact</th>
                          <th>Date</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentLinkedRows.map((item, index) => (
                          <tr key={item.id}>
                            <td className="table-row-index">{index}</td>
                            <td>{item.type}</td>
                            <td>
                              <div className="accounting-table-title">
                                <strong>{item.number || "—"}</strong>
                                <span>{item.detail || "Linked"}</span>
                              </div>
                            </td>
                            <td>{item.customer || "-"}</td>
                            <td>{formatDate(item.date)}</td>
                            <td className={`accounting-activity-amount ${item.direction === "out" ? "is-out" : "is-in"}`}>
                              {item.direction === "out" ? "-" : ""}{formatCurrency(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="admin-table-footer">
                        <tr>
                          <td className="admin-table-summary-cell is-count">
                            <span className="admin-table-summary-value">
                              {listRows.length} records
                            </span>
                          </td>
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell">
                            <span className="admin-table-summary-value">
                              {filteredOrders.length} receipts · {filteredBookings.length} invoices · {filteredExpenses.length} expenses
                            </span>
                          </td>
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell accounting-activity-footer-total">
                            <span className="admin-table-summary-value">
                              {formatCurrency(linkedNet)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="accounting-panels">
              <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <p className="accounting-panel-label">Linked totals</p>
                    <h3>Where the money sits</h3>
                    <p className="accounting-panel-sub">{data.windowLabel || ""}</p>
                  </div>
                </div>
                <div className="accounting-mini-grid">
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Receipts</p>
                    <strong className="accounting-mini-value">{formatCurrency(receiptsTotal)}</strong>
                    <span className="accounting-mini-sub">{filteredOrders.length} orders</span>
                  </div>
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Invoices</p>
                    <strong className="accounting-mini-value">{formatCurrency(invoicesTotal)}</strong>
                    <span className="accounting-mini-sub">{filteredBookings.length} bookings</span>
                  </div>
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Expenses</p>
                    <strong className="accounting-mini-value">{formatCurrency(expensesTotal)}</strong>
                    <span className="accounting-mini-sub">{filteredExpenses.length} entries</span>
                  </div>
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Net</p>
                    <strong className="accounting-mini-value">{formatCurrency(linkedNet)}</strong>
                    <span className="accounting-mini-sub">In minus out</span>
                  </div>
                </div>
                <div className="accounting-split-legend accounting-split-legend--finance">
                  <div>
                    <span className="dot retail" /> Retail {formatCurrency(revenueSplit.retail)}
                  </div>
                  <div>
                    <span className="dot rental" /> Rentals {formatCurrency(revenueSplit.rental)}
                  </div>
                  <div>
                    <span className="dot other" /> Other {formatCurrency(revenueSplit.other)}
                  </div>
                </div>
              </div>

              <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <p className="accounting-panel-label">Expenses</p>
                    <h3>Expense categories</h3>
                    <p className="accounting-panel-sub">{expenseWindowLabel || data.windowLabel || ""}</p>
                  </div>
                </div>
                {topExpenseCategories.length === 0 ? (
                  <p className="accounting-muted">No expenses in this window.</p>
                ) : (
                  <div className="accounting-breakdown-list">
                    {topExpenseCategories.map((entry) => (
                      <div key={entry.category} className="accounting-breakdown-row">
                        <div className="accounting-breakdown-meta">
                          <span className="expenses-tag" style={getExpenseCategoryStyle(entry.category)}>
                            {entry.category}
                          </span>
                          <small>
                            {expenseBreakdownTotal > 0
                              ? `${Math.round((entry.amount / expenseBreakdownTotal) * 100)}%`
                              : "0%"}
                          </small>
                        </div>
                        <strong>{formatCurrency(entry.amount)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <p className="accounting-panel-label">Balance health</p>
                    <h3>Cash, receivables, liabilities</h3>
                    <p className="accounting-panel-sub">
                      Assets {formatCurrency(totalAssets)} · Liabilities {formatCurrency(totalLiabilities)}
                    </p>
                  </div>
                </div>
                <div className="accounting-mini-grid">
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Current assets</p>
                    <strong className="accounting-mini-value">{formatCurrency(currentAssets)}</strong>
                    <span className="accounting-mini-sub">Cash, bank, stock, receivables</span>
                  </div>
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Current liabilities</p>
                    <strong className="accounting-mini-value">{formatCurrency(currentLiabilities)}</strong>
                    <span className="accounting-mini-sub">Payables, tax, accrued</span>
                  </div>
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Receivables</p>
                    <strong className="accounting-mini-value">{formatCurrency(accountsReceivable)}</strong>
                    <span className="accounting-mini-sub">Outstanding from customers</span>
                  </div>
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Working capital</p>
                    <strong className="accounting-mini-value">{formatCurrency(workingCapital)}</strong>
                    <span className="accounting-mini-sub">
                      Current ratio {currentRatio ? currentRatio.toFixed(2) : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <p className="accounting-panel-label">Movement</p>
                    <h3>Cash flow trend</h3>
                    <p className="accounting-panel-sub">{cashflowWindowLabel}</p>
                  </div>
                </div>
                {cashflowTrend.length === 0 ? (
                  <p className="accounting-muted">No activity in this window.</p>
                ) : (
                  <div className="accounting-trend">
                    {cashflowTrend.map((entry) => (
                      <div key={entry.date} className="accounting-trend-row">
                        <span>{new Date(entry.date).toLocaleDateString("en-GB", { month: "short", day: "2-digit" })}</span>
                        <div className="accounting-trend-bar">
                          <span
                            style={{
                              width: `${Math.min(100, Math.max(8, (entry.revenue / Math.max(grossRevenue, 1)) * 100))}%`,
                            }}
                          />
                        </div>
                        <span className="accounting-trend-value">{formatCurrency(entry.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {!loading && !error && data && viewMode === "statements" && (
          <>
            <section className="accounting-kpis accounting-kpis-tight">
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Cash + bank</p>
                <h3 className="accounting-kpi-value">{formatCurrency(cashOnHand + bankBalance)}</h3>
                <p className="accounting-kpi-sub">Working capital {formatCurrency(workingCapital)}</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Current ratio</p>
                <h3 className="accounting-kpi-value">
                  {currentRatio ? currentRatio.toFixed(2) : "N/A"}
                </h3>
                <p className="accounting-kpi-sub">Quick ratio {quickRatio ? quickRatio.toFixed(2) : "N/A"}</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Period net profit</p>
                <h3 className="accounting-kpi-value">{formatCurrency(periodNetProfit)}</h3>
                <p className="accounting-kpi-sub">{data.windowLabel || ""}</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Taxable sales</p>
                <h3 className="accounting-kpi-value">{formatCurrency(taxableSales)}</h3>
                <p className="accounting-kpi-sub">VAT rate {Math.round(vatTotalRate * 1000) / 10}%</p>
              </div>
            </section>

            <section className="accounting-panels accounting-panels-stack">
              <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <p className="accounting-panel-label">Statement</p>
                    <h3>Profit & loss</h3>
                    <p className="accounting-panel-sub">For {data.windowLabel || ""}</p>
                  </div>
                </div>
                {loading && !financeSummary ? (
                  <p className="accounting-muted">Reconciling ledgers…</p>
                ) : error && !financeSummary ? (
                  <p className="accounting-error">{error}</p>
                ) : financeSummary ? (
                  <div className="accounting-pnl">
                    <div className="accounting-pnl-row">
                      <span>Retail sales revenue</span>
                      <span>{formatCurrency(financeSummary.revenue)}</span>
                    </div>
                    <div className="accounting-pnl-row">
                      <span>Rental income</span>
                      <span>{formatCurrency(financeSummary.rentalIncome)}</span>
                    </div>
                    <div className="accounting-pnl-row accounting-negative">
                      <span>Cost of goods sold</span>
                      <span>-{formatCurrency(financeSummary.cogs)}</span>
                    </div>
                    <div className="accounting-pnl-row">
                      <span>Gross profit</span>
                      <span>{formatCurrency(financeSummary.grossProfit)}</span>
                    </div>
                    <div className="accounting-pnl-row accounting-negative">
                      <span>Operating expenses</span>
                      <span>-{formatCurrency(financeSummary.operatingExpenses)}</span>
                    </div>
                    <div className="accounting-pnl-row total">
                      <strong>Net profit</strong>
                      <strong>{formatCurrency(financeSummary.netProfit)}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="accounting-muted">No reconciliation data in this window.</p>
                )}
                {hasHistoricalSalesInWindow && (
                  <p className="accounting-muted">
                    Saved historical sales of {formatCurrency(historicalSalesWindowTotal)} remain outside this profit statement until detailed line items are backfilled.
                  </p>
                )}
              </div>

              <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <p className="accounting-panel-label">Statement</p>
                    <h3>Balance sheet</h3>
                    <p className="accounting-panel-sub">
                      As of {windowEnd ? formatDate(windowEnd) : "today"} · use inputs to set opening/closing balances.
                    </p>
                  </div>
                </div>
                <div className="accounting-balance-grid">
                  <div className="accounting-balance-col">
                    <h4>Assets</h4>
                    <div className="accounting-pnl">
                      <div className="accounting-pnl-row">
                        <span>Cash on hand</span>
                        <span>{formatCurrency(cashOnHand)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Bank balance</span>
                        <span>{formatCurrency(bankBalance)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Accounts receivable</span>
                        <span>{formatCurrency(accountsReceivable)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Inventory</span>
                        <span>{formatCurrency(inventoryValue)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Prepaid expenses</span>
                        <span>{formatCurrency(prepaidExpenses)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Other current assets</span>
                        <span>{formatCurrency(otherCurrentAssets)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Fixed assets</span>
                        <span>{formatCurrency(fixedAssets)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Other assets</span>
                        <span>{formatCurrency(otherAssets)}</span>
                      </div>
                      <div className="accounting-pnl-row total">
                        <strong>Total assets</strong>
                        <strong>{formatCurrency(totalAssets)}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="accounting-balance-col">
                    <h4>Liabilities</h4>
                    <div className="accounting-pnl">
                      <div className="accounting-pnl-row">
                        <span>Accounts payable</span>
                        <span>{formatCurrency(accountsPayable)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Taxes payable</span>
                        <span>{formatCurrency(taxesPayable)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Accrued expenses</span>
                        <span>{formatCurrency(accruedExpenses)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Short-term loans</span>
                        <span>{formatCurrency(shortTermLoans)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Long-term loans</span>
                        <span>{formatCurrency(longTermLoans)}</span>
                      </div>
                      <div className="accounting-pnl-row total">
                        <strong>Total liabilities</strong>
                        <strong>{formatCurrency(totalLiabilities)}</strong>
                      </div>
                    </div>
                    <h4>Equity</h4>
                    <div className="accounting-pnl">
                      <div className="accounting-pnl-row">
                        <span>Owner equity</span>
                        <span>{formatCurrency(ownerEquity)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Retained earnings</span>
                        <span>{formatCurrency(retainedEarnings)}</span>
                      </div>
                      <div className="accounting-pnl-row">
                        <span>Current period profit</span>
                        <span>{formatCurrency(periodNetProfit)}</span>
                      </div>
                      <div className="accounting-pnl-row total">
                        <strong>Total equity</strong>
                        <strong>{formatCurrency(totalEquity)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className={`accounting-balance-check ${
                    Math.abs(balanceGap) <= 1 ? "is-balanced" : "is-off"
                  }`}
                >
                  {Math.abs(balanceGap) <= 1
                    ? "Balance check: assets match liabilities + equity."
                    : `Balance check: gap ${formatCurrency(Math.abs(balanceGap))}.`}
                </div>
              </div>

              <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <p className="accounting-panel-label">Automation</p>
                    <h3>Statement integrity checks</h3>
                    <p className="accounting-panel-sub">
                      Automatic checks highlight when something does not tie out.
                    </p>
                  </div>
                </div>
                <ul className="accounting-checklist">
                  <li className={withinTolerance(grossFormulaGap) ? "accounting-check-pass" : "accounting-check-fail"}>
                    Gross profit formula {withinTolerance(grossFormulaGap) ? "passes." : `gap ${formatCurrency(Math.abs(grossFormulaGap))}.`}
                  </li>
                  <li className={withinTolerance(netFormulaGap) ? "accounting-check-pass" : "accounting-check-fail"}>
                    Net profit formula {withinTolerance(netFormulaGap) ? "passes." : `gap ${formatCurrency(Math.abs(netFormulaGap))}.`}
                  </li>
                  <li className={withinTolerance(expenseTieOutGap) ? "accounting-check-pass" : "accounting-check-fail"}>
                    Expense breakdown tie-out {withinTolerance(expenseTieOutGap) ? "passes." : `gap ${formatCurrency(Math.abs(expenseTieOutGap))}.`}
                  </li>
                  <li className={withinTolerance(balanceGap) ? "accounting-check-pass" : "accounting-check-fail"}>
                    Balance sheet equation {withinTolerance(balanceGap) ? "passes." : `gap ${formatCurrency(Math.abs(balanceGap))}.`}
                  </li>
                </ul>
              </div>

              <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <p className="accounting-panel-label">Inputs</p>
                    <h3>Balance sheet inputs</h3>
                    <p className="accounting-panel-sub">
                      Update opening balances at year start and closing balances at year end.
                    </p>
                  </div>
                  <div className="accounting-panel-actions">
                    <button
                      type="button"
                      className="accounting-secondary"
                      onClick={autoFillBalanceInputs}
                      disabled={Boolean(accountingConfigSaving)}
                    >
                      <AppIcon icon={faWandMagicSparkles} /> Auto-fill
                    </button>
                    <button
                      type="button"
                      className="accounting-secondary"
                      onClick={() => saveAccountingConfigSection("balances")}
                      disabled={!accountingConfigLoaded || Boolean(accountingConfigSaving)}
                    >
                      {accountingConfigSaving === "balances" ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
                <div className="accounting-form-grid">
                  <label className="accounting-field">
                    Cash on hand
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.cashOnHand}
                      onChange={updateBalance("cashOnHand")}
                    />
                  </label>
                  <label className="accounting-field">
                    Bank balance
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.bankBalance}
                      onChange={updateBalance("bankBalance")}
                    />
                  </label>
                  <label className="accounting-field">
                    Accounts receivable
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.accountsReceivable}
                      onChange={updateBalance("accountsReceivable")}
                    />
                  </label>
                  <label className="accounting-field">
                    Inventory value
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.inventoryValue}
                      onChange={updateBalance("inventoryValue")}
                    />
                  </label>
                  <label className="accounting-field">
                    Prepaid expenses
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.prepaidExpenses}
                      onChange={updateBalance("prepaidExpenses")}
                    />
                  </label>
                  <label className="accounting-field">
                    Other current assets
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.otherCurrentAssets}
                      onChange={updateBalance("otherCurrentAssets")}
                    />
                  </label>
                  <label className="accounting-field">
                    Fixed assets
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.fixedAssets}
                      onChange={updateBalance("fixedAssets")}
                    />
                  </label>
                  <label className="accounting-field">
                    Other assets
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.otherAssets}
                      onChange={updateBalance("otherAssets")}
                    />
                  </label>
                  <label className="accounting-field">
                    Accounts payable
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.accountsPayable}
                      onChange={updateBalance("accountsPayable")}
                    />
                  </label>
                  <label className="accounting-field">
                    Taxes payable
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.taxesPayable}
                      onChange={updateBalance("taxesPayable")}
                    />
                  </label>
                  <label className="accounting-field">
                    Accrued expenses
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.accruedExpenses}
                      onChange={updateBalance("accruedExpenses")}
                    />
                  </label>
                  <label className="accounting-field">
                    Short-term loans
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.shortTermLoans}
                      onChange={updateBalance("shortTermLoans")}
                    />
                  </label>
                  <label className="accounting-field">
                    Long-term loans
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.longTermLoans}
                      onChange={updateBalance("longTermLoans")}
                    />
                  </label>
                  <label className="accounting-field">
                    Owner equity
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.ownerEquity}
                      onChange={updateBalance("ownerEquity")}
                    />
                  </label>
                  <label className="accounting-field">
                    Retained earnings
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInputs.retainedEarnings}
                      onChange={updateBalance("retainedEarnings")}
                    />
                  </label>
                </div>
              </div>

              <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <p className="accounting-panel-label">Checklist</p>
                    <h3>Opening & closing books</h3>
                    <p className="accounting-panel-sub">
                      Capture year-end entries and keep your ledgers audit-ready.
                    </p>
                  </div>
                </div>
                <ul className="accounting-checklist">
                  <li>Confirm cash, bank, and receivable balances.</li>
                  <li>Reconcile inventory counts and asset values.</li>
                  <li>Review payables, taxes payable, and loan schedules.</li>
                  <li>Finalize P&amp;L, then roll net profit into retained earnings.</li>
                  <li>Export statements for your accountant or tax filing.</li>
                </ul>
              </div>
            </section>
          </>
        )}

        {!loading && !error && data && viewMode === "activity" && (
          <>
            <section className="accounting-kpis accounting-kpis-tight accounting-kpis-activity">
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Receipts</p>
                <h3 className="accounting-kpi-value">{formatCurrency(receiptsTotal)}</h3>
                <p className="accounting-kpi-sub">{filteredOrders.length} orders</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Invoices</p>
                <h3 className="accounting-kpi-value">{formatCurrency(invoicesTotal)}</h3>
                <p className="accounting-kpi-sub">{filteredBookings.length} bookings</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Expenses</p>
                <h3 className="accounting-kpi-value">{formatCurrency(expensesTotal)}</h3>
                <p className="accounting-kpi-sub">{filteredExpenses.length} entries</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Net</p>
                <h3 className="accounting-kpi-value">{formatCurrency(linkedNet)}</h3>
                <p className="accounting-kpi-sub">{data.windowLabel || ""}</p>
              </div>
            </section>

            <section className="glass-card accounting-table accounting-list-table accounting-table-shell">
              <div className="accounting-table-title">
                <h3>Linked activity</h3>
                <span>{data.windowLabel || ""}</span>
              </div>
              {listError && <p className="accounting-error">{listError}</p>}
              {listLoading ? (
                <p className="accounting-status">Loading receipts, invoices, and expenses…</p>
              ) : (
                <div className="admin-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th className="table-row-index">#</th>
                        <th>Type</th>
                        <th>Reference</th>
                        <th>Contact</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="accounting-empty">
                            No linked financial activity in this window.
                          </td>
                        </tr>
                      )}
                      {listRows.map((row, index) => (
                        <tr key={row.id}>
                          <td className="table-row-index">{index}</td>
                          <td>{row.type}</td>
                          <td>
                            <div className="accounting-table-title">
                              <strong>{row.number}</strong>
                              <span>{row.detail}</span>
                            </div>
                          </td>
                          <td>{row.customer}</td>
                          <td>{formatDate(row.date)}</td>
                          <td>{row.status}</td>
                          <td className={`accounting-activity-amount ${row.direction === "out" ? "is-out" : "is-in"}`}>
                            {row.direction === "out" ? "-" : ""}{formatCurrency(row.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {listRows.length > 0 && (
                      <tfoot className="admin-table-footer">
                        <tr>
                          <td className="admin-table-summary-cell is-count">
                            <span className="admin-table-summary-value">{listRows.length} documents</span>
                          </td>
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell">
                            <span className="admin-table-summary-value">
                              {filteredOrders.length} receipts · {filteredBookings.length} invoices · {filteredExpenses.length} expenses
                            </span>
                          </td>
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell accounting-activity-footer-total">
                            <span className="admin-table-summary-value">{formatCurrency(linkedNet)}</span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {!loading && !error && data && viewMode === "taxes" && (
          <section className="accounting-panels accounting-panels-stack">
            <div className="glass-card accounting-panel">
              <div className="accounting-panel-head">
                <h3>Ghana tax summary</h3>
                <span className="accounting-panel-label">{data.windowLabel || ""}</span>
              </div>
                <div className="accounting-pnl">
                  <div className="accounting-pnl-row">
                    <span>Taxable sales</span>
                    <strong>{formatCurrency(taxableSales)}</strong>
                  </div>
                  <div className="accounting-pnl-row">
                    <span>VAT (core)</span>
                    <strong>{formatCurrency(taxableSales * vatCoreRate)}</strong>
                  </div>
                <div className="accounting-pnl-row">
                  <span>NHIL</span>
                  <strong>{formatCurrency(taxableSales * nhilRate)}</strong>
                </div>
                <div className="accounting-pnl-row">
                  <span>GETFund</span>
                  <strong>{formatCurrency(taxableSales * getFundRate)}</strong>
                </div>
                {covidRate > 0 && (
                  <div className="accounting-pnl-row">
                    <span>COVID levy</span>
                    <strong>{formatCurrency(taxableSales * covidRate)}</strong>
                  </div>
                )}
                <div className="accounting-pnl-row">
                  <span>Output VAT total</span>
                  <strong>{formatCurrency(outputVat)}</strong>
                </div>
                <div className="accounting-pnl-row accounting-negative">
                  <span>Input VAT credits</span>
                  <strong>-{formatCurrency(inputVatCredits)}</strong>
                </div>
                <div className="accounting-pnl-row total">
                  <span>VAT payable</span>
                  <strong>{formatCurrency(vatPayable)}</strong>
                </div>
                <div className="accounting-pnl-row">
                  <span>Profit before tax</span>
                  <strong>{formatCurrency(profitBeforeTax)}</strong>
                </div>
                <div className="accounting-pnl-row accounting-negative">
                  <span>Allowable deductions</span>
                  <strong>-{formatCurrency(allowableDeductions)}</strong>
                </div>
                <div className="accounting-pnl-row">
                  <span>Taxable income</span>
                  <strong>{formatCurrency(taxableIncome)}</strong>
                </div>
                <div className="accounting-pnl-row total">
                  <span>
                    Corporate tax ({Math.round(corporateRate * 100)}% · {CORPORATE_RATE_MAP[corporateCategory]?.label || "Custom"})
                  </span>
                  <strong>{formatCurrency(corporateTaxDue)}</strong>
                </div>
                {gslCategory !== "none" && (
                  <div className="accounting-pnl-row">
                    <span>Growth & Sustainability Levy</span>
                    <strong>{formatCurrency(gslDue)}</strong>
                  </div>
                )}
                {ghanaTaxConfig.fsrlEnabled && (
                  <div className="accounting-pnl-row">
                    <span>Financial sector recovery levy</span>
                    <strong>{formatCurrency(fsrlDue)}</strong>
                  </div>
                )}
                <div className="accounting-pnl-row accounting-negative">
                  <span>Withholding credits</span>
                  <strong>-{formatCurrency(withholdingCredits)}</strong>
                </div>
                <div className="accounting-pnl-row total">
                  <strong>Total estimated tax due</strong>
                  <strong>{formatCurrency(totalTaxDue)}</strong>
                </div>
              </div>
              <p className="accounting-muted">
                {hasHistoricalSalesInWindow
                  ? "Saved historical sales are included in taxable sales and VAT. Profit-based taxes still follow tracked profit only."
                  : "Rates are editable—confirm current GRA requirements before filing."}
              </p>
            </div>

            <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <h3>Tax inputs</h3>
                    <span className="accounting-panel-label">Adjustable credits & deductions</span>
                  </div>
                  <div className="accounting-panel-actions">
                    <button
                      type="button"
                      className="accounting-secondary"
                      onClick={autoFillTaxInputs}
                      disabled={Boolean(accountingConfigSaving)}
                    >
                      <AppIcon icon={faWandMagicSparkles} /> Auto-fill
                    </button>
                    <button
                      type="button"
                      className="accounting-secondary"
                      onClick={() => saveAccountingConfigSection("taxInputs")}
                      disabled={!accountingConfigLoaded || Boolean(accountingConfigSaving)}
                    >
                      {accountingConfigSaving === "taxInputs" ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              <div className="accounting-form-grid">
                <label className="accounting-field">
                  Exempt sales
                  <input
                    type="number"
                    inputMode="decimal"
                    value={taxInputs.exemptSales}
                    onChange={updateTaxInput("exemptSales")}
                  />
                </label>
                <label className="accounting-field">
                  Input VAT credits
                  <input
                    type="number"
                    inputMode="decimal"
                    value={taxInputs.inputVatCredits}
                    onChange={updateTaxInput("inputVatCredits")}
                  />
                </label>
                <label className="accounting-field">
                  Allowable deductions
                  <input
                    type="number"
                    inputMode="decimal"
                    value={taxInputs.allowableDeductions}
                    onChange={updateTaxInput("allowableDeductions")}
                  />
                </label>
                <label className="accounting-field">
                  Gross production (GSL)
                  <input
                    type="number"
                    inputMode="decimal"
                    value={taxInputs.grossProduction}
                    onChange={updateTaxInput("grossProduction")}
                  />
                </label>
                <label className="accounting-field">
                  Withholding credits
                  <input
                    type="number"
                    inputMode="decimal"
                    value={taxInputs.withholdingCredits}
                    onChange={updateTaxInput("withholdingCredits")}
                  />
                </label>
              </div>
            </div>

            <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <h3>Ghana tax rates</h3>
                    <span className="accounting-panel-label">Adjust to current policy</span>
                  </div>
                  <div className="accounting-panel-actions">
                    <button
                      type="button"
                      className="accounting-secondary"
                      onClick={resetGhanaTaxRates}
                      disabled={Boolean(accountingConfigSaving)}
                    >
                      <AppIcon icon={faWandMagicSparkles} /> Reset defaults
                    </button>
                    <button
                      type="button"
                      className="accounting-secondary"
                      onClick={() => saveAccountingConfigSection("taxRates")}
                      disabled={!accountingConfigLoaded || Boolean(accountingConfigSaving)}
                    >
                      {accountingConfigSaving === "taxRates" ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              <div className="accounting-form-grid">
                <label className="accounting-field">
                  Corporate tax category
                  <SelectField
                    value={corporateCategory}
                    onChange={updateCorporateCategory}
                  >
                    <option value="general">General rate (25%)</option>
                    <option value="hotel">Hotel industry (22%)</option>
                    <option value="mining">Mining & upstream petroleum (35%)</option>
                    <option value="nonTraditional">Non-traditional exports (8%)</option>
                    <option value="bankAgriLeasing">Banks lending to agri/leasing (20%)</option>
                    <option value="lottery">Lottery operators (20%)</option>
                    <option value="custom">Custom rate</option>
                  </SelectField>
                </label>
                <label className="accounting-field">
                  Corporate tax rate
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ghanaTaxConfig.corporateRate}
                    onChange={updateGhanaTax("corporateRate")}
                  />
                </label>
                <label className="accounting-field">
                  GSL category
                  <SelectField
                    value={ghanaTaxConfig.gslCategory}
                    onChange={updateGhanaTax("gslCategory")}
                  >
                    <option value="none">Not applicable</option>
                    <option value="categoryA">Category A · 5% of PBT</option>
                    <option value="categoryBGold">Category B (gold) · 3% gross production</option>
                    <option value="categoryBOther">Category B (other) · 1% gross production</option>
                    <option value="categoryC">Category C · 2.5% of PBT</option>
                  </SelectField>
                </label>
                <label className="accounting-field accounting-check">
                  Apply FSRL (banks)
                  <input
                    type="checkbox"
                    checked={Boolean(ghanaTaxConfig.fsrlEnabled)}
                    onChange={updateGhanaTax("fsrlEnabled")}
                  />
                </label>
                <label className="accounting-field">
                  VAT core rate
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ghanaTaxConfig.vatCoreRate}
                    onChange={updateGhanaTax("vatCoreRate")}
                  />
                </label>
                <label className="accounting-field">
                  NHIL rate
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ghanaTaxConfig.nhilRate}
                    onChange={updateGhanaTax("nhilRate")}
                  />
                </label>
                <label className="accounting-field">
                  GETFund rate
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ghanaTaxConfig.getFundRate}
                    onChange={updateGhanaTax("getFundRate")}
                  />
                </label>
                <label className="accounting-field">
                  COVID levy rate
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ghanaTaxConfig.covidRate}
                    onChange={updateGhanaTax("covidRate")}
                  />
                </label>
              </div>
              <p className="accounting-muted">
                Total VAT rate: {Math.round(vatTotalRate * 1000) / 10}% · Corporate rates & levies per PwC Tax Summaries (reviewed 28 Aug 2025).
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default AdminAccounting;
