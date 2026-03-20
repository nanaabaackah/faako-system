/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import "./AdminExpenses.css";
import { AppIcon } from "/src/components/Icon/Icon";
import { faPlus, faReceipt } from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import { useAuth } from "../../components/AuthContext/AuthContext";
import {
  EXPENSE_CATEGORY_LABELS,
  getExpenseSpecificOptions,
  getExpenseCategoryStyle,
  normalizeExpenseCategory,
} from "../../data/expenseCategories";

const DEFAULT_EXPENSE_CATEGORY = "Operational";

const formatCurrency = (amount) => {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch (err) {
    return `GHS ${Number(amount || 0).toFixed(2)}`;
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

const formatMonthLabel = (monthKey) => {
  if (!monthKey) return "All time";
  const date = new Date(`${monthKey}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Selected period";
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeExpense = (expense) => ({
  ...expense,
  category: normalizeExpenseCategory(expense?.category) || "Operational",
});

const formatExpenseLink = (expense) => {
  const parts = [];
  if (expense?.orderId) parts.push(`Order #${expense.orderId}`);
  if (expense?.bookingId) parts.push(`Booking #${expense.bookingId}`);
  return parts.length ? parts.join(" · ") : "-";
};

function AdminExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [allTimeView, setAllTimeView] = useState(false);
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({
    category: DEFAULT_EXPENSE_CATEGORY,
    specificType: "",
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    orderId: "",
    bookingId: "",
  });

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const fetchLinks = async () => {
    try {
      const [ordersRes, bookingsRes] = await Promise.all([
        fetch("/.netlify/functions/orders"),
        fetch("/.netlify/functions/bookings"),
      ]);
      const [ordersData, bookingsData] = await Promise.all([
        ordersRes.ok ? ordersRes.json() : [],
        bookingsRes.ok ? bookingsRes.json() : [],
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
    } catch (err) {
      console.warn("Expense link fetch failed", err);
      setOrders([]);
      setBookings([]);
    }
  };

  const fetchExpenses = async ({ month = monthFilter, allTime = allTimeView } = {}) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (!allTime && month) {
        params.set("month", `${month}-01`);
      }
      const query = params.toString();
      const res = await fetch(`/.netlify/functions/expenses${query ? `?${query}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load expenses.");
      setExpenses(Array.isArray(data) ? data.map(normalizeExpense) : []);
    } catch (err) {
      console.error("Expenses fetch failed", err);
      setError(err.message || "Unable to load expenses.");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const seedExpenses = async () => {
    setSeeding(true);
    setStatus("");
    setError("");
    try {
      const res = await fetch("/.netlify/functions/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to seed expenses.");
      if (data?.seeded) {
        setStatus("Sample expenses loaded.");
        await fetchExpenses({ month: monthFilter, allTime: allTimeView });
      } else {
        setStatus("Expenses already exist in the database.");
      }
    } catch (err) {
      console.error("Expense seed failed", err);
      setError(err.message || "Unable to seed expenses.");
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  useEffect(() => {
    fetchExpenses({ month: monthFilter, allTime: allTimeView });
  }, [monthFilter, allTimeView]);

  const categoryList = EXPENSE_CATEGORY_LABELS;

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, expense) => sum + toNumber(expense.amount) / 100, 0),
    [expenses]
  );

  const linkedExpenseCount = useMemo(
    () => expenses.filter((expense) => expense?.orderId || expense?.bookingId).length,
    [expenses]
  );

  const averageExpense = useMemo(
    () => (expenses.length ? totalExpenses / expenses.length : 0),
    [expenses.length, totalExpenses]
  );

  const totalsByCategory = useMemo(() => {
    return categoryList.reduce((acc, category) => {
      const total = expenses
        .filter((item) => normalizeExpenseCategory(item.category) === category)
        .reduce((sum, item) => sum + toNumber(item.amount) / 100, 0);
      acc[category] = total;
      return acc;
    }, {});
  }, [categoryList, expenses]);

  const periodLabel = useMemo(
    () => (allTimeView ? "All time" : formatMonthLabel(monthFilter)),
    [allTimeView, monthFilter]
  );

  const topCategory = useMemo(() => {
    if (!expenses.length || !categoryList.length) return null;
    let winner = null;
    for (const category of categoryList) {
      const total = toNumber(totalsByCategory[category], 0);
      if (!winner || total > winner.total) {
        winner = { category, total };
      }
    }
    return winner?.total > 0 ? winner : null;
  }, [categoryList, expenses.length, totalsByCategory]);

  const specificOptions = useMemo(
    () => getExpenseSpecificOptions(form.category),
    [form.category]
  );
  const requiresSpecificOption = specificOptions.length > 0;
  const specificFieldLabel = form.category
    ? `Specific ${String(form.category).toLowerCase()} item`
    : "Specific item";

  const updateCategory = (event) => {
    const nextCategory = event.target.value;
    const nextOptions = getExpenseSpecificOptions(nextCategory);
    setForm((prev) => ({
      ...prev,
      category: nextCategory,
      specificType: nextOptions.includes(prev.specificType) ? prev.specificType : "",
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (requiresSpecificOption && !form.specificType) {
      setStatus("");
      setError("Select the specific item before saving.");
      return;
    }

    setSaving(true);
    setStatus("");
    setError("");
    const description = String(form.description || "").trim();
    const finalDescription = requiresSpecificOption
      ? `${form.specificType}: ${description}`
      : description;

    try {
      const res = await fetch("/.netlify/functions/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          amount: form.amount,
          description: finalDescription,
          date: form.date,
          orderId: form.orderId || undefined,
          bookingId: form.bookingId || undefined,
          userId: user?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to log expense.");
      const normalizedRow = normalizeExpense(data);
      setExpenses((prev) => [normalizedRow, ...prev]);
      if (data?.categoryAutoDetected) {
        setStatus(`Expense logged. Category auto-detected as ${normalizedRow.category}.`);
      } else {
        setStatus("Expense logged.");
      }
      setForm((prev) => ({
        ...prev,
        category: DEFAULT_EXPENSE_CATEGORY,
        specificType: "",
        amount: "",
        description: "",
        orderId: "",
        bookingId: "",
      }));
    } catch (err) {
      console.error("Expense save failed", err);
      setError(err.message || "Unable to save expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="expenses-page expenses-page--redesign">
      <div className="expenses-shell expenses-shell--redesign">
        <AdminBreadcrumb items={[{ label: "Expenses" }]} />

        <header className="expenses-header">
          <div>
            <p className="expenses-eyebrow">Operating Expenses</p>
            <h1>Expense Tracker</h1>
            <p className="expenses-subtitle">
              Keep every expense inside the fixed company categories so reporting stays clean and accounting totals stay consistent.
            </p>
          </div>
          <div className="expenses-total-card">
            <p className="expenses-card-label">Total in view</p>
            <h3>{formatCurrency(totalExpenses)}</h3>
            <p>{periodLabel}</p>
          </div>
        </header>

        <section className="expenses-overview" aria-label="Expense summary">
          <article className="expenses-overview-metric">
            <p className="expenses-card-label">Entries</p>
            <strong>{expenses.length}</strong>
            <span>{periodLabel}</span>
          </article>
          <article className="expenses-overview-metric">
            <p className="expenses-card-label">Linked</p>
            <strong>{linkedExpenseCount}</strong>
            <span>{Math.max(expenses.length - linkedExpenseCount, 0)} unlinked</span>
          </article>
          <article className="expenses-overview-metric">
            <p className="expenses-card-label">Average spend</p>
            <strong>{formatCurrency(averageExpense)}</strong>
            <span>Per recorded expense</span>
          </article>
          <article className="expenses-overview-metric">
            <p className="expenses-card-label">Top category</p>
            <strong>{topCategory?.category || "None yet"}</strong>
            <span>{formatCurrency(topCategory?.total || 0)}</span>
          </article>
        </section>

        <div className="expenses-filter-rail">
          <div className="expenses-filters">
            <label>
              Posting period
              <input
                type="month"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                disabled={allTimeView}
              />
            </label>
            <label className="expenses-check">
              <input
                type="checkbox"
                checked={allTimeView}
                onChange={(event) => setAllTimeView(event.target.checked)}
              />
              Show all time
            </label>
          </div>
          <p className="expenses-filter-note">
            Only utilities, logistics, operational, staff salary, maintenance, and marketing are tracked here.
          </p>
        </div>

        {error && <p className="expenses-error">{error}</p>}
        {status && <p className="expenses-success">{status}</p>}

        <section className="expenses-kpis-wrap" aria-label="Category totals">
          <div className="expenses-kpis-head">
            <p className="expenses-card-label">Category spread</p>
            <span>{categoryList.length} categories in view</span>
          </div>
          <div className="expenses-kpis">
            {categoryList.map((category) => (
              <div key={category} className="expenses-kpi">
                <span className="expenses-tag" style={getExpenseCategoryStyle(category)}>
                  {category}
                </span>
                <strong>{formatCurrency(totalsByCategory[category] || 0)}</strong>
              </div>
            ))}
          </div>
        </section>

        <div className="expenses-grid">
          <section className="expenses-card">
            <div className="expenses-card-head">
              <h2>
                <AppIcon icon={faPlus} /> Log expense
              </h2>
              <p className="expenses-muted">Choose one of the six approved categories, then pick the specific item for cleaner reporting.</p>
            </div>
            <form className="expenses-form" onSubmit={handleSubmit}>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={updateCategory}
                >
                  {EXPENSE_CATEGORY_LABELS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              {requiresSpecificOption && (
                <label>
                  {specificFieldLabel}
                  <select
                    value={form.specificType}
                    onChange={(event) => setForm((prev) => ({ ...prev, specificType: event.target.value }))}
                    required
                  >
                    <option value="">Select item</option>
                    {specificOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Amount (GHS)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  required
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                  required
                />
              </label>
              <div className="expenses-inline">
                <label>
                  Link order (optional)
                  <select
                    value={form.orderId}
                    onChange={(event) => setForm((prev) => ({ ...prev, orderId: event.target.value }))}
                  >
                    <option value="">Select order</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {`${formatDate(order.orderDate)} - Order #${order.id} - ${order.customerName || "-"}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Link booking (optional)
                  <select
                    value={form.bookingId}
                    onChange={(event) => setForm((prev) => ({ ...prev, bookingId: event.target.value }))}
                  >
                    <option value="">Select booking</option>
                    {bookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {`${formatDate(booking.eventDate)} - Booking #${booking.id} - ${
                          booking.customerName || "-"
                        }`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Description
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder={requiresSpecificOption ? "Enter vendor, pay period, campaign note, or any extra note" : "Fuel for delivery to East Legon"}
                  required
                />
              </label>
              <button type="submit" className="expenses-primary" disabled={saving}>
                {saving ? "Saving..." : "Save expense"}
              </button>
            </form>
          </section>

          <section className="admin-table expenses-ledger">
            <div className="admin-table-header">
              <div>
                <p className="expenses-card-label">Expense ledger</p>
                <h3>
                  <AppIcon icon={faReceipt} /> Expense ledger
                </h3>
                <span>{expenses.length} records</span>
              </div>
              <div className="expenses-actions">
                <button
                  type="button"
                  className="expenses-secondary"
                  onClick={() => fetchExpenses({ month: monthFilter, allTime: allTimeView })}
                >
                  Refresh
                </button>
                {expenses.length === 0 && !loading && (
                  <button
                    type="button"
                    className="expenses-secondary"
                    onClick={seedExpenses}
                    disabled={seeding}
                  >
                    {seeding ? "Seeding..." : "Load demo data"}
                  </button>
                )}
              </div>
            </div>
            <div className="admin-table-scroll">
              <table className="expenses-ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Linked</th>
                    <th>Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="expenses-empty">
                        Loading expenses...
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="expenses-empty">
                        No expenses logged yet.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td data-label="Date">{formatDate(expense.date)}</td>
                        <td data-label="Category">
                          <span className="expenses-tag" style={getExpenseCategoryStyle(expense.category)}>
                            {expense.category}
                          </span>
                        </td>
                        <td data-label="Linked">{formatExpenseLink(expense)}</td>
                        <td data-label="Amount">{formatCurrency(toNumber(expense.amount) / 100)}</td>
                        <td data-label="Notes">{expense.description || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default AdminExpenses;
