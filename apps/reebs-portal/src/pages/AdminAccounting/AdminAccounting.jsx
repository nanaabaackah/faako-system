/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedLoadingState, DateField, SelectField } from "@faako/ui";
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

const getExpenseAmount = (expense) => Math.max(0, toNumber(expense?.amount)) / 100;

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

const isAccountingBookingStatus = (status) =>
  ["confirmed", "completed"].includes(String(status || "").trim().toLowerCase());

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

const ACCOUNT_TYPES = ["ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE"];
const NORMAL_BALANCE_FOR = { ASSET:"DEBIT", EXPENSE:"DEBIT", LIABILITY:"CREDIT", EQUITY:"CREDIT", REVENUE:"CREDIT" };
const TYPE_LABELS = { ASSET:"Assets", LIABILITY:"Liabilities", EQUITY:"Equity", REVENUE:"Revenue", EXPENSE:"Expenses" };

const HISTORICAL_START_YEAR = 2024;
const HISTORICAL_INPUT_YEARS = (() => {
  const currentYear = new Date().getFullYear();
  const lastHistoricalYear = Math.max(HISTORICAL_START_YEAR, currentYear - 1);
  return Array.from(
    { length: lastHistoricalYear - HISTORICAL_START_YEAR + 1 },
    (_, index) => HISTORICAL_START_YEAR + index
  );
})();
const ACCOUNTING_REPORT_WINDOWS = [
  { value: "thisMonth", label: "Month to date" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisQuarter", label: "Quarter to date" },
  { value: "lastQuarter", label: "Last quarter" },
  { value: "thisYear", label: "Year to date" },
];
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
const DEFAULT_IMPORT_EXPENSE_LINE = { accountCode: "6000", description: "", amountPesewas: "" };
const createDefaultImportForm = (overrides = {}) => ({
  year: DEFAULT_HISTORICAL_YEAR,
  month: 1,
  grossSales: "",
  retailSplit: "",
  rentalSplit: "",
  cashReceived: "",
  arOutstanding: "",
  vatPayablePaid: "0",
  graPaymentDate: "",
  cogsPesewas: "",
  expenseLines: [{ ...DEFAULT_IMPORT_EXPENSE_LINE }],
  ...overrides,
});
const toCurrencyUnitsFromPesewas = (value) => Math.max(0, toNumber(value)) / 100;
const createEmptyHistoricalSalesRecordMap = () =>
  Object.fromEntries(
    HISTORICAL_INPUT_YEARS.map((year) => [
      year,
      Object.fromEntries(MANUAL_SALES_MONTHS.map(({ key }) => [key, 0])),
    ])
  );
const normalizeHistoricalMonthlySales = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return MANUAL_SALES_MONTHS.reduce((acc, month) => {
    acc[month.key] = Math.max(0, Math.round(toNumber(source[month.key]) * 100) / 100);
    return acc;
  }, Object.fromEntries(MANUAL_SALES_MONTHS.map(({ key }) => [key, 0])));
};

function AdminAccounting() {
  const [windowKey, setWindowKey] = useState("thisMonth");
  const [viewMode, setViewMode] = useState("overview"); // overview | activity | statements | taxes | coa | journals | import | trialBalance
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
  const [selectedHistoricalYear, setSelectedHistoricalYear] = useState(DEFAULT_HISTORICAL_YEAR);
  const [legacyHistoricalSalesByYear, setLegacyHistoricalSalesByYear] = useState(() =>
    createEmptyHistoricalSalesRecordMap()
  );
  const [legacyHistoricalLoaded, setLegacyHistoricalLoaded] = useState(false);
  const [legacyHistoricalError, setLegacyHistoricalError] = useState("");
  // ── Double-entry accounting state ─────────────────────────────────────────
  const [coaAccounts, setCoaAccounts] = useState([]);
  const [coaLoading, setCoaLoading] = useState(false);
  const [coaError, setCoaError] = useState("");
  const [coaLoaded, setCoaLoaded] = useState(false);
  const [coaShowForm, setCoaShowForm] = useState(false);
  const [coaNewForm, setCoaNewForm] = useState({ accountCode: "", accountName: "", accountType: "ASSET", normalBalance: "DEBIT" });
  const [coaFormError, setCoaFormError] = useState("");
  const [coaFormSaving, setCoaFormSaving] = useState(false);

  const [journals, setJournals] = useState([]);
  const [journalsLoading, setJournalsLoading] = useState(false);
  const [journalsError, setJournalsError] = useState("");
  const [journalsLoaded, setJournalsLoaded] = useState(false);
  const [journalsFilter, setJournalsFilter] = useState("all");
  const [expandedJournalId, setExpandedJournalId] = useState(null);
  const [journalDetailCache, setJournalDetailCache] = useState({});
  const [journalPosting, setJournalPosting] = useState(null);

  const [importBatches, setImportBatches] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importLoaded, setImportLoaded] = useState(false);
  const [importPostingId, setImportPostingId] = useState(null);
  const [importDeletingId, setImportDeletingId] = useState(null);
  const [importShowForm, setImportShowForm] = useState(false);
  const [importForm, setImportForm] = useState(() => createDefaultImportForm());
  const [importFormError, setImportFormError] = useState("");
  const [importFormSaving, setImportFormSaving] = useState(false);

  const [trialBalance, setTrialBalance] = useState(null);
  const [tbLoading, setTbLoading] = useState(false);
  const [tbError, setTbError] = useState("");
  const [tbAsOf, setTbAsOf] = useState(() => new Date().toISOString().slice(0, 10));

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
        const result = await fetchJson("/api/accounting-config");
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
      setLegacyHistoricalError("");
      try {
        const result = await fetchJson("/api/accounting-history");
        if (cancelled) return;
        const nextRecords = createEmptyHistoricalSalesRecordMap();
        const rows = Array.isArray(result?.years) ? result.years : [];
        rows.forEach((row) => {
          const year = Number(row?.year);
          if (!HISTORICAL_INPUT_YEARS.includes(year)) return;
          nextRecords[year] = normalizeHistoricalMonthlySales(row?.monthlySales);
        });
        setLegacyHistoricalSalesByYear(nextRecords);
      } catch (err) {
        if (cancelled) return;
        setLegacyHistoricalError(err.message || "Unable to load legacy historical carry-over.");
        setLegacyHistoricalSalesByYear(createEmptyHistoricalSalesRecordMap());
      } finally {
        if (!cancelled) {
          setLegacyHistoricalLoaded(true);
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

  const fetchDataTimeoutRef = useRef(null);

  const fetchData = async (key = windowKey) => {
    if (!data) setLoading(true);
    setIsFetching(true);
    setError("");
    clearNotice();
    try {
      const result = await fetchJson(`/api/financials?window=${key}`);
      setData(result);
    } catch (err) {
      console.error("Financials failed", err);
      setError(err.message || "Unable to load financial stats.");
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  const debouncedFetchData = useCallback((key = windowKey) => {
    if (fetchDataTimeoutRef.current) {
      clearTimeout(fetchDataTimeoutRef.current);
    }
    fetchDataTimeoutRef.current = setTimeout(() => {
      fetchData(key);
    }, 300);
  }, [windowKey]);

  useEffect(() => {
    fetchData("thisMonth");
    return () => {
      if (fetchDataTimeoutRef.current) {
        clearTimeout(fetchDataTimeoutRef.current);
      }
    };
  }, []);

  const fetchListData = async () => {
    setListLoading(true);
    setListError("");
    try {
      const [ordersRes, bookingsRes, documentsRes, expensesRes] = await Promise.all([
        fetchJson("/api/orders?compact=1"),
        fetchJson("/api/bookings?compact=1"),
        fetchJson("/api/invoice-documents?compact=1"),
        fetchJson("/api/expenses"),
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

  useEffect(() => {
    if (viewMode !== "coa" || coaLoaded) return;
    fetchCoa();
  }, [viewMode, coaLoaded]);

  useEffect(() => {
    if (viewMode !== "journals" || journalsLoaded) return;
    fetchJournals();
  }, [viewMode, journalsLoaded]);

  useEffect(() => {
    if (!["overview", "statements", "taxes", "import"].includes(viewMode)) return;
    if (importLoaded || importLoading) return;
    fetchImportBatches();
  }, [viewMode, importLoaded, importLoading]);

  useEffect(() => {
    if (viewMode !== "trialBalance" || trialBalance !== null) return;
    fetchTrialBalance(tbAsOf);
  }, [viewMode]);

  const historicalSalesMonths = useMemo(
    () => {
      const importedMonths = (Array.isArray(importBatches) ? importBatches : [])
        .map((batch) => {
          const start = batch?.periodStart ? new Date(batch.periodStart) : null;
          const end = batch?.periodEnd ? new Date(batch.periodEnd) : null;
          if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
            return null;
          }
          const monthMeta = MANUAL_SALES_MONTHS[start.getUTCMonth()];
          const summary = batch?.summary && typeof batch.summary === "object" ? batch.summary : {};
          return {
            id: batch.id,
            batchName: batch.batchName || `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")} Historical`,
            key: monthMeta?.key || String(start.getUTCMonth() + 1),
            label: monthMeta?.label || start.toLocaleDateString("en-GB", { month: "short" }),
            monthIndex: start.getUTCMonth(),
            year: start.getUTCFullYear(),
            amount: toCurrencyUnitsFromPesewas(summary.grossSales),
            retailAmount: toCurrencyUnitsFromPesewas(summary.retailSplit),
            rentalAmount: toCurrencyUnitsFromPesewas(summary.rentalSplit),
            cogsAmount: toCurrencyUnitsFromPesewas(summary.cogs),
            expenseAmount: toCurrencyUnitsFromPesewas(summary.expenseTotal),
            start,
            end,
            dateKey: start.toISOString().slice(0, 10),
            isPosted: Boolean(batch?.isPosted),
            source: "import",
          };
        })
        .filter(Boolean);

      const coveredMonths = new Set(
        importedMonths.map((month) => `${month.year}-${String(month.monthIndex + 1).padStart(2, "0")}`)
      );

      const legacyMonths = legacyHistoricalLoaded
        ? HISTORICAL_INPUT_YEARS.flatMap((year) =>
            MANUAL_SALES_MONTHS.map((monthMeta) => {
              const amount = Math.max(0, toNumber(legacyHistoricalSalesByYear?.[year]?.[monthMeta.key]));
              const monthKey = `${year}-${String(monthMeta.monthIndex + 1).padStart(2, "0")}`;
              if (!amount || coveredMonths.has(monthKey)) return null;
              const start = new Date(Date.UTC(year, monthMeta.monthIndex, 1));
              const end = new Date(Date.UTC(year, monthMeta.monthIndex + 1, 1));
              return {
                id: `legacy-${monthKey}`,
                batchName: `Legacy carry-over · ${monthMeta.label} ${year}`,
                key: monthMeta.key,
                label: monthMeta.label,
                monthIndex: monthMeta.monthIndex,
                year,
                amount,
                retailAmount: amount,
                rentalAmount: 0,
                cogsAmount: 0,
                expenseAmount: 0,
                start,
                end,
                dateKey: start.toISOString().slice(0, 10),
                isPosted: false,
                source: "legacy",
              };
            }).filter(Boolean)
          )
        : [];

      return [...importedMonths, ...legacyMonths].sort((a, b) => a.start - b.start);
    },
    [importBatches, legacyHistoricalLoaded, legacyHistoricalSalesByYear]
  );
  const selectedHistoricalYearImports = useMemo(
    () => historicalSalesMonths.filter((month) => month.year === selectedHistoricalYear),
    [historicalSalesMonths, selectedHistoricalYear]
  );
  const selectedHistoricalYearTotal = useMemo(
    () => selectedHistoricalYearImports.reduce((sum, month) => sum + month.amount, 0),
    [selectedHistoricalYearImports]
  );
  const selectedHistoricalYearPostedCount = useMemo(
    () => selectedHistoricalYearImports.filter((month) => month.source === "import" && month.isPosted).length,
    [selectedHistoricalYearImports]
  );
  const selectedHistoricalYearImportCount = useMemo(
    () => selectedHistoricalYearImports.filter((month) => month.source === "import").length,
    [selectedHistoricalYearImports]
  );
  const selectedHistoricalYearLegacyCount = useMemo(
    () => selectedHistoricalYearImports.filter((month) => month.source === "legacy").length,
    [selectedHistoricalYearImports]
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
  const historicalImportWindowSummary = useMemo(
    () => historicalSalesInWindow.reduce((summary, month) => ({
      grossSales: summary.grossSales + month.amount,
      retailSales: summary.retailSales + month.retailAmount,
      rentalSales: summary.rentalSales + month.rentalAmount,
      cogs: summary.cogs + month.cogsAmount,
      expenses: summary.expenses + month.expenseAmount,
      count: summary.count + 1,
      draftCount: summary.draftCount + (month.source === "import" && !month.isPosted ? 1 : 0),
      legacyCount: summary.legacyCount + (month.source === "legacy" ? 1 : 0),
    }), {
      grossSales: 0,
      retailSales: 0,
      rentalSales: 0,
      cogs: 0,
      expenses: 0,
      count: 0,
      draftCount: 0,
      legacyCount: 0,
    }),
    [historicalSalesInWindow]
  );
  const historicalSalesWindowTotal = useMemo(
    () => historicalImportWindowSummary.grossSales,
    [historicalImportWindowSummary]
  );

  const revenueSplit = useMemo(() => {
    const retail = (data?.revenueByCategory?.retail || 0) + historicalImportWindowSummary.retailSales;
    const rental = (data?.revenueByCategory?.rental || 0) + historicalImportWindowSummary.rentalSales;
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
  }, [data?.revenueByCategory, historicalImportWindowSummary]);

  const cashflowTrend = useMemo(() => {
    const baseRows = Array.isArray(data?.cashflow) ? data.cashflow : [];
    if (!baseRows.length && !historicalImportWindowSummary.count) return [];
    
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
  }, [data?.cashflow, historicalImportWindowSummary.count, historicalSalesInWindow]);
  const totalRevenue = useMemo(() => data?.revenue || 0, [data]);
  const grossRevenue = useMemo(
    () => totalRevenue + historicalSalesWindowTotal,
    [historicalSalesWindowTotal, totalRevenue]
  );
  const financeSummary = useMemo(() => data?.summary || null, [data]);
  const expenseWindowLabel = data?.expenseWindowLabel || data?.windowLabel || "";
  const hasHistoricalSalesInWindow = historicalImportWindowSummary.count > 0;
  const windowLabel = data?.windowLabel || "";
  const cashflowWindowLabel = hasHistoricalSalesInWindow
    ? `${windowLabel || "Selected window"} + imported historical batches`
    : windowLabel
      ? `Daily revenue in ${windowLabel}`
      : "Daily revenue";
  const expenseBreakdown = useMemo(() => {
    const rows = Array.isArray(data?.expenseBreakdown) ? data.expenseBreakdown : [];
    const totals = new Map();
    rows.forEach((row) => {
      const category = normalizeExpenseCategory(row?.category) || "Operational";
      const amount = toNumber(row?.amount);
      if (amount > 0) {
        totals.set(category, (totals.get(category) || 0) + amount);
      }
    });

    if (historicalImportWindowSummary.expenses > 0) {
      totals.set(
        "Historical imports",
        (totals.get("Historical imports") || 0) + historicalImportWindowSummary.expenses
      );
    }

    if (!totals.size) return [];
    
    const customCategories = Array.from(totals.keys())
      .filter((category) => !EXPENSE_CATEGORY_LABELS.includes(category))
      .sort((a, b) => a.localeCompare(b));
    
    const ordered = [...EXPENSE_CATEGORY_LABELS, ...customCategories];
    return ordered
      .map((category) => ({
        category,
        amount: totals.get(category) || 0,
      }))
      .filter((entry) => entry.amount > 0);
  }, [data?.expenseBreakdown, historicalImportWindowSummary.expenses]);
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

  const activeDocuments = useMemo(
    () => documents.filter((document) => !document?.archivedAt),
    [documents]
  );

  const documentBySourceKey = useMemo(() => {
    const map = new Map();
    activeDocuments.forEach((document) => {
      const sourceKey = getDocumentSourceKey(document);
      if (!sourceKey) return;
      if (!map.has(sourceKey)) {
        map.set(sourceKey, document);
      }
    });
    return map;
  }, [activeDocuments]);

  const filteredDocuments = useMemo(
    () => activeDocuments.filter((document) => isWithinRange(getDocumentDate(document), windowStart, windowEnd)),
    [activeDocuments, windowStart, windowEnd]
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((expense) => isWithinRange(expense.date, windowStart, windowEnd)),
    [expenses, windowStart, windowEnd]
  );

  const linkedIncomeRows = useMemo(() => {
    const documentRows = filteredDocuments.map((document) => {
      const documentType = getDocumentType(document);
      return {
        id: `document-${document.id}`,
        type: documentType === "receipt" ? "Receipt" : "Invoice",
        number: getDocumentReference(document),
        customer: getDocumentCustomer(document),
        date: getDocumentDate(document),
        status: document.paymentStatus || "draft",
        direction: "in",
        detail: document.sourceLabel || document.linkedLabel || (
          document.sourceType === "manual" ? "Manual document" : document.sourceType || "Document"
        ),
        total: getDocumentTotal(document),
        sourceKey: getDocumentSourceKey(document),
      };
    });

    const orderRows = filteredOrders
      .filter((order) => !documentBySourceKey.has(`orders-${order.id}`))
      .map((order) => ({
        id: `order-${order.id}`,
        type: "Receipt",
        number: order.orderNumber || `ORD-${order.id}`,
        customer: order.customerName || "-",
        date: order.orderDate,
        status: order.status || "posted",
        direction: "in",
        detail: "Order fallback",
        total: Number(order.total || 0),
      }));

    const bookingRows = filteredBookings
      .filter((booking) => isAccountingBookingStatus(booking.status))
      .filter((booking) => !documentBySourceKey.has(`bookings-${booking.id}`))
      .map((booking) => ({
        id: `booking-${booking.id}`,
        type: "Invoice",
        number: `INV-${booking.id}`,
        customer: booking.customerName || "-",
        date: booking.eventDate,
        status: booking.status || "confirmed",
        direction: "in",
        detail: "Booking fallback",
        total: Number(booking.totalAmount || 0) / 100,
      }));

    return [...documentRows, ...orderRows, ...bookingRows];
  }, [documentBySourceKey, filteredBookings, filteredDocuments, filteredOrders]);

  const listRows = useMemo(() => {
    const expenseRows = filteredExpenses.map((expense) => ({
      id: `expense-${expense.id}`,
      type: "Expense",
      number: expense.category || "Expense",
      customer: expense.description || "-",
      date: expense.date,
      status: expense.maintenanceStatus || "posted",
      direction: "out",
      detail: expense.category || "Expense",
      total: getExpenseAmount(expense),
    }));
    return [...linkedIncomeRows, ...expenseRows].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [filteredExpenses, linkedIncomeRows]);

  const receiptsTotal = useMemo(
    () => linkedIncomeRows
      .filter((row) => row.type === "Receipt")
      .reduce((sum, row) => sum + Number(row.total || 0), 0),
    [linkedIncomeRows]
  );
  const invoicesTotal = useMemo(
    () => linkedIncomeRows
      .filter((row) => row.type === "Invoice")
      .reduce((sum, row) => sum + Number(row.total || 0), 0),
    [linkedIncomeRows]
  );
  const expensesTotal = useMemo(
    () => listLoaded
      ? filteredExpenses.reduce((sum, expense) => sum + getExpenseAmount(expense), 0)
      : toNumber(financeSummary?.operatingExpenses || 0),
    [filteredExpenses, financeSummary?.operatingExpenses, listLoaded]
  );
  const activityReceiptsTotal = receiptsTotal;
  const activityInvoicesTotal = invoicesTotal;
  const receiptsTotalDisplay = listLoaded ? activityReceiptsTotal : toNumber(financeSummary?.revenue || 0);
  const invoicesTotalDisplay = listLoaded ? activityInvoicesTotal : toNumber(financeSummary?.rentalIncome || 0);
  const receiptCount = listLoaded
    ? linkedIncomeRows.filter((row) => row.type === "Receipt").length
    : toNumber(data?.orders || 0);
  const invoiceCount = listLoaded
    ? linkedIncomeRows.filter((row) => row.type === "Invoice").length
    : toNumber(data?.bookings || 0);
  const expenseCount = listLoaded ? filteredExpenses.length : 0;
  const combinedTotal = receiptsTotalDisplay + invoicesTotalDisplay;
  const linkedMoneyIn = combinedTotal;
  const linkedNet = linkedMoneyIn - expensesTotal;
  const statementSummary = useMemo(() => {
    if (!financeSummary) return null;
    
    const revenue = receiptsTotalDisplay + historicalImportWindowSummary.retailSales;
    const rentalIncome = invoicesTotalDisplay + historicalImportWindowSummary.rentalSales;
    const cogs = toNumber(financeSummary.cogs) + historicalImportWindowSummary.cogs;
    const operatingExpenses = expensesTotal + historicalImportWindowSummary.expenses;
    const grossProfit = revenue + rentalIncome - cogs;
    const netProfit = grossProfit - operatingExpenses;

    return {
      ...financeSummary,
      revenue,
      rentalIncome,
      cogs,
      operatingExpenses,
      grossProfit,
      netProfit,
    };
  }, [
    expensesTotal,
    financeSummary,
    historicalImportWindowSummary.cogs,
    historicalImportWindowSummary.expenses,
    historicalImportWindowSummary.retailSales,
    historicalImportWindowSummary.rentalSales,
    invoicesTotalDisplay,
    receiptsTotalDisplay,
  ]);
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

  const updateImportField = (field) => (event) => {
    const value = event.target.value;
    setImportForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateImportExpenseLine = (index, field) => (event) => {
    const value = event.target.value;
    setImportForm((prev) => ({
      ...prev,
      expenseLines: prev.expenseLines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      ),
    }));
  };

  const addImportExpenseLine = () => {
    setImportForm((prev) => ({
      ...prev,
      expenseLines: [...prev.expenseLines, { ...DEFAULT_IMPORT_EXPENSE_LINE }],
    }));
  };

  const removeImportExpenseLine = (index) => {
    setImportForm((prev) => {
      const nextLines = prev.expenseLines.filter((_, lineIndex) => lineIndex !== index);
      return {
        ...prev,
        expenseLines: nextLines.length ? nextLines : [{ ...DEFAULT_IMPORT_EXPENSE_LINE }],
      };
    });
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
  
  const currentAssets = useMemo(() =>
    cashOnHand +
    bankBalance +
    accountsReceivable +
    inventoryValue +
    prepaidExpenses +
    otherCurrentAssets,
    [cashOnHand, bankBalance, accountsReceivable, inventoryValue, prepaidExpenses, otherCurrentAssets]
  );
  
  const currentLiabilities = useMemo(() =>
    accountsPayable + taxesPayable + accruedExpenses + shortTermLoans,
    [accountsPayable, taxesPayable, accruedExpenses, shortTermLoans]
  );
  
  const totalAssets = useMemo(() =>
    currentAssets + fixedAssets + otherAssets,
    [currentAssets, fixedAssets, otherAssets]
  );
  
  const totalLiabilities = useMemo(() =>
    currentLiabilities + longTermLoans,
    [currentLiabilities, longTermLoans]
  );
  
  const periodNetProfit = toNumber(statementSummary?.netProfit || 0);
  const equityBase = ownerEquity + retainedEarnings;
  
  const totalEquity = useMemo(() =>
    equityBase + periodNetProfit,
    [equityBase, periodNetProfit]
  );
  
  const balanceGap = useMemo(() =>
    totalAssets - (totalLiabilities + totalEquity),
    [totalAssets, totalLiabilities, totalEquity]
  );
  
  const workingCapital = useMemo(() =>
    currentAssets - currentLiabilities,
    [currentAssets, currentLiabilities]
  );
  
  const quickAssets = useMemo(() =>
    cashOnHand + bankBalance + accountsReceivable,
    [cashOnHand, bankBalance, accountsReceivable]
  );
  
  const currentRatio = useMemo(() =>
    currentLiabilities > 0 ? currentAssets / currentLiabilities : null,
    [currentAssets, currentLiabilities]
  );
  
  const quickRatio = useMemo(() =>
    currentLiabilities > 0 ? quickAssets / currentLiabilities : null,
    [quickAssets, currentLiabilities]
  );

  const corporateCategory = ghanaTaxConfig.corporateCategory || "general";
  
  const taxRates = useMemo(() => ({
    vatCoreRate: parsePercent(ghanaTaxConfig.vatCoreRate),
    nhilRate: parsePercent(ghanaTaxConfig.nhilRate),
    getFundRate: parsePercent(ghanaTaxConfig.getFundRate),
    covidRate: parsePercent(ghanaTaxConfig.covidRate),
    corporateRate: parsePercent(ghanaTaxConfig.corporateRate),
  }), [ghanaTaxConfig]);
  
  const vatCoreRate = taxRates.vatCoreRate;
  const nhilRate = taxRates.nhilRate;
  const getFundRate = taxRates.getFundRate;
  const covidRate = taxRates.covidRate;
  const corporateRate = taxRates.corporateRate;
  const vatTotalRate = useMemo(() =>
    vatCoreRate + nhilRate + getFundRate + covidRate,
    [vatCoreRate, nhilRate, getFundRate, covidRate]
  );
  const exemptSales = toNumber(taxInputs.exemptSales);
  
  const salesBaseForTax = useMemo(() => {
    return combinedTotal + historicalSalesWindowTotal;
  }, [combinedTotal, historicalSalesWindowTotal]);
  
  const taxableSales = Math.max(0, salesBaseForTax - exemptSales);
  const outputVat = useMemo(() =>
    taxableSales * vatTotalRate,
    [taxableSales, vatTotalRate]
  );
  const inputVatCredits = toNumber(taxInputs.inputVatCredits);
  const vatPayable = Math.max(0, outputVat - inputVatCredits);
  const grossProduction = toNumber(taxInputs.grossProduction);
  const profitBeforeTax = useMemo(() => {
    const revenue = toNumber(statementSummary?.revenue || 0);
    const rentalIncome = toNumber(statementSummary?.rentalIncome || 0);
    const cogs = toNumber(statementSummary?.cogs || 0);
    const operatingExpenses = toNumber(statementSummary?.operatingExpenses || 0);
    return revenue + rentalIncome - cogs - operatingExpenses;
  }, [statementSummary]);
  const profitBeforeTaxBase = Math.max(0, profitBeforeTax);
  const allowableDeductions = toNumber(taxInputs.allowableDeductions);
  const taxableIncome = useMemo(() => {
    return Math.max(0, profitBeforeTax - allowableDeductions);
  }, [allowableDeductions, profitBeforeTax]);
  const corporateTaxDue = useMemo(() => {
    return taxableIncome * corporateRate;
  }, [corporateRate, taxableIncome]);
  const gslCategory = ghanaTaxConfig.gslCategory || "none";
  const gslDue = useMemo(() => {
    let amount = 0;
    if (gslCategory === "categoryA") amount = profitBeforeTaxBase * 0.05;
    else if (gslCategory === "categoryBGold") amount = Math.max(0, grossProduction) * 0.03;
    else if (gslCategory === "categoryBOther") amount = Math.max(0, grossProduction) * 0.01;
    else if (gslCategory === "categoryC") amount = profitBeforeTaxBase * 0.025;
    return amount;
  }, [gslCategory, grossProduction, profitBeforeTaxBase]);
  
  const fsrlDue = useMemo(() => {
    return ghanaTaxConfig.fsrlEnabled ? profitBeforeTaxBase * 0.05 : 0;
  }, [ghanaTaxConfig.fsrlEnabled, profitBeforeTaxBase]);
  const withholdingCredits = toNumber(taxInputs.withholdingCredits);
  const totalTaxDue = useMemo(() => {
    return Math.max(0, vatPayable + corporateTaxDue + gslDue + fsrlDue - withholdingCredits);
  }, [corporateTaxDue, fsrlDue, gslDue, vatPayable, withholdingCredits]);
  const grossFormulaGap = useMemo(() => {
    return toNumber(statementSummary?.revenue || 0) +
      toNumber(statementSummary?.rentalIncome || 0) -
      toNumber(statementSummary?.cogs || 0) -
      toNumber(statementSummary?.grossProfit || 0);
  }, [statementSummary]);
  
  const netFormulaGap = useMemo(() => {
    return toNumber(statementSummary?.grossProfit || 0) -
      toNumber(statementSummary?.operatingExpenses || 0) -
      toNumber(statementSummary?.netProfit || 0);
  }, [statementSummary]);
  
  const expenseTieOutGap = useMemo(() => {
    return expenseBreakdownTotal - toNumber(statementSummary?.operatingExpenses || 0);
  }, [expenseBreakdownTotal, statementSummary]);

  const withinTolerance = (value) => Math.abs(toNumber(value)) <= 1;
  const toMoneyString = (value) => toNumber(value).toFixed(2);

  const autoFillBalanceInputs = () => {
    const revenue = salesBaseForTax;
    const cogs = toNumber(statementSummary?.cogs || 0);
    const operatingExpenses = toNumber(statementSummary?.operatingExpenses || 0);
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
    const salesBase = Math.max(0, salesBaseForTax);
    const operatingExpenses = toNumber(statementSummary?.operatingExpenses || 0);
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
      const result = await fetchJson("/api/accounting-config", {
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

  // ── Double-entry functions ─────────────────────────────────────────────────

  const fetchCoa = async () => {
    setCoaLoading(true);
    setCoaError("");
    try {
      const result = await fetchJson("/api/accounting-coa");
      setCoaAccounts(Array.isArray(result) ? result : []);
      setCoaLoaded(true);
    } catch (err) {
      setCoaError(err.message || "Unable to load chart of accounts.");
    } finally {
      setCoaLoading(false);
    }
  };

  const createCoaAccount = async () => {
    if (!coaNewForm.accountCode) return setCoaFormError("Account code is required.");
    if (!coaNewForm.accountName) return setCoaFormError("Account name is required.");
    setCoaFormError("");
    setCoaFormSaving(true);
    try {
      await fetchJson("/api/accounting-coa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coaNewForm),
      });
      setCoaNewForm({ accountCode: "", accountName: "", accountType: "ASSET", normalBalance: "DEBIT" });
      setCoaShowForm(false);
      await fetchCoa();
    } catch (err) {
      setCoaFormError(err.message || "Failed to create account.");
    } finally {
      setCoaFormSaving(false);
    }
  };

  const toggleCoaActive = async (acct) => {
    setCoaError("");
    try {
      await fetchJson("/api/accounting-coa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: acct.id, isActive: !acct.isActive }),
      });
      await fetchCoa();
    } catch (err) {
      setCoaError(err.message || "Failed to update account.");
    }
  };

  const fetchJournals = async () => {
    setJournalsLoading(true);
    setJournalsError("");
    try {
      const result = await fetchJson("/api/accounting-journals?limit=200");
      setJournals(Array.isArray(result) ? result : []);
      setJournalsLoaded(true);
    } catch (err) {
      setJournalsError(err.message || "Unable to load journals.");
    } finally {
      setJournalsLoading(false);
    }
  };

  const toggleJournalExpand = async (journalId) => {
    if (expandedJournalId === journalId) { setExpandedJournalId(null); return; }
    setExpandedJournalId(journalId);
    if (journalDetailCache[journalId]) return;
    try {
      const result = await fetchJson(`/api/accounting-journals?id=${journalId}`);
      setJournalDetailCache((prev) => ({ ...prev, [journalId]: result?.lines || [] }));
    } catch { /* fail silently */ }
  };

  const postJournal = async (journalId) => {
    setJournalPosting(journalId);
    setJournalsError("");
    try {
      await fetchJson("/api/accounting-journals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: journalId, action: "post" }),
      });
      await fetchJournals();
      setJournalDetailCache((prev) => { const n = { ...prev }; delete n[journalId]; return n; });
    } catch (err) {
      setJournalsError(err.message || "Failed to post journal.");
    } finally {
      setJournalPosting(null);
    }
  };

  const fetchImportBatches = async () => {
    setImportLoading(true);
    setImportError("");
    try {
      const result = await fetchJson("/api/accounting-import");
      setImportBatches(Array.isArray(result) ? result : []);
    } catch (err) {
      setImportBatches([]);
      setImportError(err.message || "Unable to load import batches.");
    } finally {
      setImportLoaded(true);
      setImportLoading(false);
    }
  };

  const submitImportBatch = async () => {
    setImportFormError("");
    const gross  = Math.round(Number(importForm.grossSales)     * 100);
    const retail = Math.round(Number(importForm.retailSplit)    * 100);
    const rental = Math.round(Number(importForm.rentalSplit)    * 100);
    const cash   = Math.round(Number(importForm.cashReceived)   * 100);
    const ar     = Math.round(Number(importForm.arOutstanding)  * 100);
    const vatPd  = Math.round(Number(importForm.vatPayablePaid) * 100);
    const cogsAmt = Math.round(Number(importForm.cogsPesewas)   * 100);
    const graPaymentDate = String(importForm.graPaymentDate || "").trim();
    if (!gross) return setImportFormError("Gross sales is required.");
    if (retail + rental !== gross)
      return setImportFormError(`Retail + rental must equal gross. Got ${((retail + rental) / 100).toFixed(2)} vs ${(gross / 100).toFixed(2)}.`);
    if (cash + ar !== gross)
      return setImportFormError(`Cash received + AR must equal gross. Got ${((cash + ar) / 100).toFixed(2)} vs ${(gross / 100).toFixed(2)}.`);
    if (vatPd > 0 && !graPaymentDate) {
      return setImportFormError("GRA payment date is required when VAT paid is greater than zero.");
    }

    const y = Number(importForm.year);
    const m = Number(importForm.month);
    const mm = String(m).padStart(2, "0");
    const lastDay = new Date(y, m, 0).getDate();
    const batchName  = `${y}-${mm} Historical`;
    const periodStart = `${y}-${mm}-01`;
    const periodEnd   = `${y}-${mm}-${String(lastDay).padStart(2, "0")}`;

    const expenses = importForm.expenseLines
      .filter((l) => l.accountCode && Number(l.amountPesewas) > 0)
      .map((l) => ({
        accountCode: String(l.accountCode).trim(),
        description: l.description || "",
        amount: Math.round(Number(l.amountPesewas) * 100),
      }));

    setImportFormSaving(true);
    try {
      await fetchJson("/api/accounting-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchName, periodStart, periodEnd,
          source: "VAT_RETURN + BANK_STATEMENT",
          grossSales: gross, retailSplit: retail, rentalSplit: rental,
          cashReceived: cash, arOutstanding: ar,
          vatRemitted: vatPd,
          graPaymentDate: graPaymentDate || null,
          cogs: cogsAmt || null,
          expenses,
        }),
      });
      setImportForm(createDefaultImportForm({ year: y, month: m }));
      setImportShowForm(false);
      await fetchImportBatches();
      pushNotice(`Historical import batch ${batchName} created. Review and post when ready.`, "success");
    } catch (err) {
      setImportFormError(err.message || "Import failed.");
    } finally {
      setImportFormSaving(false);
    }
  };

  const postImportBatch = async (batchId) => {
    setImportPostingId(batchId);
    setImportError("");
    try {
      await fetchJson("/api/accounting-import", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: batchId, action: "post" }),
      });
      await fetchImportBatches();
      pushNotice("Historical import batch posted.", "success");
    } catch (err) {
      setImportError(err.message || "Failed to post import batch.");
    } finally {
      setImportPostingId(null);
    }
  };

  const deleteImportBatch = async (batchId) => {
    if (!window.confirm("Delete this draft batch and all its journals?")) return;
    setImportDeletingId(batchId);
    setImportError("");
    try {
      await fetchJson("/api/accounting-import", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: batchId, action: "delete" }),
      });
      await fetchImportBatches();
      pushNotice("Historical import batch deleted.", "success");
    } catch (err) {
      setImportError(err.message || "Failed to delete batch.");
    } finally {
      setImportDeletingId(null);
    }
  };

  const fetchTrialBalance = async (asOf) => {
    setTbLoading(true);
    setTbError("");
    try {
      const result = await fetchJson(`/api/accounting-trial-balance?asOf=${asOf}&summary=true`);
      setTrialBalance(result);
    } catch (err) {
      setTbError(err.message || "Unable to load trial balance.");
    } finally {
      setTbLoading(false);
    }
  };

  const fmtPesewas = (p) => formatCurrency((Number(p) || 0) / 100);

  return (
    <div className="accounting-page">
      <div className="accounting-shell">
        <AdminBreadcrumb items={[{ label: "Accounting" }]} />

        <AdminPageHeader
          eyebrow="REEBS Core Finance"
          title="Accounting"
          subtitle="Shop and rental/event finance only. Water Business revenue, costs, and profit are excluded."
        />

        <section className="accounting-toolbar" aria-label="Accounting controls">
          <div className="accounting-filters accounting-toolbar-row">
            <div className="accounting-filters-left">
              <SelectField
                fieldClassName="accounting-filter"
                label="Reporting period"
                value={windowKey}
                onChange={(event) => {
                  const next = event.target.value;
                  setWindowKey(next);
                  debouncedFetchData(next);
                }}
              >
                {ACCOUNTING_REPORT_WINDOWS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {HISTORICAL_INPUT_YEARS.map((year) => (
                  <option key={year} value={`year${year}`}>
                    {year} full year
                  </option>
                ))}
                <option value="allTime">All time</option>
              </SelectField>
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
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "coa"}
                    className={viewMode === "coa" ? "is-active" : ""}
                    onClick={() => setViewMode("coa")}
                  >
                    Accounts
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "journals"}
                    className={viewMode === "journals" ? "is-active" : ""}
                    onClick={() => setViewMode("journals")}
                  >
                    Journals
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "import"}
                    className={viewMode === "import" ? "is-active" : ""}
                    onClick={() => setViewMode("import")}
                  >
                    Imports
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "trialBalance"}
                    className={viewMode === "trialBalance" ? "is-active" : ""}
                    onClick={() => setViewMode("trialBalance")}
                  >
                    Trial Balance
                  </button>
                </div>
              </div>
              <div className="accounting-actions">
                <button type="button" className="accounting-secondary" onClick={() => {
                  if (fetchDataTimeoutRef.current) clearTimeout(fetchDataTimeoutRef.current);
                  fetchData(windowKey);
                }}>
                  <AppIcon icon={faRotateRight} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <AnimatedLoadingState
            compact
            className="glass-card admin-module-loading"
            title="Loading financial metrics"
            message="Reconciling orders, invoices, expenses, and cash flow."
            variant="dashboard"
          />
        )}
        {!loading && isFetching && data && (
          <InlineNotice tone="loading" title="Refreshing calculations" message="Updating accounting totals." compact />
        )}
        {!loading && !error && !accountingConfigLoaded && (
          <InlineNotice tone="loading" title="Loading saved accounting settings" compact />
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
                  <p className="accounting-panel-label">Historical imports</p>
                  <h3>{selectedHistoricalYear} historical summary</h3>
                  <p className="accounting-panel-sub">
                    Historical backfill is now managed in Imports. The same batches feed reporting carry-over here and the accounting journals in the import workflow.
                  </p>
                </div>
                <div className="accounting-panel-actions">
                  <SelectField
                    fieldClassName="accounting-field"
                    label="Historical year"
                    value={selectedHistoricalYear}
                    onChange={(event) => changeHistoricalYear(event.target.value)}
                    disabled={importLoading && !importLoaded}
                  >
                    {HISTORICAL_INPUT_YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </SelectField>
                  <button
                    type="button"
                    className="accounting-secondary"
                    onClick={() => setViewMode("import")}
                  >
                    Manage imports
                  </button>
                </div>
              </div>

              {(importError || legacyHistoricalError) && (
                <InlineNotice
                  tone="error"
                  title="Historical imports unavailable"
                  message={importError || legacyHistoricalError}
                  compact
                />
              )}

              <div className="accounting-pnl">
                <div className="accounting-pnl-row">
                  <span>Imported in {selectedHistoricalYear}</span>
                  <strong>{formatCurrency(selectedHistoricalYearTotal)}</strong>
                </div>
                <div className="accounting-pnl-row">
                  <span>Applied in {windowLabel || "selected window"}</span>
                  <strong>{formatCurrency(historicalSalesWindowTotal)}</strong>
                </div>
                <div className="accounting-pnl-row">
                  <span>Posted import batches in {selectedHistoricalYear}</span>
                  <strong>
                    {selectedHistoricalYearImportCount
                      ? `${selectedHistoricalYearPostedCount} / ${selectedHistoricalYearImportCount}`
                      : "—"}
                  </strong>
                </div>
                {selectedHistoricalYearLegacyCount > 0 && (
                  <div className="accounting-pnl-row">
                    <span>Legacy carry-over months in {selectedHistoricalYear}</span>
                    <strong>{selectedHistoricalYearLegacyCount}</strong>
                  </div>
                )}
                {hasHistoricalSalesInWindow && (
                  <div className="accounting-pnl-row">
                    <span>Non-posted carry-over in this window</span>
                    <strong>
                      {historicalImportWindowSummary.draftCount}
                      {historicalImportWindowSummary.legacyCount ? ` drafts + ${historicalImportWindowSummary.legacyCount} legacy` : " drafts"}
                    </strong>
                  </div>
                )}
              </div>

              {importLoading && !importLoaded ? (
                <AnimatedLoadingState
                  compact
                  className="admin-module-loading"
                  title="Loading historical batches"
                  message="Fetching imported sales and reconciliation rows."
                  variant="dashboard"
                />
              ) : selectedHistoricalYearImports.length ? (
                <div className="accounting-table-shell admin-table-scroll" style={{ marginTop: "0.95rem" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Batch</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Sales</th>
                        <th style={{ textAlign: "right" }}>COGS</th>
                        <th style={{ textAlign: "right" }}>Expenses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedHistoricalYearImports.map((month) => (
                        <tr key={month.id}>
                          <td>{month.label} {month.year}</td>
                          <td>{month.batchName}</td>
                          <td>{month.source === "legacy" ? "Legacy carry-over" : (month.isPosted ? "Posted" : "Draft")}</td>
                          <td style={{ textAlign: "right" }}>{formatCurrency(month.amount)}</td>
                          <td style={{ textAlign: "right" }}>{month.cogsAmount ? formatCurrency(month.cogsAmount) : "—"}</td>
                          <td style={{ textAlign: "right" }}>{month.expenseAmount ? formatCurrency(month.expenseAmount) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="accounting-muted">
                  No import batches for {selectedHistoricalYear} yet. Use Imports to backfill that year.
                </p>
              )}

              <p className="accounting-muted">
                Imported batches now drive historical carry-over. Their sales feed revenue, cash flow, and VAT here, and any imported COGS or expense summaries also flow into the statement and tax calculations. Older legacy carry-over stays visible until you replace those months with imports. Posting is still required for the ledgers and trial balance.
              </p>
            </div>
          </section>
        )}

        {!loading && !error && data && viewMode === "overview" && (
          <>
            <section className="accounting-kpis">
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Money in</p>
                <h3 className="accounting-kpi-value">{formatCurrency(linkedMoneyIn + historicalSalesWindowTotal)}</h3>
                <p className="accounting-kpi-sub">
                  {receiptCount} receipts · {invoiceCount} invoices
                  {hasHistoricalSalesInWindow ? ` + ${formatCurrency(historicalSalesWindowTotal)} imported history` : ""}
                </p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Money out</p>
                <h3 className="accounting-kpi-value">{formatCurrency(expensesTotal + historicalImportWindowSummary.expenses)}</h3>
                <p className="accounting-kpi-sub">
                  {expenseWindowLabel || data.windowLabel || ""}
                  {historicalImportWindowSummary.expenses > 0 ? ` + ${formatCurrency(historicalImportWindowSummary.expenses)} imported` : ""}
                </p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Gross profit</p>
                <h3 className="accounting-kpi-value">{formatCurrency(statementSummary?.grossProfit || 0)}</h3>
                <p className="accounting-kpi-sub">Before expenses</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Net profit</p>
                <h3 className="accounting-kpi-value">{formatCurrency(statementSummary?.netProfit || 0)}</h3>
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
                {loading && !statementSummary ? (
                  <AnimatedLoadingState
                    compact
                    className="admin-module-loading"
                    title="Reconciling ledgers"
                    message="Calculating revenue, COGS, expenses, and net profit."
                    variant="dashboard"
                  />
                ) : error && !statementSummary ? (
                  <InlineNotice tone="error" title="Financials unavailable" message={error} compact />
                ) : statementSummary ? (
                  <div className="accounting-pnl">
                    <div className="accounting-pnl-row">
                      <span>Receipts</span>
                      <span>{formatCurrency(statementSummary.revenue)}</span>
                    </div>
                    <div className="accounting-pnl-row">
                      <span>Booking invoices</span>
                      <span>{formatCurrency(statementSummary.rentalIncome)}</span>
                    </div>
                    <div className="accounting-pnl-row accounting-negative">
                      <span>Cost of goods sold</span>
                      <span>-{formatCurrency(statementSummary.cogs)}</span>
                    </div>
                    <div className="accounting-pnl-row">
                      <span>Gross profit</span>
                      <span>{formatCurrency(statementSummary.grossProfit)}</span>
                    </div>
                    <div className="accounting-pnl-row accounting-negative">
                      <span>Operating expenses</span>
                      <span>-{formatCurrency(statementSummary.operatingExpenses)}</span>
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
                      <strong>{formatCurrency(statementSummary.netProfit)}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="accounting-muted">No reconciliation data in this window.</p>
                )}
                {hasHistoricalSalesInWindow && (
                  <p className="accounting-muted">
                    Imported historical batches add {formatCurrency(historicalSalesWindowTotal)} to revenue here, and any COGS or expense figures captured in those batches are also reflected in this margin view.
                  </p>
                )}
              </div>

              <div className="accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <h3>Money flow</h3>
                    <p className="accounting-panel-sub">{data.windowLabel || ""}</p>
                  </div>
                </div>
                {listError ? (
                  <InlineNotice tone="error" title="Activity unavailable" message={listError} compact />
                ) : listLoading && !recentLinkedRows.length ? (
                  <AnimatedLoadingState
                    compact
                    className="admin-module-loading"
                    title="Loading linked activity"
                    message="Fetching receipts, invoices, and expenses."
                    variant="dashboard"
                  />
                ) : !listLoaded ? (
                  <p className="accounting-muted">Open the Activity tab to load detailed receipts, invoices, and expenses for this window.</p>
                ) : recentLinkedRows.length === 0 ? (
                  <p className="accounting-muted">No linked activity in this window.</p>
                ) : (
                  <div className="admin-table admin-table-scroll inventory-table-scroll">
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
                                <strong>{item.number || "—"}</strong>
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
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell is-count">
                            <span className="admin-table-summary-value">
                              {listRows.length} records
                            </span>
                          </td>
                          <td className="admin-table-summary-cell is-empty" />
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
                )}
              </div>
            </section>

            <section className="accounting-panels">
              <div className="glass-card accounting-panel">
                <div className="accounting-panel-head">
                  <div>
                    <h3>Linked Totals</h3>
                    <p className="accounting-panel-sub">{data.windowLabel || ""}</p>
                  </div>
                </div>
                <div className="accounting-mini-grid">
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Receipts</p>
                    <strong className="accounting-mini-value">{formatCurrency(receiptsTotalDisplay)}</strong>
                    <span className="accounting-mini-sub">{receiptCount} Receipts</span>
                  </div>
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Invoices</p>
                    <strong className="accounting-mini-value">{formatCurrency(invoicesTotalDisplay)}</strong>
                    <span className="accounting-mini-sub">{invoiceCount} Invoices</span>
                  </div>
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Expenses</p>
                    <strong className="accounting-mini-value">{formatCurrency(expensesTotal)}</strong>
                    <span className="accounting-mini-sub">{expenseCount} entries</span>
                  </div>
                  <div className="bubble-card accounting-mini-card">
                    <p className="accounting-mini-label">Net</p>
                    <strong className="accounting-mini-value">{formatCurrency(linkedNet)}</strong>
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
                    <h3>Expenses</h3>
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
                    <h3>Balance Health</h3>
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
                    <h3>Cash Flow Trend</h3>
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
              {loading && !statementSummary ? (
                  <AnimatedLoadingState
                    compact
                    className="admin-module-loading"
                    title="Reconciling ledgers"
                    message="Calculating sales, COGS, and expense movement."
                    variant="dashboard"
                  />
                ) : error && !statementSummary ? (
                  <InlineNotice tone="error" title="Financials unavailable" message={error} compact />
                ) : statementSummary ? (
                  <div className="accounting-pnl">
                    <div className="accounting-pnl-row">
                      <span>Retail sales revenue</span>
                      <span>{formatCurrency(statementSummary.revenue)}</span>
                    </div>
                    <div className="accounting-pnl-row">
                      <span>Rental income</span>
                      <span>{formatCurrency(statementSummary.rentalIncome)}</span>
                    </div>
                    <div className="accounting-pnl-row accounting-negative">
                      <span>Cost of goods sold</span>
                      <span>-{formatCurrency(statementSummary.cogs)}</span>
                    </div>
                    <div className="accounting-pnl-row">
                      <span>Gross profit</span>
                      <span>{formatCurrency(statementSummary.grossProfit)}</span>
                    </div>
                    <div className="accounting-pnl-row accounting-negative">
                      <span>Operating expenses</span>
                      <span>-{formatCurrency(statementSummary.operatingExpenses)}</span>
                    </div>
                    <div className="accounting-pnl-row total">
                      <strong>Net profit</strong>
                      <strong>{formatCurrency(statementSummary.netProfit)}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="accounting-muted">No reconciliation data in this window.</p>
                )}
                {hasHistoricalSalesInWindow && (
                  <p className="accounting-muted">
                    Imported historical batches of {formatCurrency(historicalSalesWindowTotal)} are included in this profit statement using the sales, COGS, and expense summaries captured in Imports.
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
                <h3 className="accounting-kpi-value">{formatCurrency(receiptsTotalDisplay)}</h3>
                <p className="accounting-kpi-sub">{receiptCount} Receipts</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Invoices</p>
                <h3 className="accounting-kpi-value">{formatCurrency(invoicesTotalDisplay)}</h3>
                <p className="accounting-kpi-sub">{invoiceCount} Invoices</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Expenses</p>
                <h3 className="accounting-kpi-value">{formatCurrency(expensesTotal)}</h3>
                <p className="accounting-kpi-sub">{expenseCount} entries</p>
              </div>
              <div className="bubble-card accounting-kpi-card">
                <p className="accounting-kpi-label">Net</p>
                <h3 className="accounting-kpi-value">{formatCurrency(linkedNet)}</h3>
                <p className="accounting-kpi-sub">{data.windowLabel || ""}</p>
              </div>
            </section>

            <section className="admin-table admin-table-scroll inventory-table-scroll accounting-table-shell">
              <div className="accounting-table-title">
                <h3>Linked activity</h3>
                <span>{data.windowLabel || ""}</span>
              </div>
              {listError && <InlineNotice tone="error" title="Activity unavailable" message={listError} compact />}
              {listLoading ? (
                <AnimatedLoadingState
                  compact
                  className="admin-module-loading"
                  title="Loading linked activity"
                  message="Fetching receipts, invoices, and expenses."
                  variant="dashboard"
                />
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
                              <strong>{row.number}</strong>
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
                            <span className="admin-table-summary-value">{listRows.length}</span>
                          </td>
                          <td className="admin-table-summary-cell is-empty" />
                          <td className="admin-table-summary-cell is-empty" />
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
                  ? "Historical imports are included in taxable sales and VAT, and any imported COGS or expense summaries also flow into the profit-based tax view."
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
                <SelectField
                  fieldClassName="accounting-field"
                  label="Corporate tax category"
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
                <label className="accounting-field">
                  Corporate tax rate
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ghanaTaxConfig.corporateRate}
                    onChange={updateGhanaTax("corporateRate")}
                  />
                </label>
                <SelectField
                  fieldClassName="accounting-field"
                  label="GSL category"
                  value={ghanaTaxConfig.gslCategory}
                  onChange={updateGhanaTax("gslCategory")}
                >
                  <option value="none">Not applicable</option>
                  <option value="categoryA">Category A · 5% of PBT</option>
                  <option value="categoryBGold">Category B (gold) · 3% gross production</option>
                  <option value="categoryBOther">Category B (other) · 1% gross production</option>
                  <option value="categoryC">Category C · 2.5% of PBT</option>
                </SelectField>
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

        {/* ── Chart of Accounts view ──────────────────────────────────────────── */}
        {viewMode === "coa" && (
          <section className="accounting-panels accounting-panels-stack">
            <div className="glass-card accounting-panel">
              <div className="accounting-panel-head">
                <div>
                  <p className="accounting-panel-label">Double-entry accounting</p>
                  <h3>Chart of accounts</h3>
                  <p className="accounting-panel-sub">{coaAccounts.length} accounts · system accounts are locked</p>
                </div>
                <div className="accounting-panel-actions">
                  <button type="button" className="accounting-secondary" onClick={fetchCoa} disabled={coaLoading}>
                    {coaLoading ? "Loading…" : "Refresh"}
                  </button>
                  <button type="button" className="accounting-secondary" onClick={() => setCoaShowForm((p) => !p)}>
                    {coaShowForm ? "Cancel" : "Add account"}
                  </button>
                </div>
              </div>

              {coaShowForm && (
                <div style={{ marginBottom: "1rem", padding: "0.9rem", background: "var(--admin-surface,#f8fafc)", borderRadius: "0.75rem" }}>
                  <div className="accounting-form-grid" style={{ marginBottom: "0.75rem" }}>
                    <label className="accounting-field">
                      Account code
                      <input type="text" value={coaNewForm.accountCode}
                        onChange={(e) => setCoaNewForm((p) => ({ ...p, accountCode: e.target.value }))} />
                    </label>
                    <label className="accounting-field">
                      Account name
                      <input type="text" value={coaNewForm.accountName}
                        onChange={(e) => setCoaNewForm((p) => ({ ...p, accountName: e.target.value }))} />
                    </label>
                    <SelectField
                      fieldClassName="accounting-field"
                      label="Type"
                      value={coaNewForm.accountType}
                      onChange={(e) => {
                        const t = e.target.value;
                        setCoaNewForm((p) => ({ ...p, accountType: t, normalBalance: NORMAL_BALANCE_FOR[t] || "DEBIT" }));
                      }}
                    >
                        {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </SelectField>
                    <SelectField
                      fieldClassName="accounting-field"
                      label="Normal balance"
                      value={coaNewForm.normalBalance}
                      onChange={(e) => setCoaNewForm((p) => ({ ...p, normalBalance: e.target.value }))}
                    >
                        <option value="DEBIT">DEBIT</option>
                        <option value="CREDIT">CREDIT</option>
                    </SelectField>
                  </div>
                  {coaFormError && <InlineNotice tone="error" title="Error" message={coaFormError} compact />}
                  <button type="button" className="accounting-secondary" onClick={createCoaAccount} disabled={coaFormSaving}>
                    {coaFormSaving ? "Creating…" : "Create account"}
                  </button>
                </div>
              )}

              {coaError && <InlineNotice tone="error" title="Error" message={coaError} compact />}

              {coaLoading && !coaAccounts.length ? (
                <AnimatedLoadingState
                  compact
                  className="admin-module-loading"
                  title="Loading accounts"
                  message="Fetching chart of accounts."
                  variant="dashboard"
                />
              ) : (
                ACCOUNT_TYPES.map((type) => {
                  const group = coaAccounts.filter((a) => a.accountType === type);
                  if (!group.length) return null;
                  return (
                    <div key={type} style={{ marginBottom: "1.25rem" }}>
                      <p style={{ fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 0.5rem", opacity: 0.7 }}>
                        {TYPE_LABELS[type]}
                      </p>
                      <div className="accounting-table-shell admin-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: "5rem" }}>Code</th>
                              <th>Name</th>
                              <th>Normal</th>
                              <th style={{ width: "4rem" }}>System</th>
                              <th style={{ width: "5rem" }}>Active</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.map((acct) => (
                              <tr key={acct.id} style={{ opacity: acct.isActive ? 1 : 0.5 }}>
                                <td style={{ fontFamily: "monospace" }}>{acct.accountCode}</td>
                                <td>{acct.accountName}</td>
                                <td style={{ fontSize: "0.8em" }}>{acct.normalBalance}</td>
                                <td style={{ fontSize: "0.8em" }}>{acct.isSystemAccount ? "Yes" : "—"}</td>
                                <td>
                                  {acct.isSystemAccount ? (
                                    <span style={{ fontSize: "0.8em", opacity: 0.5 }}>Locked</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="accounting-secondary"
                                      style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}
                                      onClick={() => toggleCoaActive(acct)}
                                    >
                                      {acct.isActive ? "Deactivate" : "Activate"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ── Journals view ───────────────────────────────────────────────────── */}
        {viewMode === "journals" && (
          <section className="accounting-panels accounting-panels-stack">
            <div className="glass-card accounting-panel">
              <div className="accounting-panel-head">
                <div>
                  <p className="accounting-panel-label">Double-entry accounting</p>
                  <h3>Journal entries</h3>
                  <p className="accounting-panel-sub">{journals.length} journals loaded</p>
                </div>
                <div className="accounting-panel-actions">
                  <SelectField
                    fieldClassName="accounting-filter-field"
                    ariaLabel="Journal status"
                    value={journalsFilter}
                    onChange={(e) => setJournalsFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="draft">Draft</option>
                    <option value="posted">Posted</option>
                  </SelectField>
                  <button type="button" className="accounting-secondary" onClick={fetchJournals} disabled={journalsLoading}>
                    {journalsLoading ? "Loading…" : "Refresh"}
                  </button>
                </div>
              </div>

              {journalsError && <InlineNotice tone="error" title="Error" message={journalsError} compact />}

              {journalsLoading && !journals.length ? (
                <AnimatedLoadingState
                  compact
                  className="admin-module-loading"
                  title="Loading journals"
                  message="Fetching journal entries."
                  variant="dashboard"
                />
              ) : (
                <div className="accounting-table-shell admin-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: "7rem" }}>Date</th>
                        <th>Reference</th>
                        <th>Description</th>
                        <th style={{ width: "5rem" }}>Status</th>
                        <th style={{ width: "5rem" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journals
                        .filter((j) => journalsFilter === "all" || (journalsFilter === "draft" ? !j.isPosted : j.isPosted))
                        .map((j) => (
                          <React.Fragment key={j.id}>
                            <tr
                              style={{ cursor: "pointer", opacity: j.isReversed ? 0.5 : 1 }}
                              onClick={() => toggleJournalExpand(j.id)}
                            >
                              <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{formatDate(j.date)}</td>
                              <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{j.reference}</td>
                              <td style={{ fontSize: "0.9em", color: "var(--admin-muted,#64748b)" }}>{j.description || "—"}</td>
                              <td>
                                <span style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  color: j.isPosted ? "var(--success,#16a34a)" : "var(--admin-muted,#64748b)"
                                }}>
                                  {j.isReversed ? "Reversed" : j.isPosted ? "Posted" : "Draft"}
                                </span>
                              </td>
                              <td>
                                {!j.isPosted && (
                                  <button
                                    type="button"
                                    className="accounting-secondary"
                                    style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}
                                    onClick={(e) => { e.stopPropagation(); postJournal(j.id); }}
                                    disabled={journalPosting === j.id}
                                  >
                                    {journalPosting === j.id ? "Posting…" : "Post"}
                                  </button>
                                )}
                              </td>
                            </tr>
                            {expandedJournalId === j.id && (
                              <tr>
                                <td colSpan={5} style={{ padding: "0 0.5rem 0.75rem", background: "var(--admin-surface,#f8fafc)" }}>
                                  {journalDetailCache[j.id] ? (
                                    <table style={{ width: "100%", fontSize: "0.85em" }}>
                                      <thead>
                                        <tr>
                                          <th>Account</th>
                                          <th>Description</th>
                                          <th style={{ textAlign: "right" }}>Debit</th>
                                          <th style={{ textAlign: "right" }}>Credit</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {journalDetailCache[j.id].map((line) => (
                                          <tr key={line.id}>
                                            <td style={{ fontFamily: "monospace" }}>{line.accountCode} {line.accountName}</td>
                                            <td>{line.description || "—"}</td>
                                            <td style={{ textAlign: "right" }}>{line.debit ? fmtPesewas(line.debit) : "—"}</td>
                                            <td style={{ textAlign: "right" }}>{line.credit ? fmtPesewas(line.credit) : "—"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <AnimatedLoadingState
                                      compact
                                      className="admin-module-loading"
                                      title="Loading lines"
                                      message="Fetching journal line detail."
                                      variant="detail"
                                    />
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Historical Imports view ─────────────────────────────────────────── */}
        {viewMode === "import" && (
          <section className="accounting-panels accounting-panels-stack">
            <div className="glass-card accounting-panel">
              <div className="accounting-panel-head">
                <div>
                  <p className="accounting-panel-label">Double-entry accounting</p>
                  <h3>Historical imports</h3>
                  <p className="accounting-panel-sub">
                    Build monthly historical batches here. These batches now drive both historical reporting carry-over and the accounting journals for backfilled periods.
                  </p>
                </div>
                <div className="accounting-panel-actions">
                  <button type="button" className="accounting-secondary" onClick={fetchImportBatches} disabled={importLoading}>
                    {importLoading ? "Loading…" : "Refresh"}
                  </button>
                  <button
                    type="button"
                    className="accounting-secondary"
                    onClick={() => {
                      setImportFormError("");
                      setImportShowForm((prev) => !prev);
                    }}
                  >
                    {importShowForm ? "Cancel" : "New import batch"}
                  </button>
                </div>
              </div>

              {importShowForm && (
                <div
                  style={{
                    marginBottom: "1rem",
                    padding: "1rem",
                    background: "var(--admin-surface,#f8fafc)",
                    border: "1px solid var(--admin-border,#e2e8f0)",
                    borderRadius: "1rem",
                  }}
                >
                  <div style={{ marginBottom: "0.85rem" }}>
                    <h4 style={{ margin: 0 }}>Create historical batch</h4>
                    <p className="accounting-muted" style={{ margin: "0.35rem 0 0" }}>
                      This is now the single historical backfill workflow. If you record any VAT payment, include the actual GRA payment date so the remittance journal is created too.
                    </p>
                  </div>

                  <div className="accounting-form-grid" style={{ marginBottom: "0.85rem" }}>
                    <SelectField
                      fieldClassName="accounting-field"
                      label="Year"
                      value={String(importForm.year)}
                      onChange={updateImportField("year")}
                    >
                      {HISTORICAL_INPUT_YEARS.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      fieldClassName="accounting-field"
                      label="Month"
                      value={String(importForm.month)}
                      onChange={updateImportField("month")}
                    >
                      {MANUAL_SALES_MONTHS.map((month, index) => (
                        <option key={month.key} value={index + 1}>
                          {month.label}
                        </option>
                      ))}
                    </SelectField>
                    <label className="accounting-field">
                      Gross sales
                      <input type="number" inputMode="decimal" value={importForm.grossSales} onChange={updateImportField("grossSales")} />
                    </label>
                    <label className="accounting-field">
                      Retail split
                      <input type="number" inputMode="decimal" value={importForm.retailSplit} onChange={updateImportField("retailSplit")} />
                    </label>
                    <label className="accounting-field">
                      Rental split
                      <input type="number" inputMode="decimal" value={importForm.rentalSplit} onChange={updateImportField("rentalSplit")} />
                    </label>
                    <label className="accounting-field">
                      Cash received
                      <input type="number" inputMode="decimal" value={importForm.cashReceived} onChange={updateImportField("cashReceived")} />
                    </label>
                    <label className="accounting-field">
                      Accounts receivable
                      <input type="number" inputMode="decimal" value={importForm.arOutstanding} onChange={updateImportField("arOutstanding")} />
                    </label>
                    <label className="accounting-field">
                      VAT paid to GRA
                      <input type="number" inputMode="decimal" value={importForm.vatPayablePaid} onChange={updateImportField("vatPayablePaid")} />
                    </label>
                    <DateField
                      fieldClassName="accounting-field"
                      label="GRA payment date"
                      value={importForm.graPaymentDate}
                      onChange={updateImportField("graPaymentDate")}
                    />
                    <label className="accounting-field">
                      COGS
                      <input type="number" inputMode="decimal" value={importForm.cogsPesewas} onChange={updateImportField("cogsPesewas")} />
                    </label>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0 }}>Expense lines</h4>
                      <p className="accounting-muted" style={{ margin: "0.35rem 0 0" }}>
                        Add only the operating expenses that should be journaled into this month.
                      </p>
                    </div>
                    <button type="button" className="accounting-secondary" onClick={addImportExpenseLine}>
                      Add line
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    {importForm.expenseLines.map((line, index) => (
                      <div
                        key={`import-expense-${index}`}
                        style={{
                          padding: "0.85rem",
                          border: "1px solid var(--admin-border,#e2e8f0)",
                          borderRadius: "0.9rem",
                          background: "rgba(255,255,255,0.55)",
                        }}
                      >
                        <div className="accounting-form-grid">
                          <label className="accounting-field">
                            Account code
                            <input
                              type="text"
                              value={line.accountCode}
                              onChange={updateImportExpenseLine(index, "accountCode")}
                            />
                          </label>
                          <label className="accounting-field">
                            Description
                            <input
                              type="text"
                              value={line.description}
                              onChange={updateImportExpenseLine(index, "description")}
                            />
                          </label>
                          <label className="accounting-field">
                            Amount
                            <input
                              type="number"
                              inputMode="decimal"
                              value={line.amountPesewas}
                              onChange={updateImportExpenseLine(index, "amountPesewas")}
                            />
                          </label>
                          <div className="accounting-field" style={{ display: "flex", alignItems: "end" }}>
                            <button
                              type="button"
                              className="accounting-secondary"
                              onClick={() => removeImportExpenseLine(index)}
                              disabled={importForm.expenseLines.length === 1}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {importFormError && (
                    <div style={{ marginTop: "0.85rem" }}>
                      <InlineNotice tone="error" title="Import error" message={importFormError} compact />
                    </div>
                  )}

                  <div className="accounting-panel-actions" style={{ marginTop: "1rem" }}>
                    <button
                      type="button"
                      className="accounting-secondary"
                      onClick={submitImportBatch}
                      disabled={importFormSaving}
                    >
                      {importFormSaving ? "Creating…" : "Create draft batch"}
                    </button>
                  </div>
                </div>
              )}

              {importError && <InlineNotice tone="error" title="Error" message={importError} compact />}

              {importLoading && !importBatches.length ? (
                <AnimatedLoadingState
                  compact
                  className="admin-module-loading"
                  title="Loading historical batches"
                  message="Fetching imported sales and reconciliation rows."
                  variant="dashboard"
                />
              ) : importBatches.length ? (
                <div className="acct-import-grid">
                  {importBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className={`acct-import-cell ${batch.isPosted ? "acct-import-cell--posted" : "acct-import-cell--draft"}`}
                    >
                      <div className="acct-import-cell-label">{batch.batchName}</div>
                      <div className="acct-import-cell-status">
                        {batch.isPosted ? "Posted" : "Draft"} · {Number(batch.journalCount || 0)} journals
                      </div>
                      <div className="accounting-muted">
                        {formatDate(batch.periodStart)} to {formatDate(batch.periodEnd)}
                      </div>
                      <div className="accounting-muted">
                        {batch.postedAt ? `Posted ${formatDate(batch.postedAt)}` : "Ready for review and posting"}
                      </div>
                      <div className="acct-import-cell-actions">
                        {!batch.isPosted && (
                          <button
                            type="button"
                            className="accounting-secondary"
                            onClick={() => postImportBatch(batch.id)}
                            disabled={importPostingId === batch.id || importDeletingId === batch.id}
                          >
                            {importPostingId === batch.id ? "Posting…" : "Post"}
                          </button>
                        )}
                        {!batch.isPosted && (
                          <button
                            type="button"
                            className="accounting-secondary"
                            onClick={() => deleteImportBatch(batch.id)}
                            disabled={importDeletingId === batch.id || importPostingId === batch.id}
                          >
                            {importDeletingId === batch.id ? "Deleting…" : "Delete"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="accounting-muted">No historical import batches yet. Create one to backfill accounting history.</p>
              )}
            </div>
          </section>
        )}

        {/* ── Trial Balance view ──────────────────────────────────────────────── */}
        {viewMode === "trialBalance" && (
          <section className="accounting-panels accounting-panels-stack">
            <div className="glass-card accounting-panel">
              <div className="accounting-panel-head">
                <div>
                  <p className="accounting-panel-label">Double-entry accounting</p>
                  <h3>Trial balance</h3>
                  <p className="accounting-panel-sub">All posted journal entries up to and including the selected date.</p>
                </div>
                <div className="accounting-panel-actions">
                  <DateField
                    fieldClassName="accounting-field accounting-filter-field"
                    label="As at date"
                    value={tbAsOf}
                    onChange={(e) => setTbAsOf(e.target.value)}
                  />
                  <button type="button" className="accounting-secondary" onClick={() => fetchTrialBalance(tbAsOf)} disabled={tbLoading}>
                    {tbLoading ? "Loading…" : "Load"}
                  </button>
                </div>
              </div>

              {tbError && <InlineNotice tone="error" title="Error" message={tbError} compact />}

              {tbLoading && !trialBalance ? (
                <AnimatedLoadingState
                  compact
                  className="admin-module-loading"
                  title="Loading trial balance"
                  message="Calculating account balances."
                  variant="dashboard"
                />
              ) : trialBalance ? (
                <>
                  <div
                    className={`accounting-balance-check ${trialBalance.isBalanced ? "is-balanced" : "is-off"}`}
                    style={{ marginBottom: "1rem" }}
                  >
                    {trialBalance.isBalanced
                      ? `Balanced as at ${trialBalance.asOf} · Total debits = Total credits = ${fmtPesewas(trialBalance.grandDebit)}`
                      : `NOT BALANCED as at ${trialBalance.asOf} · Debits ${fmtPesewas(trialBalance.grandDebit)} vs Credits ${fmtPesewas(trialBalance.grandCredit)}`}
                  </div>

                  {Object.entries(trialBalance.byType || {}).map(([type, group]) => (
                    <div key={type} style={{ marginBottom: "1.25rem" }}>
                      <p style={{ fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 0.5rem", opacity: 0.7 }}>
                        {TYPE_LABELS[type] || type}
                      </p>
                      <div className="accounting-table-shell admin-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: "5rem" }}>Code</th>
                              <th>Account</th>
                              <th style={{ textAlign: "right" }}>Debit</th>
                              <th style={{ textAlign: "right" }}>Credit</th>
                              <th style={{ textAlign: "right" }}>Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(group.accounts || []).map((acct) => (
                              <tr key={acct.id} style={{ opacity: acct.totalDebit || acct.totalCredit ? 1 : 0.4 }}>
                                <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{acct.accountCode}</td>
                                <td>{acct.accountName}</td>
                                <td style={{ textAlign: "right" }}>{acct.totalDebit ? fmtPesewas(acct.totalDebit) : "—"}</td>
                                <td style={{ textAlign: "right" }}>{acct.totalCredit ? fmtPesewas(acct.totalCredit) : "—"}</td>
                                <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtPesewas(acct.netBalance)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ fontWeight: 700, borderTop: "2px solid var(--admin-border,#e2e8f0)" }}>
                              <td colSpan={2}>{TYPE_LABELS[type] || type} total</td>
                              <td style={{ textAlign: "right" }}>{fmtPesewas(group.totalDebit)}</td>
                              <td style={{ textAlign: "right" }}>{fmtPesewas(group.totalCredit)}</td>
                              <td style={{ textAlign: "right" }}>{fmtPesewas(group.netBalance)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ))}

                  <div className="accounting-pnl" style={{ marginTop: "1rem" }}>
                    <div className="accounting-pnl-row total">
                      <strong>Grand total debits</strong>
                      <strong>{fmtPesewas(trialBalance.grandDebit)}</strong>
                    </div>
                    <div className="accounting-pnl-row total">
                      <strong>Grand total credits</strong>
                      <strong>{fmtPesewas(trialBalance.grandCredit)}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <p className="accounting-muted">Select a date and click Load to view the trial balance.</p>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

export default AdminAccounting;
