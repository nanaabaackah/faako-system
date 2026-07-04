import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  HiOutlineCalendar,
  HiOutlineCash,
  HiOutlineCreditCard,
  HiOutlineExclamation,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSave,
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
  type AccountingExpenseCreatePayload,
  type AccountingExpenseEntry,
  type AccountingExpenseFilters,
  type AccountingExpensesResponse,
} from "../api/adminAccounting";
import "../styles/accounting-management.css";

const EXPENSE_PAGE_SIZE = 12;

const EXPENSE_CLASS_OPTIONS = [
  { value: "sales", label: "Sales expense" },
  { value: "operations", label: "Operations" },
  { value: "inventory", label: "Inventory and suppliers" },
  { value: "delivery", label: "Delivery and logistics" },
  { value: "marketing", label: "Marketing" },
  { value: "tax", label: "Tax and compliance" },
  { value: "payroll", label: "Payroll and contractors" },
  { value: "rent", label: "Rent and utilities" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All payment states" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid liability" },
];

const PERIOD_OPTIONS: Array<{ value: AccountingExpenseFilters["period"]; label: string }> = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
];

const EMPTY_EXPENSES: AccountingExpensesResponse = {
  range: { period: "90d" },
  expenses: [],
  summary: {
    paidTotal: 0,
    unpaidTotal: 0,
    overdueTotal: 0,
    exposureTotal: 0,
    totalCount: 0,
    nextDueDate: "",
  },
  breakdown: [],
};

const getTodayValue = () => new Date().toISOString().slice(0, 10);

const createEmptyExpenseDraft = (): AccountingExpenseCreatePayload => ({
  expenseClass: "operations",
  category: "Operations",
  counterparty: "",
  description: "",
  amount: "",
  currency: "GHS",
  expenseDate: getTodayValue(),
  dueDate: "",
  paymentStatus: "paid",
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

const formatDate = (value?: string) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatLabel = (value = "") =>
  value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Not set";

const isOverdueExpense = (expense: AccountingExpenseEntry) => {
  if (expense.paymentStatus !== "unpaid" || !expense.dueDate) return false;
  const dueDate = new Date(expense.dueDate);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate < new Date(new Date().toDateString());
};

const getExpenseTone = (
  expense: Pick<AccountingExpenseEntry, "paymentStatus" | "dueDate">
): "neutral" | "success" | "warning" | "danger" | "info" => {
  if (isOverdueExpense(expense as AccountingExpenseEntry)) return "danger";
  if (expense.paymentStatus === "unpaid") return "warning";
  if (expense.paymentStatus === "paid") return "success";
  return "neutral";
};

const ExpenseManagement: React.FC = () => {
  const { session } = useAdminPortal();
  const canManageAccounting =
    hasPortalPermission(session, "accounting", "create") ||
    hasPortalPermission(session, "accounting", "edit") ||
    hasPortalPermission(session, "accounting", "delete") ||
    hasPortalPermission(session, "accounting", "archive") ||
    hasPortalPermission(session, "accounting", "manage");
  const [data, setData] = useState<AccountingExpensesResponse>(EMPTY_EXPENSES);
  const [filters, setFilters] = useState<AccountingExpenseFilters>({
    period: "90d",
    status: "all",
    expenseClass: "all",
    from: "",
    to: "",
    limit: 300,
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState<AccountingExpenseCreatePayload>(
    createEmptyExpenseDraft
  );
  const [savingExpense, setSavingExpense] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useSEOMeta({
    title: "Expenses | Stroane operations",
    description: "Record paid expenses and unpaid expense liabilities for Stroane accounting.",
    canonical: portalUrl("/admin/expenses"),
    noIndex: true,
  });

  const pageCount = Math.max(1, Math.ceil(data.expenses.length / EXPENSE_PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedExpenses = useMemo(
    () =>
      data.expenses.slice(
        clampedPageIndex * EXPENSE_PAGE_SIZE,
        clampedPageIndex * EXPENSE_PAGE_SIZE + EXPENSE_PAGE_SIZE
      ),
    [clampedPageIndex, data.expenses]
  );
  const selectedClassLabel =
    EXPENSE_CLASS_OPTIONS.find((option) => option.value === expenseDraft.expenseClass)?.label ||
    "Expense";

  const loadExpenses = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const nextData = await adminAccountingApi.listExpenses(session, {
        ...filters,
        expenseClass: filters.expenseClass === "all" ? "" : filters.expenseClass,
        status: filters.status === "all" ? "" : filters.status,
        from: filters.period === "custom" ? filters.from : "",
        to: filters.period === "custom" ? filters.to : "",
      });
      setData(nextData);
      setPageIndex(0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load expenses.");
    } finally {
      setLoading(false);
    }
  }, [filters, session]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const updateFilter = <Key extends keyof AccountingExpenseFilters>(
    key: Key,
    value: AccountingExpenseFilters[Key]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const updateExpenseDraft = <Key extends keyof AccountingExpenseCreatePayload>(
    key: Key,
    value: AccountingExpenseCreatePayload[Key]
  ) => {
    setExpenseDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "expenseClass") {
        next.category =
          EXPENSE_CLASS_OPTIONS.find((option) => option.value === value)?.label || "Other";
      }
      if (key === "paymentStatus" && value === "paid") next.dueDate = "";
      return next;
    });
  };

  const handleSaveExpense = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    if (!expenseDraft.description.trim()) {
      setError("Add a short expense description.");
      return;
    }
    if (!expenseDraft.category.trim()) {
      setError("Add an expense category.");
      return;
    }
    const amount = Number(expenseDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an expense amount greater than zero.");
      return;
    }
    if (expenseDraft.paymentStatus === "unpaid" && !expenseDraft.dueDate) {
      setError("Choose a due date for unpaid expenses.");
      return;
    }

    setSavingExpense(true);
    setNotice("");
    setError("");
    try {
      await adminAccountingApi.createExpense(session, {
        ...expenseDraft,
        amount,
      });
      setExpenseDraft(createEmptyExpenseDraft());
      setExpenseOpen(false);
      setNotice(
        expenseDraft.paymentStatus === "unpaid"
          ? "Expense liability recorded."
          : "Paid expense recorded."
      );
      await loadExpenses();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save expense.");
    } finally {
      setSavingExpense(false);
    }
  };

  return (
    <div className="stroane-accounting stroane-expenses">
      <header className="stroane-accounting__head">
        <div>
          <span>Expense hub</span>
          <h1>Expenses and liabilities</h1>
          <p>
            Record sales, operational, supplier, tax, delivery, and other expenses. Paid expenses
            reduce profit in Accounting, while unpaid expenses become visible liabilities.
          </p>
        </div>
        <div className="stroane-accounting__head-actions">
          <ERPSecondaryAction
            type="button"
            icon={<HiOutlineRefresh />}
            onClick={() => void loadExpenses()}
            disabled={loading}
          >
            Refresh
          </ERPSecondaryAction>
          <ERPPrimaryAction
            type="button"
            icon={<HiOutlinePlus />}
            onClick={() => setExpenseOpen(true)}
            disabled={!canManageAccounting}
          >
            Record expense
          </ERPPrimaryAction>
        </div>
      </header>

      {!canManageAccounting ? (
        <ERPFormNotice tone="warning" title="View-only access">
          This account can review expenses but cannot record new expenses.
        </ERPFormNotice>
      ) : null}

      {data.summary.unpaidTotal > 0 ? (
        <ERPFormNotice tone="warning" title="Liability watch">
          {formatMoney(data.summary.unpaidTotal)} is currently marked unpaid
          {data.summary.nextDueDate ? `; next due date is ${formatDate(data.summary.nextDueDate)}.` : "."}
        </ERPFormNotice>
      ) : null}

      {notice ? (
        <ERPFormNotice tone="success" title="Expense update" onDismiss={() => setNotice("")}>
          {notice}
        </ERPFormNotice>
      ) : null}

      {error ? (
        <ERPFormNotice tone="danger" title="Expense action" onDismiss={() => setError("")}>
          {error}
        </ERPFormNotice>
      ) : null}

      <section className="stroane-accounting__filters" aria-label="Expense filters">
        <SelectField
          label="Reporting period"
          value={filters.period || "90d"}
          onChangeValue={(value) =>
            updateFilter("period", getSelectValue(value) as AccountingExpenseFilters["period"])
          }
          options={PERIOD_OPTIONS}
        />
        <SelectField
          label="Payment state"
          value={filters.status || "all"}
          onChangeValue={(value) =>
            updateFilter("status", getSelectValue(value) as AccountingExpenseFilters["status"])
          }
          options={STATUS_OPTIONS}
        />
        <SelectField
          label="Expense class"
          value={filters.expenseClass || "all"}
          onChangeValue={(value) => updateFilter("expenseClass", getSelectValue(value))}
          options={[{ value: "all", label: "All classes" }, ...EXPENSE_CLASS_OPTIONS]}
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
      </section>

      <section className="stroane-accounting__kpis" aria-label="Expense KPIs">
        <article className="bubble-card" data-tone="warning">
          <HiOutlineCreditCard aria-hidden="true" />
          <span>Total exposure</span>
          <strong>{formatMoney(data.summary.exposureTotal)}</strong>
          <small>Paid expenses plus unpaid expense liabilities.</small>
        </article>
        <article className="bubble-card" data-tone="success">
          <HiOutlineCash aria-hidden="true" />
          <span>Paid expenses</span>
          <strong>{formatMoney(data.summary.paidTotal)}</strong>
          <small>Already included against net profit.</small>
        </article>
        <article className="bubble-card" data-tone={data.summary.overdueTotal > 0 ? "warning" : "info"}>
          <HiOutlineExclamation aria-hidden="true" />
          <span>Unpaid liabilities</span>
          <strong>{formatMoney(data.summary.unpaidTotal)}</strong>
          <small>{formatMoney(data.summary.overdueTotal)} overdue.</small>
        </article>
        <article className="bubble-card" data-tone="info">
          <HiOutlineCalendar aria-hidden="true" />
          <span>Next due</span>
          <strong>{formatDate(data.summary.nextDueDate)}</strong>
          <small>{data.summary.totalCount} expenses in this view.</small>
        </article>
      </section>

      <section className="stroane-accounting__split">
        <article className="glass-card stroane-accounting__position">
          <div className="stroane-accounting__section-head">
            <span>Expense mix</span>
            <h2>By class</h2>
          </div>
          <div className="stroane-accounting__mini-table">
            {data.breakdown.length ? (
              data.breakdown.map((item) => (
                <div key={item.expenseClass}>
                  <span>{item.label}</span>
                  <strong>{formatMoney(item.total)}</strong>
                  <small>
                    Paid {formatMoney(item.paidTotal)} · Unpaid {formatMoney(item.unpaidTotal)}
                  </small>
                </div>
              ))
            ) : (
              <p>No expenses recorded for this view.</p>
            )}
          </div>
        </article>

        <article className="glass-card stroane-accounting__position">
          <div className="stroane-accounting__section-head">
            <span>Client view</span>
            <h2>What this means</h2>
          </div>
          <dl>
            <div>
              <dt>Paid expenses</dt>
              <dd>Money already spent and counted against profit.</dd>
            </div>
            <div>
              <dt>Unpaid liabilities</dt>
              <dd>Amounts the business still expects to pay.</dd>
            </div>
            <div className="is-strong">
              <dt>Expense exposure</dt>
              <dd>Paid spend plus unpaid obligations for this reporting period.</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="stroane-accounting__table-panel">
        <div className="stroane-accounting__section-head">
          <span>Expense ledger</span>
          <h2>Recorded expenses</h2>
        </div>
        <div className="stroane-accounting__admin-table admin-table admin-table-scroll">
          <ERPTablePagination
            className="stroane-accounting__pagination"
            pageIndex={clampedPageIndex}
            pageCount={pageCount}
            pageSize={EXPENSE_PAGE_SIZE}
            totalItems={data.expenses.length}
            itemLabel="expenses"
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
                <th>State</th>
                <th className="col-desktop">Expense</th>
                <th className="col-desktop">Class</th>
                <th className="col-desktop">Amount</th>
                <th className="col-desktop">Due</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="stroane-accounting__table-empty">
                    Loading expenses...
                  </td>
                </tr>
              ) : null}
              {!loading && !data.expenses.length ? (
                <tr>
                  <td colSpan={7} className="stroane-accounting__table-empty">
                    No expenses match this view.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? paginatedExpenses.map((expense, index) => (
                    <tr key={expense.id}>
                      <td className="portal-table-number-cell" data-label="#">
                        {clampedPageIndex * EXPENSE_PAGE_SIZE + index + 1}
                      </td>
                      <td data-label="Date">{formatDate(expense.entryDate)}</td>
                      <td data-label="State">
                        <ERPStatusBadge tone={getExpenseTone(expense)}>
                          {isOverdueExpense(expense)
                            ? "Overdue"
                            : formatLabel(expense.paymentStatus)}
                        </ERPStatusBadge>
                      </td>
                      <td className="col-desktop" data-label="Expense">
                        <span className="stroane-accounting__transaction-cell">
                          <strong>{expense.description}</strong>
                          <small>{expense.counterparty || expense.reference || "No payee recorded"}</small>
                        </span>
                      </td>
                      <td className="col-desktop" data-label="Class">{expense.expenseClassLabel}</td>
                      <td className="col-desktop" data-label="Amount">
                        {formatMoney(expense.amount, expense.currency)}
                      </td>
                      <td className="col-desktop" data-label="Due">{formatDate(expense.dueDate)}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
          <ERPTablePagination
            className="stroane-accounting__pagination"
            pageIndex={clampedPageIndex}
            pageCount={pageCount}
            pageSize={EXPENSE_PAGE_SIZE}
            totalItems={data.expenses.length}
            itemLabel="expenses"
            onPageChange={setPageIndex}
          />
        </div>
      </section>

      <ERPModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Record expense"
        description="Capture paid expenses or unpaid obligations so Accounting can calculate profit and liabilities."
        className="stroane-accounting__modal"
      >
        <form className="stroane-accounting__entry-form" onSubmit={handleSaveExpense}>
          <div className="stroane-accounting__form-grid">
            <SelectField
              label="Expense class"
              value={expenseDraft.expenseClass}
              onChangeValue={(value) => updateExpenseDraft("expenseClass", getSelectValue(value))}
              options={EXPENSE_CLASS_OPTIONS}
              disabled={!canManageAccounting}
            />
            <SelectField
              label="Payment state"
              value={expenseDraft.paymentStatus}
              onChangeValue={(value) =>
                updateExpenseDraft(
                  "paymentStatus",
                  getSelectValue(value) as AccountingExpenseCreatePayload["paymentStatus"]
                )
              }
              options={STATUS_OPTIONS.filter((option) => option.value !== "all")}
              disabled={!canManageAccounting}
            />
            <ERPTextField
              label="Category"
              value={expenseDraft.category}
              helperText={selectedClassLabel}
              onChange={(event) => updateExpenseDraft("category", event.target.value)}
              disabled={!canManageAccounting}
              required
            />
            <ERPTextField
              label="Payee or supplier"
              value={expenseDraft.counterparty || ""}
              onChange={(event) => updateExpenseDraft("counterparty", event.target.value)}
              disabled={!canManageAccounting}
            />
            <ERPTextField
              label="Description"
              value={expenseDraft.description}
              onChange={(event) => updateExpenseDraft("description", event.target.value)}
              disabled={!canManageAccounting}
              required
            />
            <ERPTextField
              label="Amount"
              type="number"
              min="0.01"
              step="0.01"
              value={expenseDraft.amount}
              onChange={(event) => updateExpenseDraft("amount", event.target.value)}
              disabled={!canManageAccounting}
              required
            />
            <ERPTextField
              label="Currency"
              value={expenseDraft.currency || "GHS"}
              maxLength={3}
              onChange={(event) =>
                updateExpenseDraft("currency", event.target.value.toUpperCase())
              }
              disabled={!canManageAccounting}
            />
            <DateField
              label="Expense date"
              value={expenseDraft.expenseDate}
              onChangeValue={(value) => updateExpenseDraft("expenseDate", value)}
              disabled={!canManageAccounting}
              required
            />
            {expenseDraft.paymentStatus === "unpaid" ? (
              <DateField
                label="Due date"
                value={expenseDraft.dueDate || ""}
                onChangeValue={(value) => updateExpenseDraft("dueDate", value)}
                disabled={!canManageAccounting}
                required
              />
            ) : null}
            <ERPTextField
              label="Reference"
              value={expenseDraft.reference || ""}
              onChange={(event) => updateExpenseDraft("reference", event.target.value)}
              disabled={!canManageAccounting}
            />
          </div>
          <ERPTextareaField
            label="Internal notes"
            value={expenseDraft.notes || ""}
            rows={3}
            onChange={(event) => updateExpenseDraft("notes", event.target.value)}
            disabled={!canManageAccounting}
          />
          <div className="stroane-accounting__modal-actions">
            <ERPSecondaryAction type="button" onClick={() => setExpenseOpen(false)}>
              Cancel
            </ERPSecondaryAction>
            <ERPPrimaryAction
              type="submit"
              icon={<HiOutlineSave />}
              loading={savingExpense}
              disabled={!canManageAccounting}
            >
              Save expense
            </ERPPrimaryAction>
          </div>
        </form>
      </ERPModal>
    </div>
  );
};

export default ExpenseManagement;
