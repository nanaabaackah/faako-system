import React, { useEffect, useMemo, useState } from "react";
import "./AdminMaintenance.css";
import { AppIcon } from "/src/components/Icon/Icon";
import { faWrench, faPlus, faRotateRight } from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import SearchField from "../../components/SearchField/SearchField";

const defaultForm = {
  productId: "",
  issue: "",
  type: "repair",
  cost: "",
  notes: "",
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatCurrency = (valueCents) => {
  const amount = Number(valueCents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `GHS ${amount.toFixed(2)}`;
  }
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function AdminMaintenance() {
  const [logs, setLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState("open");
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/.netlify/functions/maintenance");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load maintenance logs.");
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Maintenance fetch failed", err);
      setError(err.message || "Unable to load maintenance logs.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await fetch("/.netlify/functions/inventory");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load products.");
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Products fetch failed", err);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchProducts();
  }, []);

  const maintenanceStats = useMemo(() => {
    const openLogs = logs.filter((log) => String(log.status).toLowerCase() === "open");
    const resolvedLogs = logs.filter((log) => String(log.status).toLowerCase() === "resolved");
    const offlineAssets = new Set(openLogs.map((log) => log.productId)).size;
    const totalCost = logs.reduce((sum, log) => sum + toNumber(log.cost), 0);
    return {
      openCount: openLogs.length,
      resolvedCount: resolvedLogs.length,
      offlineAssets,
      totalCost,
    };
  }, [logs]);

  const sortedProducts = useMemo(() => {
    const isMaintenanceAsset = (product) => {
      const source = String(product.sourceCategoryCode || product.sourcecategorycode || "").toLowerCase();
      const category = String(product.specificCategory || product.specificcategory || "").toLowerCase();
      const name = String(product.name || "").toLowerCase();
      const sku = String(product.sku || "").toUpperCase();
      if (source && source !== "rental") return false;
      if (category.includes("bouncy")) return true;
      if (category.includes("machine")) return true;
      if (category.includes("trampoline")) return true;
      if (sku.startsWith("PUM") || name.includes("motor pump") || name.includes("pump")) return true;
      return false;
    };

    return [...products]
      .filter(isMaintenanceAsset)
      .sort((a, b) => {
        const nameA = String(a.name || "").toLowerCase();
        const nameB = String(b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [products]);

  const filteredLogs = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      const statusKey = String(log.status || "").toLowerCase();
      if (filter !== "all" && statusKey !== filter) return false;
      if (!needle) return true;
      const fields = [log.productName, log.productSku, log.issue, log.type];
      return fields.some((field) => String(field || "").toLowerCase().includes(needle));
    });
  }, [logs, filter, searchTerm]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    try {
      const res = await fetch("/.netlify/functions/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: form.productId,
          issue: form.issue,
          type: form.type,
          cost: form.cost || 0,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to log maintenance issue.");
      setStatus("Maintenance issue logged.");
      setForm(defaultForm);
      await fetchLogs();
      await fetchProducts();
    } catch (err) {
      console.error("Maintenance save failed", err);
      setError(err.message || "Unable to log maintenance.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (log, nextStatus) => {
    setError("");
    setStatus("");
    try {
      const res = await fetch("/.netlify/functions/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: log.id, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update maintenance status.");
      setStatus(nextStatus === "resolved" ? "Issue resolved." : "Issue reopened.");
      await fetchLogs();
      await fetchProducts();
    } catch (err) {
      console.error("Maintenance update failed", err);
      setError(err.message || "Unable to update maintenance.");
    }
  };

  return (
    <div className="maintenance-page">
      <div className="maintenance-shell">
        <AdminBreadcrumb items={[{ label: "Maintenance" }]} />

        <header className="maintenance-header">
          <div>
            <p className="maintenance-eyebrow">Asset Health</p>
            <h1>Maintenance Tracker</h1>
            <p className="maintenance-subtitle">
              Flag rental assets for repairs or cleanings and keep the booking catalog safe.
            </p>
          </div>
          <div className="maintenance-actions">
            <button type="button" className="maintenance-secondary" onClick={fetchLogs}>
              <AppIcon icon={faRotateRight} /> Refresh
            </button>
          </div>
        </header>

        {error && <p className="maintenance-error">{error}</p>}
        {status && <p className="maintenance-success">{status}</p>}

        <section className="maintenance-kpis">
          <div className="maintenance-kpi">
            <p className="maintenance-label">Open issues</p>
            <h3>{maintenanceStats.openCount}</h3>
            <p className="maintenance-sub">{maintenanceStats.offlineAssets} assets offline</p>
          </div>
          <div className="maintenance-kpi">
            <p className="maintenance-label">Resolved</p>
            <h3>{maintenanceStats.resolvedCount}</h3>
            <p className="maintenance-sub">Completed maintenance logs</p>
          </div>
          <div className="maintenance-kpi">
            <p className="maintenance-label">Maintenance spend</p>
            <h3>{formatCurrency(maintenanceStats.totalCost)}</h3>
            <p className="maintenance-sub">Total recorded costs</p>
          </div>
        </section>

        <div className="maintenance-grid">
          <section className="maintenance-card">
            <div className="maintenance-card-head">
              <h2>
                <AppIcon icon={faWrench} /> Log maintenance
              </h2>
              <p className="maintenance-muted">Mark assets as under repair to pause bookings.</p>
            </div>
            <form className="maintenance-form" onSubmit={handleSubmit}>
              <label>
                Asset
                <select
                  value={form.productId}
                  onChange={(event) => setForm((prev) => ({ ...prev, productId: event.target.value }))}
                  required
                  disabled={productsLoading}
                >
                  <option value="">{productsLoading ? "Loading assets..." : "Select a product"}</option>
                  {sortedProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} {product.sku ? `(${product.sku})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Issue description
                <input
                  type="text"
                  value={form.issue}
                  onChange={(event) => setForm((prev) => ({ ...prev, issue: event.target.value }))}
                  placeholder="Torn seam on bouncy castle"
                  required
                />
              </label>
              <div className="maintenance-row">
                <label>
                  Type
                  <select
                    value={form.type}
                    onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                  >
                    <option value="repair">Repair</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="inspection">Inspection</option>
                    <option value="replacement">Replacement</option>
                  </select>
                </label>
                <label>
                  Cost (GHS)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost}
                    onChange={(event) => setForm((prev) => ({ ...prev, cost: event.target.value }))}
                  />
                </label>
              </div>
              <label>
                Notes
                <textarea
                  rows="3"
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Vendor quote, parts ordered, ETA."
                />
              </label>
              <button type="submit" className="maintenance-primary" disabled={saving}>
                <AppIcon icon={faPlus} /> {saving ? "Saving..." : "Log issue"}
              </button>
            </form>
          </section>

          <section className="admin-table maintenance-table">
            <div className="admin-table-header maintenance-table-head">
              <div>
                <h3>Maintenance log</h3>
                <span>{logs.length} entries</span>
              </div>
              <div className="maintenance-toolbar">
                <SearchField
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onClear={() => setSearchTerm("")}
                  placeholder="Search assets or issues"
                  aria-label="Search assets or issues"
                  inputClassName="maintenance-search"
                />
                <div className="maintenance-filters">
                  {["all", "open", "resolved"].map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`maintenance-filter ${filter === key ? "active" : ""}`}
                      onClick={() => setFilter(key)}
                    >
                      {key === "all" ? "All" : key === "open" ? "Open" : "Resolved"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="admin-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Issue</th>
                    <th>Status</th>
                    <th>Cost</th>
                    <th>Logged</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="maintenance-empty">Loading maintenance logs...</td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="maintenance-empty">No maintenance logs found.</td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <div className="maintenance-asset">
                            <strong>{log.productName || "Unknown"}</strong>
                            <span>{log.productSku || "No SKU"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="maintenance-issue">
                            <p>{log.issue}</p>
                            <span className="maintenance-type">{log.type}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`maintenance-status ${String(log.status || "").toLowerCase()}`}>
                            {log.status}
                          </span>
                        </td>
                        <td>{formatCurrency(log.cost)}</td>
                        <td>
                          <div className="maintenance-date">
                            <span>{formatDate(log.createdAt)}</span>
                            {log.resolvedAt && <small>Resolved {formatDate(log.resolvedAt)}</small>}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="maintenance-secondary"
                            onClick={() =>
                              updateStatus(log, log.status === "resolved" ? "open" : "resolved")
                            }
                          >
                            {log.status === "resolved" ? "Reopen" : "Resolve"}
                          </button>
                        </td>
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

export default AdminMaintenance;
