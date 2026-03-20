import React, { useEffect, useMemo, useState } from "react";
import "./AdminMarketing.css";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faTags,
  faBullhorn,
  faPaperPlane,
  faRotateRight,
  faPlus,
} from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";

const TYPE_OPTIONS = [
  { value: "PERCENTAGE", label: "% Off" },
  { value: "FIXED", label: "GHS Off" },
];

const SCOPE_OPTIONS = [
  { value: "both", label: "Retail + Rental" },
  { value: "retail", label: "Retail only" },
  { value: "rental", label: "Rentals only" },
];

const SEGMENT_OPTIONS = [
  { value: "all", label: "All customers" },
  { value: "rental clients", label: "Rental clients" },
  { value: "retail shoppers", label: "Retail shoppers" },
  { value: "top spenders", label: "Top spenders" },
  { value: "new leads", label: "New leads" },
];

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

const formatCurrency = (amount) => {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "GHS 0";
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `GHS ${num}`;
  }
};

const isExpired = (expiryDate) => {
  if (!expiryDate) return false;
  const date = new Date(expiryDate);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const isExpiringSoon = (expiryDate, days = 14) => {
  if (!expiryDate) return false;
  const date = new Date(expiryDate);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(today.getDate() + days);
  return date >= today && date <= limit;
};

const formatDiscountValue = (discount) => {
  const value = Number(discount?.value || 0);
  if (discount?.type === "FIXED") {
    return `${formatCurrency(value)} Off`;
  }
  return `${value}% Off`;
};

function AdminMarketing() {
  const [discounts, setDiscounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    code: "",
    type: "PERCENTAGE",
    value: "",
    expiryDate: "",
    minOrderValue: "",
    scope: "both",
    segment: "all",
    reward: "",
  });

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const fetchDiscounts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/.netlify/functions/marketing");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load campaigns.");
      setDiscounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Marketing fetch failed", err);
      setError(err.message || "Unable to load campaigns.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/.netlify/functions/customers");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load customers.");
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Customer segmentation load failed", err);
      setCustomers([]);
    }
  };

  useEffect(() => {
    fetchDiscounts();
    fetchCustomers();
  }, []);

  const activeCount = useMemo(
    () => discounts.filter((discount) => discount.isActive && !isExpired(discount.expiryDate)).length,
    [discounts]
  );
  const expiringSoon = useMemo(
    () => discounts.filter((discount) => discount.isActive && isExpiringSoon(discount.expiryDate)).length,
    [discounts]
  );
  const inactiveCount = useMemo(
    () => discounts.filter((discount) => !discount.isActive || isExpired(discount.expiryDate)).length,
    [discounts]
  );

  const segments = useMemo(() => {
    const totals = customers.map((customer) => ({
      ...customer,
      totalValueGhs:
        (Number(customer.total_spent || 0) + Number(customer.total_rented || 0)) / 100,
    }));
    return [
      {
        id: "rental",
        label: "Rental clients",
        count: totals.filter((row) => Number(row.bookings || 0) > 0).length,
        description: "Booked at least one rental.",
      },
      {
        id: "retail",
        label: "Retail shoppers",
        count: totals.filter((row) => Number(row.orders || 0) > 0).length,
        description: "Placed retail orders.",
      },
      {
        id: "top",
        label: "Top spenders",
        count: totals.filter((row) => row.totalValueGhs >= 1500).length,
        description: "GHS 1,500+ lifetime spend.",
      },
      {
        id: "new",
        label: "New leads",
        count: totals.filter((row) => Number(row.orders || 0) === 0 && Number(row.bookings || 0) === 0).length,
        description: "No transactions yet.",
      },
    ];
  }, [customers]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        value: Number(form.value),
        minOrderValue: form.minOrderValue === "" ? null : Number(form.minOrderValue),
      };
      const res = await fetch("/.netlify/functions/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create campaign.");
      setDiscounts((prev) => [data, ...prev]);
      setForm({
        code: "",
        type: "PERCENTAGE",
        value: "",
        expiryDate: "",
        minOrderValue: "",
        scope: "both",
        segment: "all",
        reward: "",
      });
      setStatus("Campaign created.");
    } catch (err) {
      console.error("Campaign save failed", err);
      setError(err.message || "Unable to create campaign.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (discount) => {
    setError("");
    setStatus("");
    try {
      const res = await fetch("/.netlify/functions/marketing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: discount.id, isActive: !discount.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update campaign.");
      setDiscounts((prev) => prev.map((row) => (row.id === data.id ? data : row)));
      setStatus(`Campaign ${data.isActive ? "activated" : "paused"}.`);
    } catch (err) {
      console.error("Campaign update failed", err);
      setError(err.message || "Unable to update campaign.");
    }
  };

  const seedCampaigns = async () => {
    setStatus("");
    setError("");
    try {
      const res = await fetch("/.netlify/functions/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to seed campaigns.");
      if (data?.seeded) {
        setDiscounts((prev) => [...(data.items || []), ...prev]);
        setStatus("Sample campaigns added.");
      } else {
        setStatus("Campaigns already exist.");
      }
    } catch (err) {
      console.error("Campaign seed failed", err);
      setError(err.message || "Unable to seed campaigns.");
    }
  };

  const sendBlast = (segment) => {
    alert(`Sending campaign to ${segment}.`);
  };

  return (
    <div className="admin-page marketing-page">
      <div className="admin-shell marketing-shell">
        <AdminBreadcrumb items={[{ label: "Marketing" }]} />

        <header className="admin-header marketing-header">
          <div>
            <p className="marketing-eyebrow">Revenue drivers</p>
            <h1>Marketing & Promotions</h1>
            <p className="marketing-subtitle">
              Launch coupon campaigns, segment customers, and push rental or retail promotions.
            </p>
          </div>
          <div className="marketing-actions">
            <button type="button" className="admin-secondary" onClick={seedCampaigns}>
              <AppIcon icon={faPlus} /> Seed campaigns
            </button>
            <button type="button" className="admin-secondary" onClick={fetchDiscounts}>
              <AppIcon icon={faRotateRight} /> Refresh
            </button>
          </div>
        </header>

        <section className="admin-cards marketing-kpis">
          <div className="admin-card">
            <p className="admin-card-label">Active campaigns</p>
            <h2>{activeCount}</h2>
            <span>{expiringSoon} expiring soon</span>
          </div>
          <div className="admin-card">
            <p className="admin-card-label">Inactive or expired</p>
            <h2>{inactiveCount}</h2>
            <span>Needs review</span>
          </div>
          <div className="admin-card">
            <p className="admin-card-label">Customer segments</p>
            <h2>{segments.reduce((sum, seg) => sum + seg.count, 0)}</h2>
            <span>Reachable profiles</span>
          </div>
        </section>

        {error && <p className="marketing-error">{error}</p>}
        {status && <p className="marketing-success">{status}</p>}

        <div className="marketing-grid">
          <section className="admin-card marketing-panel">
            <div className="marketing-panel-head">
              <h2>
                Create coupon
              </h2>
              <p className="marketing-muted">Build retail or rental incentives in seconds.</p>
            </div>
            <form className="marketing-form" onSubmit={handleSubmit}>
              <label>
                Code
                <input
                  type="text"
                  value={form.code}
                  placeholder="SUMMER25"
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                />
              </label>
              <div className="marketing-form-row">
                <label>
                  Type
                  <select
                    value={form.type}
                    onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Value
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.value}
                    placeholder="20"
                    onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
                  />
                </label>
              </div>
              <div className="marketing-form-row">
                <label>
                  Expiry date
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, expiryDate: event.target.value }))}
                  />
                </label>
                <label>
                  Minimum order (GHS)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.minOrderValue}
                    placeholder="150"
                    onChange={(event) => setForm((prev) => ({ ...prev, minOrderValue: event.target.value }))}
                  />
                </label>
              </div>
              <div className="marketing-form-row">
                <label>
                  Scope
                  <select
                    value={form.scope}
                    onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value }))}
                  >
                    {SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Segment
                  <select
                    value={form.segment}
                    onChange={(event) => setForm((prev) => ({ ...prev, segment: event.target.value }))}
                  >
                    {SEGMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Reward note
                <input
                  type="text"
                  value={form.reward}
                  placeholder="Free popcorn machine in January"
                  onChange={(event) => setForm((prev) => ({ ...prev, reward: event.target.value }))}
                />
              </label>
              <div className="admin-form-actions">
                <button type="submit" className="admin-primary" disabled={saving}>
                  {saving ? "Launching..." : "Launch campaign"}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-card marketing-panel marketing-table-panel">
            <div className="marketing-panel-head">
              <h2>Active campaigns</h2>
              <p className="marketing-muted">Track codes, usage, and expiry dates.</p>
            </div>
            <div className="admin-table-scroll">
              <table className="marketing-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Offer</th>
                    <th>Scope</th>
                    <th>Min order</th>
                    <th>Expires</th>
                    <th>Usage</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {!loading && discounts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="marketing-empty">
                        No campaigns yet.
                      </td>
                    </tr>
                  )}
                  {discounts.map((discount) => {
                    const expired = isExpired(discount.expiryDate);
                    const isActive = discount.isActive && !expired;
                    return (
                      <tr key={discount.id}>
                        <td>
                          <strong>{discount.code}</strong>
                          {discount.reward && <p className="marketing-reward">{discount.reward}</p>}
                        </td>
                        <td>{formatDiscountValue(discount)}</td>
                        <td>{(discount.scope || "both").toUpperCase()}</td>
                        <td>{discount.minOrderValue ? formatCurrency(discount.minOrderValue) : "-"}</td>
                        <td>{discount.expiryDate ? formatDate(discount.expiryDate) : "No expiry"}</td>
                        <td>{discount.usageCount ?? 0}</td>
                        <td>
                          <span className={`marketing-tag ${isActive ? "active" : "inactive"}`}>
                            {isActive ? "Active" : expired ? "Expired" : "Paused"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="marketing-link"
                            onClick={() => toggleActive(discount)}
                          >
                            {isActive ? "Pause" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card marketing-panel">
            <div className="marketing-panel-head">
              <h2>
                 Quick outreach
              </h2>
              <p className="marketing-muted">Send SMS or WhatsApp blasts to defined segments.</p>
            </div>
            <div className="marketing-segments">
              {segments.map((segment) => (
                <div key={segment.id} className="marketing-segment">
                  <div>
                    <h4>{segment.label}</h4>
                    <p>{segment.description}</p>
                  </div>
                  <div className="marketing-segment-meta">
                    <strong>{segment.count}</strong>
                    <button type="button" onClick={() => sendBlast(segment.label)}>
                      <AppIcon icon={faPaperPlane} /> Message
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default AdminMarketing;
