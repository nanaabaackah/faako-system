/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import "./AdminCustomers.css";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faUserPlus,
  faEnvelope,
  faPhone,
  faHistory,
  faXmark,
  faColumns,
  faTableCells,
  faClock,
  faRotateRight,
} from "/src/icons/iconSet";
import { faWhatsapp } from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import SearchField from "../../components/SearchField/SearchField";

const formatMoney = (value, currency = "GHS") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  } catch {
    return `${currency} ${Math.round(amount / 100)}`;
  }
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const sanitizePhone = (value) => String(value || "").replace(/[^\d+]/g, "");

const parseDeliveryDetails = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }
  if (typeof value === "object") return value;
  return null;
};

const getAddressLines = (value) => {
  const text = String(value || "").trim();
  if (!text) return [];
  return text
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NA";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
};

const getQuantile = (values, quantile) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.floor((sorted.length - 1) * quantile);
  return sorted[position] || 0;
};

const getLastTouch = (customer) => {
  const value = customer?.updatedAt || customer?.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDaysSince = (date) => {
  if (!date) return Infinity;
  const diff = Date.now() - date.getTime();
  return diff / (1000 * 60 * 60 * 24);
};

const SEGMENT_LABELS = {
  prospect: "Prospect",
  nurture: "Nurture",
  active: "Active",
  loyal: "Loyal",
  risk: "At risk",
};

const getSegmentLabel = (segment) => SEGMENT_LABELS[segment] || "Active";

const getNextStep = (customer) => {
  if (!customer) return "Review customer history";
  if (customer.segment === "risk") return "Follow up with a check-in";
  if (customer.segment === "prospect") return "Send welcome + pricing deck";
  if (customer.segment === "loyal") return "Offer VIP renewal";
  return "Schedule a monthly touchpoint";
};

const getTouchLabel = (customer) => {
  if (!customer?.lastTouch) return "No recent touch";
  const days = Math.max(0, Math.floor(customer.daysSince || 0));
  if (days <= 1) return "Touched today";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} since touch`;
  if (days < 30) {
    const weeks = Math.max(1, Math.floor(days / 7));
    return `${weeks} week${weeks === 1 ? "" : "s"} since touch`;
  }
  return `${days} days since touch`;
};

function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("board");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [sortKey, setSortKey] = useState("ltv");
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", phone: "" });
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/.netlify/functions/customers");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load customers");
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load customers", err);
      setError(err.message || "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const ltvValues = useMemo(
    () =>
      customers
        .map((customer) => toNumber(customer.total_spent) + toNumber(customer.total_rented))
        .filter((value) => value > 0),
    [customers]
  );

  const vipThreshold = useMemo(() => getQuantile(ltvValues, 0.8), [ltvValues]);
  const loyalThreshold = useMemo(() => getQuantile(ltvValues, 0.6), [ltvValues]);

  const enrichedCustomers = useMemo(
    () =>
      customers.map((customer) => {
        const ltv = toNumber(customer.total_spent) + toNumber(customer.total_rented);
        const activity = toNumber(customer.orders) + toNumber(customer.bookings);
        const lastTouch = getLastTouch(customer);
        const daysSince = getDaysSince(lastTouch);
        let segment = "nurture";
        if (activity === 0 && ltv === 0) {
          segment = "prospect";
        } else if ((vipThreshold > 0 && ltv >= vipThreshold) || activity >= 10) {
          segment = "loyal";
        } else if (daysSince > 120) {
          segment = "risk";
        } else if (activity >= 3 || (loyalThreshold > 0 && ltv >= loyalThreshold)) {
          segment = "active";
        }
        const stage = segment === "nurture" ? "active" : segment;
        return {
          ...customer,
          ltv,
          activity,
          lastTouch,
          daysSince,
          segment,
          stage,
        };
      }),
    [customers, loyalThreshold, vipThreshold]
  );

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return enrichedCustomers.filter((customer) => {
      const matchesQuery =
        !needle ||
        String(customer.name || "").toLowerCase().includes(needle) ||
        String(customer.email || "").toLowerCase().includes(needle) ||
        String(customer.phone || "").toLowerCase().includes(needle);
      if (!matchesQuery) return false;
      if (segmentFilter === "all") return true;
      return customer.segment === segmentFilter;
    });
  }, [enrichedCustomers, searchTerm, segmentFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortKey === "name") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    } else if (sortKey === "activity") {
      list.sort((a, b) => b.activity - a.activity);
    } else if (sortKey === "recent") {
      list.sort((a, b) => (b.lastTouch?.getTime() || 0) - (a.lastTouch?.getTime() || 0));
    } else {
      list.sort((a, b) => b.ltv - a.ltv);
    }
    return list;
  }, [filtered, sortKey]);

  const totals = useMemo(() => {
    const totalRevenue = enrichedCustomers.reduce((sum, customer) => sum + customer.ltv, 0);
    const activeCount = enrichedCustomers.filter((customer) => customer.activity > 0).length;
    const atRiskCount = enrichedCustomers.filter((customer) => customer.segment === "risk").length;
    const now = Date.now();
    const newCount = enrichedCustomers.filter((customer) => {
      const created = new Date(customer.createdAt || 0);
      if (Number.isNaN(created.getTime())) return false;
      return now - created.getTime() <= 1000 * 60 * 60 * 24 * 30;
    }).length;
    return {
      totalRevenue,
      activeCount,
      atRiskCount,
      newCount,
      avgLtv: enrichedCustomers.length ? totalRevenue / enrichedCustomers.length : 0,
    };
  }, [enrichedCustomers]);

  const segmentCounts = useMemo(() => {
    return enrichedCustomers.reduce(
      (acc, customer) => {
        acc[customer.segment] += 1;
        return acc;
      },
      { prospect: 0, nurture: 0, active: 0, loyal: 0, risk: 0 }
    );
  }, [enrichedCustomers]);

  const deliverySnapshot = useMemo(() => {
    const orders = detail?.orders;
    if (!Array.isArray(orders)) return null;
    for (const order of orders) {
      const details = parseDeliveryDetails(order?.deliveryDetails);
      if (!details) continue;
      if (details.address || details.contact || details.notes) {
        return { details, order };
      }
    }
    return null;
  }, [detail]);

  const addressLines = useMemo(
    () => getAddressLines(deliverySnapshot?.details?.address),
    [deliverySnapshot]
  );

  const boardColumns = [
    { id: "prospect", label: "Prospects", segments: ["prospect"] },
    { id: "active", label: "Active", segments: ["active", "nurture"] },
    { id: "loyal", label: "Loyal", segments: ["loyal"] },
    { id: "risk", label: "At risk", segments: ["risk"] },
  ];

  const spotlightCustomers = useMemo(() => sorted.slice(0, 4), [sorted]);

  const openDetail = async (customer) => {
    setActiveCustomer(customer);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/.netlify/functions/customers?id=${customer.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load customer profile");
      setDetail(data);
    } catch (err) {
      console.error("Failed to load customer profile", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const createCustomer = async (event) => {
    event.preventDefault();
    setCreateError("");
    try {
      const res = await fetch("/.netlify/functions/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create customer");
      setCustomers((prev) => [data, ...prev]);
      setCreateForm({ name: "", email: "", phone: "" });
      setCreateOpen(false);
    } catch (err) {
      setCreateError(err.message || "Failed to create customer");
    }
  };

  return (
    <div className="crm-page">
      <div className="crm-shell">
        <AdminBreadcrumb items={[{ label: "Customers" }]} />

        <section className="crm-hero">
          <header className="crm-header">
            <div className="crm-header-copy">
              <p className="crm-eyebrow">Customer CRM</p>
              <h1>Customer Relationship Management</h1>
              <div className="crm-segment-strip" aria-label="Customer segment distribution">
                <span className="crm-segment-pill is-prospect">
                  {segmentCounts.prospect} {getSegmentLabel("prospect")}
                </span>
                <span className="crm-segment-pill is-active">
                  {segmentCounts.active + segmentCounts.nurture} Active
                </span>
                <span className="crm-segment-pill is-loyal">
                  {segmentCounts.loyal} {getSegmentLabel("loyal")}
                </span>
                <span className="crm-segment-pill is-risk">
                  {segmentCounts.risk} {getSegmentLabel("risk")}
                </span>
              </div>
            </div>
            <div className="crm-header-actions">
              <button type="button" className="crm-secondary" onClick={fetchCustomers} disabled={loading}>
                <AppIcon icon={faRotateRight} /> Refresh
              </button>
              <button type="button" className="crm-primary" onClick={() => setCreateOpen(true)}>
                <AppIcon icon={faUserPlus} /> Add Customer
              </button>
            </div>
          </header>

          <div className="crm-hero-grid">
            <section className="crm-kpi-grid">
              <article className="crm-kpi-card crm-kpi-card--customers">
                <p className="crm-kpi-label">Total customers</p>
                <h3 className="crm-kpi-value">{enrichedCustomers.length}</h3>
                <span className="crm-kpi-sub">{totals.newCount} new in 30 days</span>
              </article>
              <article className="crm-kpi-card crm-kpi-card--active">
                <p className="crm-kpi-label">Active relationships</p>
                <h3 className="crm-kpi-value">{totals.activeCount}</h3>
                <span className="crm-kpi-sub">{segmentCounts.prospect} prospects to convert</span>
              </article>
              <article className="crm-kpi-card crm-kpi-card--revenue">
                <p className="crm-kpi-label">Lifetime revenue</p>
                <h3 className="crm-kpi-value">{formatMoney(totals.totalRevenue)}</h3>
                <span className="crm-kpi-sub">Avg LTV {formatMoney(totals.avgLtv)}</span>
              </article>
              <article className="crm-kpi-card crm-kpi-card--risk">
                <p className="crm-kpi-label">Needs follow-up</p>
                <h3 className="crm-kpi-value">{segmentCounts.risk}</h3>
                <span className="crm-kpi-sub">At-risk accounts</span>
              </article>
            </section>

            <aside className="crm-spotlight-card">
              <div className="crm-spotlight-head">
                <div>
                  <p className="crm-kpi-label">Priority queue</p>
                  <h3>Customers to act on</h3>
                </div>
                <span className="crm-count">
                  {sorted.length} visible / {enrichedCustomers.length} total
                </span>
              </div>
              {spotlightCustomers.length ? (
                <div className="crm-spotlight-list">
                  {spotlightCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="crm-spotlight-item"
                      onClick={() => openDetail(customer)}
                    >
                      <span className="crm-avatar">{getInitials(customer.name)}</span>
                      <span className="crm-spotlight-copy">
                        <strong>{customer.name || "Unnamed"}</strong>
                        <small>{getTouchLabel(customer)}</small>
                      </span>
                      <span className={`crm-tag is-${customer.segment}`}>
                        {getSegmentLabel(customer.segment)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="crm-muted">No customers match the current filters.</p>
              )}
            </aside>
          </div>
        </section>

        <section className="crm-controls">
          <div className="crm-control-panel">
            <label className="crm-search">
              <span>Search</span>
              <SearchField
                placeholder="Name, email, or phone"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClear={() => setSearchTerm("")}
                aria-label="Search customers"
              />
            </label>
            <div className="crm-filters">
              <label className="crm-filter">
                <span>Segment</span>
                <select value={segmentFilter} onChange={(e) => setSegmentFilter(e.target.value)}>
                  <option value="all">All segments</option>
                  <option value="prospect">Prospects</option>
                  <option value="nurture">Nurture</option>
                  <option value="active">Active</option>
                  <option value="loyal">Loyal</option>
                  <option value="risk">At risk</option>
                </select>
              </label>
              <label className="crm-filter">
                <span>Sort by</span>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                  <option value="ltv">Lifetime value</option>
                  <option value="activity">Activity volume</option>
                  <option value="recent">Last touch</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </label>
            </div>
          </div>
          <div className="crm-view-panel">
            <div className="crm-view-toggle" role="tablist" aria-label="CRM views">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "board"}
                className={viewMode === "board" ? "is-active" : ""}
                onClick={() => setViewMode("board")}
              >
                <AppIcon icon={faColumns} /> Board
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "list"}
                className={viewMode === "list" ? "is-active" : ""}
                onClick={() => setViewMode("list")}
              >
                <AppIcon icon={faTableCells} /> List
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "timeline"}
                className={viewMode === "timeline" ? "is-active" : ""}
                onClick={() => setViewMode("timeline")}
              >
                <AppIcon icon={faClock} /> Timeline
              </button>
            </div>
            <p className="crm-count">
              Showing {sorted.length} of {enrichedCustomers.length} customers
            </p>
          </div>
        </section>

        {loading && <p className="crm-muted">Loading customers...</p>}
        {!loading && error && <p className="crm-error">{error}</p>}

        {!loading && !error && viewMode === "board" && (
          <div className="crm-board">
            {boardColumns.map((column) => {
              const columnCustomers = sorted.filter((customer) => column.segments.includes(customer.stage));
              const columnRevenue = columnCustomers.reduce((sum, customer) => sum + customer.ltv, 0);
              return (
                <section key={column.id} className="crm-column">
                  <div className="crm-column-head">
                    <div>
                      <h3>{column.label}</h3>
                      <p className="crm-column-meta">{formatMoney(columnRevenue)} in value</p>
                    </div>
                    <span className="crm-column-count">{columnCustomers.length}</span>
                  </div>
                  <div className="crm-column-list">
                    {columnCustomers.map((customer) => (
                      <article key={customer.id} className="crm-card crm-card--compact">
                        <div className="crm-card-top">
                          <div className="crm-profile">
                            <div className="crm-avatar">{getInitials(customer.name)}</div>
                            <div>
                              <h4>{customer.name || "Unnamed"}</h4>
                              <span className="crm-meta">Client #{customer.id}</span>
                            </div>
                          </div>
                          <span className={`crm-tag is-${customer.segment}`}>
                            {getSegmentLabel(customer.segment)}
                          </span>
                        </div>
                        <div className="crm-card-body">
                          <p>
                            <AppIcon icon={faEnvelope} /> {customer.email || "No email"}
                          </p>
                          <p>
                            <AppIcon icon={faPhone} /> {customer.phone || "No phone"}
                          </p>
                        </div>
                        <div className="crm-metrics">
                          <div>
                            <span>Orders</span>
                            <strong>{toNumber(customer.orders)}</strong>
                          </div>
                          <div>
                            <span>Bookings</span>
                            <strong>{toNumber(customer.bookings)}</strong>
                          </div>
                          <div>
                            <span>LTV</span>
                            <strong>{formatMoney(customer.ltv)}</strong>
                          </div>
                        </div>
                        <div className="crm-card-footer">
                          <span className="crm-next-step">{getNextStep(customer)}</span>
                          <div className="crm-actions">
                            {customer.phone && (
                              <>
                                <a href={`tel:${sanitizePhone(customer.phone)}`} className="crm-action">
                                  <AppIcon icon={faPhone} /> Call
                                </a>
                                <a
                                  href={`https://wa.me/${sanitizePhone(customer.phone)}`}
                                  className="crm-action"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <AppIcon icon={faWhatsapp} /> WhatsApp
                                </a>
                              </>
                            )}
                            <button type="button" className="crm-secondary" onClick={() => openDetail(customer)}>
                              <AppIcon icon={faHistory} /> View profile
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!columnCustomers.length && <p className="crm-muted">No customers in this stage.</p>}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {!loading && !error && viewMode === "list" && (
          <div className="crm-list-grid">
            {sorted.map((customer) => (
              <article className="crm-list-card" key={customer.id}>
                <div className="crm-list-main">
                  <div className="crm-profile">
                    <div className="crm-avatar">{getInitials(customer.name)}</div>
                    <div className="crm-table-strong">
                      {customer.name || "Unnamed"}
                      <span className="crm-meta">Client #{customer.id}</span>
                    </div>
                  </div>
                  <span className={`crm-tag is-${customer.segment}`}>
                    {getSegmentLabel(customer.segment)}
                  </span>
                </div>
                <div className="crm-list-contact">
                  <span>
                    <AppIcon icon={faEnvelope} /> {customer.email || "No email"}
                  </span>
                  <span>
                    <AppIcon icon={faPhone} /> {customer.phone || "No phone"}
                  </span>
                </div>
                <div className="crm-list-stats">
                  <div>
                    <span>Orders</span>
                    <strong>{toNumber(customer.orders)}</strong>
                  </div>
                  <div>
                    <span>Bookings</span>
                    <strong>{toNumber(customer.bookings)}</strong>
                  </div>
                  <div>
                    <span>LTV</span>
                    <strong>{formatMoney(customer.ltv)}</strong>
                  </div>
                  <div>
                    <span>Last touch</span>
                    <strong>{customer.lastTouch ? formatDate(customer.lastTouch) : "-"}</strong>
                  </div>
                </div>
                <div className="crm-list-footer">
                  <span className="crm-next-step">{getNextStep(customer)}</span>
                  <div className="crm-table-actions">
                    {customer.phone && (
                      <a href={`tel:${sanitizePhone(customer.phone)}`} className="crm-action">
                        <AppIcon icon={faPhone} /> Call
                      </a>
                    )}
                    <button type="button" className="crm-secondary" onClick={() => openDetail(customer)}>
                      View record
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!sorted.length && <p className="crm-muted">No customers found.</p>}
          </div>
        )}

        {!loading && !error && viewMode === "timeline" && (
          <div className="crm-timeline">
            {sorted.map((customer) => {
              const nextStep =
                customer.segment === "risk"
                  ? "Follow up with a check-in"
                  : customer.segment === "prospect"
                  ? "Send welcome + pricing deck"
                  : customer.segment === "loyal"
                  ? "Offer VIP renewal"
                  : "Schedule a monthly touchpoint";
              return (
                <div key={customer.id} className="crm-timeline-row">
                  <div className="crm-timeline-rail">
                    <div className="crm-avatar">{getInitials(customer.name)}</div>
                    <span className={`crm-timeline-dot is-${customer.segment}`} aria-hidden="true" />
                  </div>
                  <div className="crm-timeline-body">
                    <div className="crm-timeline-head">
                      <h4>{customer.name || "Unnamed"}</h4>
                      <span>{getTouchLabel(customer)}</span>
                    </div>
                    <p className="crm-muted">
                      {customer.email || "No email"} · {customer.phone || "No phone"}
                    </p>
                    <div className="crm-timeline-meta">
                      <span className={`crm-tag is-${customer.segment}`}>
                        {getSegmentLabel(customer.segment)}
                      </span>
                      <span>{customer.activity} touches</span>
                      <span>LTV {formatMoney(customer.ltv)}</span>
                    </div>
                    <div className="crm-timeline-actions">
                      <span className="crm-next-step">{nextStep}</span>
                      {customer.phone && (
                        <a href={`tel:${sanitizePhone(customer.phone)}`} className="crm-action">
                          <AppIcon icon={faPhone} /> Call
                        </a>
                      )}
                      <button type="button" className="crm-secondary" onClick={() => openDetail(customer)}>
                        Open record
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!sorted.length && <p className="crm-muted">No customers found.</p>}
          </div>
        )}
      </div>

      {createOpen && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel">
            <header>
              <div>
                <p className="customers-eyebrow">New customer</p>
                <h2>Add customer</h2>
              </div>
              <button className="customers-modal-close" onClick={() => setCreateOpen(false)} aria-label="Close">
                <AppIcon icon={faXmark} />
              </button>
            </header>
            <form className="customers-form" onSubmit={createCustomer}>
              <label>
                Name
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>
              <label>
                Phone
                <input
                  type="text"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              {createError && <p className="customers-error">{createError}</p>}
              <div className="customers-form-actions">
                <button type="button" className="customers-secondary" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="customers-primary">Save customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeCustomer && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel crm-detail-panel">
            <header className="crm-detail-header">
              <div>
                <p className="customers-eyebrow">Client 360</p>
                <h2>{activeCustomer.name}</h2>
                <p className="crm-muted">{activeCustomer.email || "No email"} · {activeCustomer.phone || "No phone"}</p>
                <div className="crm-detail-header-meta">
                  <span className={`crm-tag is-${activeCustomer.segment || "active"}`}>
                    {getSegmentLabel(activeCustomer.segment)}
                  </span>
                  <span className="crm-meta">LTV {formatMoney(activeCustomer.ltv)}</span>
                  <span className="crm-meta">{activeCustomer.activity} interactions</span>
                </div>
              </div>
              <button className="customers-modal-close" onClick={() => setActiveCustomer(null)} aria-label="Close">
                <AppIcon icon={faXmark} />
              </button>
            </header>
            {detailLoading && <p className="crm-muted">Loading history...</p>}
            {detail && (
              <>
                <div className="crm-detail-quick-actions">
                  {activeCustomer.phone && (
                    <>
                      <a href={`tel:${sanitizePhone(activeCustomer.phone)}`} className="crm-action">
                        <AppIcon icon={faPhone} /> Call
                      </a>
                      <a
                        href={`https://wa.me/${sanitizePhone(activeCustomer.phone)}`}
                        className="crm-action"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <AppIcon icon={faWhatsapp} /> WhatsApp
                      </a>
                    </>
                  )}
                  {activeCustomer.email && (
                    <a href={`mailto:${activeCustomer.email}`} className="crm-action">
                      <AppIcon icon={faEnvelope} /> Email
                    </a>
                  )}
                </div>
                <div className="crm-detail-grid">
                  <div className="crm-detail-card">
                    <h4>Totals</h4>
                    <div className="crm-detail-stats">
                      <p><span>Orders</span><strong>{detail.totals.orders}</strong></p>
                      <p><span>Bookings</span><strong>{detail.totals.bookings}</strong></p>
                      <p><span>Retail spent</span><strong>{formatMoney(detail.totals.totalSpent)}</strong></p>
                      <p><span>Rental spent</span><strong>{formatMoney(detail.totals.totalRented)}</strong></p>
                    </div>
                  </div>
                  <div className="crm-detail-card crm-address-card">
                    <h4>Primary address</h4>
                    <p className="crm-address-name">{activeCustomer?.name || "Customer"}</p>
                    {addressLines.length ? (
                      <div className="crm-address-lines">
                        {addressLines.map((line, index) => (
                          <span key={`${activeCustomer?.id || "customer"}-address-${index}`}>{line}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="crm-muted">No delivery address on file.</p>
                    )}
                    <p className="crm-address-phone">
                      Phone number: {deliverySnapshot?.details?.contact || activeCustomer?.phone || detail?.customer?.phone || "Not provided"}
                    </p>
                    {deliverySnapshot?.details?.notes ? (
                      <p className="crm-address-note">Delivery instructions: {deliverySnapshot.details.notes}</p>
                    ) : (
                      <button type="button" className="crm-address-link">
                        Add delivery instructions
                      </button>
                    )}
                    <div className="crm-address-actions">
                      <button type="button" className="crm-address-action" disabled={!addressLines.length}>
                        Edit
                      </button>
                      <button type="button" className="crm-address-action" disabled={!addressLines.length}>
                        Remove
                      </button>
                      <button type="button" className="crm-address-action" disabled={!addressLines.length}>
                        Set as Default
                      </button>
                    </div>
                  </div>
                  <div className="crm-detail-card">
                    <h4>Orders</h4>
                    {detail.orders.length === 0 ? (
                      <p className="crm-muted">No orders yet.</p>
                    ) : (
                      <ul className="crm-detail-list">
                        {detail.orders.slice(0, 6).map((order) => (
                          <li key={order.id}>
                            {order.orderNumber} · {formatDate(order.orderDate)} ·{" "}
                            {formatMoney(order.total_with_delivery ?? order.total_amount)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="crm-detail-card">
                    <h4>Bookings</h4>
                    {detail.bookings.length === 0 ? (
                      <p className="crm-muted">No bookings yet.</p>
                    ) : (
                      <ul className="crm-detail-list">
                        {detail.bookings.slice(0, 6).map((booking) => (
                          <li key={booking.id}>
                            #{booking.id} · {formatDate(booking.eventDate)} · {formatMoney(booking.totalAmount)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCustomers;
