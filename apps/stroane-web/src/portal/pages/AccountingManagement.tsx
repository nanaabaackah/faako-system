import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  HiOutlineCash,
  HiOutlineChartBar,
  HiOutlineClipboardList,
  HiOutlineCreditCard,
  HiOutlineCube,
  HiOutlineDownload,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSave,
  HiOutlineShoppingBag,
} from "react-icons/hi";
import {
  DateField,
  ERPFormNotice,
  ERPModal,
  ERPPrimaryAction,
  ERPSecondaryAction,
  ERPStatusBadge,
  ERPTablePagination,
  ERPTextareaField,
  ERPTextField,
  SelectField,
} from "@faako/ui";
import { portalUrl } from "../../config/appSurface";
import useSEOMeta from "../../hooks/useSEOMeta";
import { hasPortalPermission } from "../api/adminSession";
import { useAdminPortal } from "../context/AdminPortalContext";
import {
  adminAccountingApi,
  type AccountingEntryCreatePayload,
  type AccountingEntryType,
  type AccountingLedgerEntry,
  type AccountingOverview,
  type AccountingOverviewFilters,
  type AccountingTransaction,
} from "../api/adminAccounting";
import "../styles/accounting-management.css";

const ACCOUNTING_PAGE_SIZE = 12;

const EMPTY_OVERVIEW: AccountingOverview = {
  range: { period: "90d" },
  summary: {
    currency: "GHS",
    revenue: 0,
    orderRevenue: 0,
    manualIncome: 0,
    expenses: 0,
    costOfGoodsSold: 0,
    grossProfit: 0,
    netProfit: 0,
    cashEstimate: 0,
    receivables: 0,
    stockRetailValue: 0,
    stockCostValue: 0,
    assetTotal: 0,
    liabilityTotal: 0,
    equity: 0,
    netPosition: 0,
    receiptValue: 0,
    collectionRate: 0,
    grossMargin: 0,
    receiptCoverage: 0,
    averageOrderValue: 0,
    paidOrderCount: 0,
    outstandingOrderCount: 0,
    receiptCount: 0,
    manualEntryCount: 0,
    stockPricedItemCount: 0,
    stockCostedItemCount: 0,
    ordersWithKnownCost: 0,
  },
  categoryBreakdown: [],
  series: [],
  transactions: [],
  manualEntries: [],
  notices: [],
};

const PERIOD_OPTIONS = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
];

const ENTRY_TYPE_OPTIONS: Array<{ value: AccountingEntryType; label: string }> = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "asset", label: "Asset opening balance" },
  { value: "liability", label: "Liability opening balance" },
  { value: "equity", label: "Owner equity" },
  { value: "adjustment", label: "Adjustment" },
];

const CATEGORY_SUGGESTIONS: Record<AccountingEntryType, string[]> = {
  income: ["Historical sales", "Service income", "Other income"],
  expense: ["Purchases", "Delivery", "Packaging", "Marketing", "Operations"],
  asset: ["Bank balance", "Cash on hand", "Inventory opening value"],
  liability: ["Supplier payable", "Loan", "Tax payable"],
  equity: ["Owner contribution", "Retained earnings"],
  adjustment: ["Correction", "Reconciliation"],
};

const getTodayValue = () => new Date().toISOString().slice(0, 10);

const createEmptyEntryDraft = (): AccountingEntryCreatePayload => ({
  entryType: "income",
  category: "Historical sales",
  description: "",
  amount: "",
  currency: "GHS",
  entryDate: getTodayValue(),
  source: "manual_lump_sum",
  reference: "",
  notes: "",
});

const getSelectValue = (value: string | string[]) =>
  Array.isArray(value) ? value[0] || "" : value;

const formatMoney = (value: number, currency = "GHS") =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0)}%`;

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

const formatLabel = (value = "") =>
  value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ||
  "Not set";

const getEntryTone = (type = ""): "neutral" | "success" | "warning" | "danger" | "info" => {
  if (type === "income" || type === "asset" || type === "equity") return "success";
  if (type === "expense" || type === "liability") return "warning";
  if (type === "adjustment") return "info";
  return "neutral";
};

const escapeCsvValue = (value: unknown) => {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const buildCsv = (rows: Array<Array<unknown>>) =>
  rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const downloadTextFile = (filename: string, body: string, type: string) => {
  if (typeof document === "undefined") return;
  const blob = new Blob([body], { type });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const buildSummaryRows = (overview: AccountingOverview) => {
  const { summary } = overview;
  return [
    ["Metric", "Value", "Plain English"],
    ["Revenue", summary.revenue, "Paid order revenue plus manual income entries."],
    ["Expenses", summary.expenses, "Manual expense entries entered into accounting."],
    ["Gross profit", summary.grossProfit, "Revenue minus known product cost."],
    ["Net profit", summary.netProfit, "Gross profit minus expenses and adjustments."],
    ["Cash estimate", summary.cashEstimate, "Collected money minus manual expenses."],
    ["Receivables", summary.receivables, "Orders still not marked as paid."],
    ["Inventory value at cost", summary.stockCostValue, "Stock value where supplier cost is known."],
    ["Inventory value at retail", summary.stockRetailValue, "Stock value using selling prices."],
    ["Assets", summary.assetTotal, "Cash estimate, receivables, inventory, and manual assets."],
    ["Liabilities", summary.liabilityTotal, "Manual liability entries."],
    ["Net position", summary.netPosition, "Assets minus liabilities plus owner equity."],
  ];
};

const buildTransactionRows = (transactions: AccountingTransaction[]) => [
  ["Date", "Source", "Type", "Category", "Description", "Reference", "Amount", "Currency", "Status"],
  ...transactions.map((transaction) => [
    formatDate(transaction.date),
    transaction.source,
    transaction.type,
    transaction.category,
    transaction.description,
    transaction.reference || "",
    transaction.amount,
    transaction.currency,
    transaction.status || "",
  ]),
];

const buildEntryRows = (entries: AccountingLedgerEntry[]) => [
  ["Date", "Type", "Category", "Description", "Reference", "Amount", "Currency", "Notes"],
  ...entries.map((entry) => [
    formatDate(entry.entryDate),
    entry.entryType,
    entry.category,
    entry.description,
    entry.reference || "",
    entry.amount,
    entry.currency,
    entry.notes || "",
  ]),
];

const buildExcelHtml = (overview: AccountingOverview) => {
  const renderTable = (title: string, rows: Array<Array<unknown>>) => `
    <h2>${escapeHtml(title)}</h2>
    <table>
      <tbody>
        ${rows
          .map(
            (row, index) => `
              <tr>
                ${row
                  .map((cell) =>
                    index === 0
                      ? `<th>${escapeHtml(cell)}</th>`
                      : `<td>${escapeHtml(cell)}</td>`
                  )
                  .join("")}
              </tr>`
          )
          .join("")}
      </tbody>
    </table>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Stroane accounting export</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111827}
      h1{font-size:24px}
      h2{margin-top:24px;font-size:16px}
      table{border-collapse:collapse;margin-bottom:16px}
      th,td{border:1px solid #d1d5db;padding:8px;text-align:left}
      th{background:#f3f4f6}
    </style>
  </head>
  <body>
    <h1>Stroane accounting export</h1>
    ${renderTable("Summary", buildSummaryRows(overview))}
    ${renderTable("Transactions", buildTransactionRows(overview.transactions))}
    ${renderTable("Manual entries", buildEntryRows(overview.manualEntries))}
  </body>
</html>`;
};

const AccountingManagement: React.FC = () => {
  const { session } = useAdminPortal();
  const canManageAccounting =
    hasPortalPermission(session, "accounting", "create") ||
    hasPortalPermission(session, "accounting", "edit") ||
    hasPortalPermission(session, "accounting", "delete") ||
    hasPortalPermission(session, "accounting", "archive") ||
    hasPortalPermission(session, "accounting", "manage");
  const [overview, setOverview] = useState<AccountingOverview>(EMPTY_OVERVIEW);
  const [filters, setFilters] = useState<AccountingOverviewFilters>({
    period: "90d",
    from: "",
    to: "",
    limit: 500,
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryDraft, setEntryDraft] = useState<AccountingEntryCreatePayload>(createEmptyEntryDraft);
  const [savingEntry, setSavingEntry] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useSEOMeta({
    title: "Accounting | Stroane operations",
    description: "Private accounting analytics, exports, and historical finance entries.",
    canonical: portalUrl("/admin/accounting"),
    noIndex: true,
  });

  const pageCount = Math.max(1, Math.ceil(overview.transactions.length / ACCOUNTING_PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedTransactions = useMemo(
    () =>
      overview.transactions.slice(
        clampedPageIndex * ACCOUNTING_PAGE_SIZE,
        clampedPageIndex * ACCOUNTING_PAGE_SIZE + ACCOUNTING_PAGE_SIZE
      ),
    [clampedPageIndex, overview.transactions]
  );

  const categoryHint = useMemo(
    () => `Suggestions: ${CATEGORY_SUGGESTIONS[entryDraft.entryType].join(", ")}`,
    [entryDraft.entryType]
  );

  const loadOverview = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const data = await adminAccountingApi.getOverview(session, {
        ...filters,
        from: filters.period === "custom" ? filters.from : "",
        to: filters.period === "custom" ? filters.to : "",
      });
      setOverview(data);
      setPageIndex(0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load accounting.");
    } finally {
      setLoading(false);
    }
  }, [filters, session]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const updateFilter = <Key extends keyof AccountingOverviewFilters>(
    key: Key,
    value: AccountingOverviewFilters[Key]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const updateEntryDraft = <Key extends keyof AccountingEntryCreatePayload>(
    key: Key,
    value: AccountingEntryCreatePayload[Key]
  ) => {
    setEntryDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "entryType") {
        const nextType = value as AccountingEntryType;
        next.category = CATEGORY_SUGGESTIONS[nextType]?.[0] || "";
      }
      return next;
    });
  };

  const handleSaveEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    if (!entryDraft.description.trim()) {
      setError("Add a short description for this accounting entry.");
      return;
    }
    if (!entryDraft.category.trim()) {
      setError("Add a category for this accounting entry.");
      return;
    }
    const amount = Number(entryDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setSavingEntry(true);
    setNotice("");
    setError("");
    try {
      await adminAccountingApi.createEntry(session, {
        ...entryDraft,
        amount,
      });
      setEntryDraft(createEmptyEntryDraft());
      setEntryOpen(false);
      setNotice("Accounting entry saved.");
      await loadOverview();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save accounting entry.");
    } finally {
      setSavingEntry(false);
    }
  };

  const handleExportSummaryCsv = () => {
    downloadTextFile(
      "stroane-accounting-summary.csv",
      buildCsv(buildSummaryRows(overview)),
      "text/csv;charset=utf-8"
    );
  };

  const handleExportTransactionsCsv = () => {
    downloadTextFile(
      "stroane-accounting-transactions.csv",
      buildCsv(buildTransactionRows(overview.transactions)),
      "text/csv;charset=utf-8"
    );
  };

  const handleExportExcel = () => {
    downloadTextFile(
      "stroane-accounting-export.xls",
      buildExcelHtml(overview),
      "application/vnd.ms-excel;charset=utf-8"
    );
  };

  return (
    <div className="stroane-accounting">
      <header className="stroane-accounting__head">
        <div>
          <span>Accounting hub</span>
          <h1>Accounting and analytics</h1>
          <p>
            Track revenue, receivables, stock value, expenses, historical balances, and the
            numbers that explain the business position in plain language.
          </p>
        </div>
        <div className="stroane-accounting__head-actions">
          <ERPSecondaryAction
            type="button"
            icon={<HiOutlineRefresh />}
            onClick={() => void loadOverview()}
            disabled={loading}
          >
            Refresh
          </ERPSecondaryAction>
          <ERPPrimaryAction
            type="button"
            icon={<HiOutlinePlus />}
            onClick={() => setEntryOpen(true)}
            disabled={!canManageAccounting}
          >
            Add historical entry
          </ERPPrimaryAction>
        </div>
      </header>

      {!canManageAccounting ? (
        <ERPFormNotice tone="warning" title="View-only access">
          This account can review accounting analytics but cannot add historical entries.
        </ERPFormNotice>
      ) : null}

      {notice ? (
        <ERPFormNotice tone="success" title="Accounting update" onDismiss={() => setNotice("")}>
          {notice}
        </ERPFormNotice>
      ) : null}

      {error ? (
        <ERPFormNotice tone="danger" title="Accounting action" onDismiss={() => setError("")}>
          {error}
        </ERPFormNotice>
      ) : null}

      {overview.notices.map((item) => (
        <ERPFormNotice key={item} tone="warning" title="Setup notice">
          {item}
        </ERPFormNotice>
      ))}

      <section className="stroane-accounting__filters" aria-label="Accounting filters">
        <SelectField
          label="Reporting period"
          value={filters.period || "90d"}
          onChangeValue={(value) => updateFilter("period", getSelectValue(value) as AccountingOverviewFilters["period"])}
          options={PERIOD_OPTIONS}
        />
        {filters.period === "custom" ? (
          <>
            <DateField
              label="From"
              value={filters.from || ""}
              onChangeValue={(value) => updateFilter("from", value)}
            />
            <DateField
              label="To"
              value={filters.to || ""}
              onChangeValue={(value) => updateFilter("to", value)}
            />
          </>
        ) : null}
        <div className="stroane-accounting__export-actions" aria-label="Accounting exports">
          <ERPSecondaryAction type="button" icon={<HiOutlineDownload />} onClick={handleExportSummaryCsv}>
            Summary CSV
          </ERPSecondaryAction>
          <ERPSecondaryAction type="button" icon={<HiOutlineDownload />} onClick={handleExportTransactionsCsv}>
            Transactions CSV
          </ERPSecondaryAction>
          <ERPSecondaryAction type="button" icon={<HiOutlineDownload />} onClick={handleExportExcel}>
            Excel
          </ERPSecondaryAction>
        </div>
      </section>

      <section className="stroane-accounting__kpis" aria-label="Accounting KPIs">
        <article className="bubble-card" data-tone="success">
          <HiOutlineCash aria-hidden="true" />
          <span>Cash estimate</span>
          <strong>{formatMoney(overview.summary.cashEstimate, overview.summary.currency)}</strong>
          <small>Collected money less recorded expenses.</small>
        </article>
        <article className="bubble-card" data-tone="info">
          <HiOutlineShoppingBag aria-hidden="true" />
          <span>Revenue</span>
          <strong>{formatMoney(overview.summary.revenue, overview.summary.currency)}</strong>
          <small>{overview.summary.paidOrderCount} paid orders included.</small>
        </article>
        <article className="bubble-card" data-tone={overview.summary.netProfit >= 0 ? "success" : "warning"}>
          <HiOutlineChartBar aria-hidden="true" />
          <span>Net profit</span>
          <strong>{formatMoney(overview.summary.netProfit, overview.summary.currency)}</strong>
          <small>After known costs, expenses, and adjustments.</small>
        </article>
        <article className="bubble-card" data-tone="warning">
          <HiOutlineCreditCard aria-hidden="true" />
          <span>Receivables</span>
          <strong>{formatMoney(overview.summary.receivables, overview.summary.currency)}</strong>
          <small>{overview.summary.outstandingOrderCount} orders not yet paid.</small>
        </article>
        <article className="bubble-card" data-tone="info">
          <HiOutlineCube aria-hidden="true" />
          <span>Stock value</span>
          <strong>{formatMoney(overview.summary.stockCostValue || overview.summary.stockRetailValue, overview.summary.currency)}</strong>
          <small>
            {overview.summary.stockCostedItemCount
              ? "At known supplier cost."
              : "Using retail value until costs are added."}
          </small>
        </article>
        <article className="bubble-card" data-tone="success">
          <HiOutlineClipboardList aria-hidden="true" />
          <span>Collection rate</span>
          <strong>{formatPercent(overview.summary.collectionRate)}</strong>
          <small>{formatPercent(overview.summary.receiptCoverage)} receipt coverage.</small>
        </article>
      </section>

      <section className="stroane-accounting__insights">
        <article className="glass-card stroane-accounting__position">
          <div className="stroane-accounting__section-head">
            <span>Financial position</span>
            <h2>Where the business stands</h2>
          </div>
          <dl>
            <div>
              <dt>Assets</dt>
              <dd>{formatMoney(overview.summary.assetTotal, overview.summary.currency)}</dd>
            </div>
            <div>
              <dt>Liabilities</dt>
              <dd>{formatMoney(overview.summary.liabilityTotal, overview.summary.currency)}</dd>
            </div>
            <div>
              <dt>Owner equity</dt>
              <dd>{formatMoney(overview.summary.equity, overview.summary.currency)}</dd>
            </div>
            <div className="is-strong">
              <dt>Net position</dt>
              <dd>{formatMoney(overview.summary.netPosition, overview.summary.currency)}</dd>
            </div>
          </dl>
        </article>

        <article className="glass-card stroane-accounting__position">
          <div className="stroane-accounting__section-head">
            <span>Operating health</span>
            <h2>Useful ratios</h2>
          </div>
          <dl>
            <div>
              <dt>Average paid order</dt>
              <dd>{formatMoney(overview.summary.averageOrderValue, overview.summary.currency)}</dd>
            </div>
            <div>
              <dt>Gross margin</dt>
              <dd>
                {overview.summary.grossMargin
                  ? formatPercent(overview.summary.grossMargin)
                  : "Add supplier costs"}
              </dd>
            </div>
            <div>
              <dt>Known cost orders</dt>
              <dd>{overview.summary.ordersWithKnownCost}</dd>
            </div>
            <div>
              <dt>Manual entries</dt>
              <dd>{overview.summary.manualEntryCount}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="stroane-accounting__split">
        <article className="glass-card stroane-accounting__position">
          <div className="stroane-accounting__section-head">
            <span>Trends</span>
            <h2>Monthly movement</h2>
          </div>
          <div className="stroane-accounting__mini-table">
            {overview.series.length ? (
              overview.series.map((point) => (
                <div key={point.period}>
                  <span>{point.period}</span>
                  <strong>{formatMoney(point.net, overview.summary.currency)}</strong>
                  <small>
                    Revenue {formatMoney(point.revenue, overview.summary.currency)} · Expenses{" "}
                    {formatMoney(point.expenses, overview.summary.currency)}
                  </small>
                </div>
              ))
            ) : (
              <p>No movement recorded for this period.</p>
            )}
          </div>
        </article>

        <article className="glass-card stroane-accounting__position">
          <div className="stroane-accounting__section-head">
            <span>Categories</span>
            <h2>Largest movements</h2>
          </div>
          <div className="stroane-accounting__mini-table">
            {overview.categoryBreakdown.length ? (
              overview.categoryBreakdown.slice(0, 8).map((item) => (
                <div key={item.category}>
                  <span>{item.category}</span>
                  <strong>{formatMoney(item.amount, overview.summary.currency)}</strong>
                </div>
              ))
            ) : (
              <p>No categories recorded yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="stroane-accounting__table-panel">
        <div className="stroane-accounting__section-head">
          <span>Ledger view</span>
          <h2>Transactions</h2>
        </div>
        <div className="stroane-accounting__admin-table admin-table admin-table-scroll">
          <ERPTablePagination
            className="stroane-accounting__pagination"
            pageIndex={clampedPageIndex}
            pageCount={pageCount}
            pageSize={ACCOUNTING_PAGE_SIZE}
            totalItems={overview.transactions.length}
            itemLabel="transactions"
            onPageChange={setPageIndex}
          />
          <table className="stroane-accounting__table">
            <colgroup>
              <col className="stroane-accounting__col-number" />
              <col className="stroane-accounting__col-date" />
              <col className="stroane-accounting__col-type" />
              <col className="stroane-accounting__col-description" />
              <col className="stroane-accounting__col-category" />
              <col className="stroane-accounting__col-amount" />
              <col className="stroane-accounting__col-status" />
            </colgroup>
            <thead>
              <tr>
                <th className="portal-table-number-cell">#</th>
                <th>Date</th>
                <th>Type</th>
                <th className="col-desktop">Description</th>
                <th className="col-desktop">Category</th>
                <th className="col-desktop">Amount</th>
                <th className="col-desktop">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="stroane-accounting__table-empty">
                    Loading accounting...
                  </td>
                </tr>
              ) : null}
              {!loading && !overview.transactions.length ? (
                <tr>
                  <td colSpan={7} className="stroane-accounting__table-empty">
                    No accounting movement is available for this period.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? paginatedTransactions.map((transaction, index) => (
                    <tr key={transaction.id}>
                      <td className="portal-table-number-cell" data-label="#">
                        {clampedPageIndex * ACCOUNTING_PAGE_SIZE + index + 1}
                      </td>
                      <td data-label="Date">{formatDate(transaction.date)}</td>
                      <td data-label="Type">
                        <ERPStatusBadge tone={getEntryTone(transaction.type)}>
                          {formatLabel(transaction.type)}
                        </ERPStatusBadge>
                      </td>
                      <td className="col-desktop" data-label="Description">
                        <span className="stroane-accounting__transaction-cell">
                          <strong>{transaction.label}</strong>
                          <small>{transaction.description}</small>
                        </span>
                      </td>
                      <td className="col-desktop" data-label="Category">{transaction.category}</td>
                      <td className="col-desktop" data-label="Amount">
                        {formatMoney(transaction.amount, transaction.currency)}
                      </td>
                      <td className="col-desktop" data-label="Status">{formatLabel(transaction.status || "recorded")}</td>
                    </tr>
                  ))
                : null}
            </tbody>
            {overview.transactions.length ? (
              <tfoot className="admin-table-footer">
                <tr>
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell">
                    <span className="admin-table-summary-value">
                      {formatMoney(overview.summary.revenue - overview.summary.expenses, overview.summary.currency)}
                    </span>
                  </td>
                  <td className="admin-table-summary-cell is-empty" />
                </tr>
              </tfoot>
            ) : null}
          </table>
          <ERPTablePagination
            className="stroane-accounting__pagination"
            pageIndex={clampedPageIndex}
            pageCount={pageCount}
            pageSize={ACCOUNTING_PAGE_SIZE}
            totalItems={overview.transactions.length}
            itemLabel="transactions"
            onPageChange={setPageIndex}
          />
        </div>
      </section>

      <ERPModal
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        title="Add historical entry"
        description="Enter a lump sum from before the portal started tracking accounting automatically."
        className="stroane-accounting__modal"
      >
        <form className="stroane-accounting__entry-form" onSubmit={handleSaveEntry}>
          <div className="stroane-accounting__form-grid">
            <SelectField
              label="Entry type"
              value={entryDraft.entryType}
              onChangeValue={(value) =>
                updateEntryDraft("entryType", getSelectValue(value) as AccountingEntryType)
              }
              options={ENTRY_TYPE_OPTIONS}
              disabled={!canManageAccounting}
            />
            <ERPTextField
              label="Category"
              value={entryDraft.category}
              onChange={(event) => updateEntryDraft("category", event.target.value)}
              helperText={categoryHint}
              disabled={!canManageAccounting}
              required
            />
            <ERPTextField
              label="Description"
              value={entryDraft.description}
              onChange={(event) => updateEntryDraft("description", event.target.value)}
              disabled={!canManageAccounting}
              required
            />
            <ERPTextField
              label="Amount"
              type="number"
              min="0.01"
              step="0.01"
              value={entryDraft.amount}
              onChange={(event) => updateEntryDraft("amount", event.target.value)}
              disabled={!canManageAccounting}
              required
            />
            <ERPTextField
              label="Currency"
              value={entryDraft.currency || "GHS"}
              maxLength={3}
              onChange={(event) =>
                updateEntryDraft("currency", event.target.value.toUpperCase())
              }
              disabled={!canManageAccounting}
            />
            <DateField
              label="Accounting date"
              value={entryDraft.entryDate}
              onChangeValue={(value) => updateEntryDraft("entryDate", value)}
              disabled={!canManageAccounting}
              required
            />
            <ERPTextField
              label="Reference"
              value={entryDraft.reference || ""}
              onChange={(event) => updateEntryDraft("reference", event.target.value)}
              disabled={!canManageAccounting}
            />
          </div>
          <ERPTextareaField
            label="Internal notes"
            value={entryDraft.notes || ""}
            rows={3}
            onChange={(event) => updateEntryDraft("notes", event.target.value)}
            disabled={!canManageAccounting}
          />
          <div className="stroane-accounting__modal-actions">
            <ERPSecondaryAction type="button" onClick={() => setEntryOpen(false)}>
              Cancel
            </ERPSecondaryAction>
            <ERPPrimaryAction
              type="submit"
              icon={<HiOutlineSave />}
              loading={savingEntry}
              disabled={!canManageAccounting}
            >
              Save entry
            </ERPPrimaryAction>
          </div>
        </form>
      </ERPModal>
    </div>
  );
};

export default AccountingManagement;
