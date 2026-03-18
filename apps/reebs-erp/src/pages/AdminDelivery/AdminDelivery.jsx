import React, { useEffect, useMemo, useState } from "react";
import "./AdminDelivery.css";
import { AppIcon } from "/src/components/Icon/Icon";
import { faTruck, faRotateRight, faLocationDot } from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import SearchField from "../../components/SearchField/SearchField";

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "loaded", label: "Loaded" },
  { value: "en_route", label: "En route" },
  { value: "delivered", label: "Delivered" },
  { value: "pickup", label: "Pickup" },
  { value: "issue", label: "Issue" },
];

const DISALLOWED_DRIVER_NAMES = new Set(["sabina ackah"]);

const normalizeDriverName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const isDisallowedDriverName = (name) =>
  DISALLOWED_DRIVER_NAMES.has(normalizeDriverName(name));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const formatTime = (value) => {
  if (!value) return "";
  return value;
};

const normalizeStatus = (value) => {
  if (typeof value !== "string") return "scheduled";
  const normalized = value.trim().toLowerCase();
  return normalized || "scheduled";
};

const buildMapUrl = (address) => {
  if (!address) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
};

function AdminDelivery() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({
    status: "scheduled",
    driverName: "",
    routeGroup: "",
    routeOrder: "",
    eta: "",
    notes: "",
  });

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const fetchDeliveries = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/.netlify/functions/deliveries");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load deliveries.");
      setDeliveries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Delivery fetch failed", err);
      setError(err.message || "Unable to load deliveries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await fetch("/.netlify/functions/users");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load users.");
        const driverList = (Array.isArray(data) ? data : [])
          .filter((user) => String(user?.role || "").toLowerCase() === "driver")
          .map((user) => ({
            id: user.id,
            name:
              user.fullName ||
              [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
              user.email ||
              `Driver ${user.id}`,
          }))
          .filter((driver) => !isDisallowedDriverName(driver.name))
          .sort((a, b) => a.name.localeCompare(b.name));
        setDrivers(driverList);
      } catch (err) {
        console.warn("Driver list fetch failed", err);
        setDrivers([]);
      }
    };

    fetchDrivers();
  }, []);

  useEffect(() => {
    if (!selected && deliveries.length) {
      setSelected(deliveries[0]);
    }
  }, [deliveries, selected]);

  useEffect(() => {
    if (!selected) return;
    const driverName = selected.driverName || selected.assignedUserName || "";
    setForm({
      status: normalizeStatus(selected.deliveryStatus || "scheduled"),
      driverName: isDisallowedDriverName(driverName) ? "" : driverName,
      routeGroup: selected.routeGroup || "",
      routeOrder: selected.routeOrder ?? "",
      eta: selected.eta || "",
      notes: selected.notes || "",
    });
  }, [selected]);

  const driverOptions = useMemo(() => {
    const list = drivers.map((driver) => ({
      ...driver,
      isLegacy: false,
    }));
    const current = form.driverName?.trim();
    if (
      current &&
      !isDisallowedDriverName(current) &&
      !list.some((driver) => driver.name === current)
    ) {
      list.unshift({ id: "legacy", name: current, isLegacy: true });
    }
    return list;
  }, [drivers, form.driverName]);

  const filteredDeliveries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return deliveries.filter((delivery) => {
      const statusKey = normalizeStatus(delivery.deliveryStatus);
      if (statusFilter !== "all" && statusKey !== statusFilter) return false;
      if (!needle) return true;
      const haystack = [
        delivery.customerName,
        delivery.venueAddress,
        delivery.driverName,
        delivery.assignedUserName,
        delivery.routeGroup,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [deliveries, statusFilter, search]);

  const routeGroups = useMemo(() => {
    const map = new Map();
    deliveries.forEach((delivery) => {
      const key = delivery.routeGroup || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(delivery);
    });
    return [...map.entries()].map(([name, items]) => ({
      name,
      count: items.length,
      nextStop: items.sort(
        (a, b) => (a.routeOrder ?? 9999) - (b.routeOrder ?? 9999)
      )[0],
    }));
  }, [deliveries]);

  const stats = useMemo(() => {
    const total = deliveries.length;
    const inProgress = deliveries.filter((item) =>
      ["loaded", "en_route"].includes(normalizeStatus(item.deliveryStatus))
    ).length;
    const delivered = deliveries.filter((item) =>
      ["delivered", "pickup"].includes(normalizeStatus(item.deliveryStatus))
    ).length;
    const issues = deliveries.filter(
      (item) => normalizeStatus(item.deliveryStatus) === "issue"
    ).length;
    const assignedDriverCount = new Set(
      deliveries
        .map((item) => item.driverName || item.assignedUserName || "")
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    ).size;
    const unassignedCount = deliveries.filter(
      (item) => !(item.driverName || item.assignedUserName)
    ).length;
    const routeCount = routeGroups.filter((route) => route.name !== "Unassigned").length;
    return { total, inProgress, delivered, issues, assignedDriverCount, unassignedCount, routeCount };
  }, [deliveries, routeGroups]);

  const saveDelivery = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const res = await fetch("/.netlify/functions/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: selected.id,
          status: form.status,
          driverName: form.driverName,
          routeGroup: form.routeGroup,
          routeOrder: form.routeOrder === "" ? null : Number(form.routeOrder),
          eta: form.eta,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update delivery.");

      setDeliveries((prev) =>
        prev.map((item) =>
          item.id === selected.id
            ? {
                ...item,
                deliveryId: data.id,
                deliveryStatus: data.status,
                driverName: data.driverName,
                routeGroup: data.routeGroup,
                routeOrder: data.routeOrder,
                eta: data.eta,
                notes: data.notes,
                deliveryUpdatedAt: data.updatedAt,
              }
            : item
        )
      );
      setSelected((prev) =>
        prev && prev.id === selected.id
          ? {
              ...prev,
              deliveryId: data.id,
              deliveryStatus: data.status,
              driverName: data.driverName,
              routeGroup: data.routeGroup,
              routeOrder: data.routeOrder,
              eta: data.eta,
              notes: data.notes,
              deliveryUpdatedAt: data.updatedAt,
            }
          : prev
      );
      setStatus("Delivery updated.");
    } catch (err) {
      console.error("Delivery update failed", err);
      setError(err.message || "Unable to update delivery.");
    } finally {
      setSaving(false);
    }
  };

  const selectedItems = Array.isArray(selected?.items) ? selected.items : [];
  const selectedStatus = normalizeStatus(selected?.deliveryStatus);

  return (
    <div className="delivery-page delivery-page--redesign">
      <div className="delivery-shell">
        <AdminBreadcrumb items={[{ label: "Delivery" }]} />

        <header className="delivery-header">
          <div>
            <p className="delivery-eyebrow">Logistics</p>
            <h1>Delivery Command</h1>
            <p className="delivery-subtitle">
              Track routes, update delivery stages, and keep rental drop-offs on schedule.
            </p>
          </div>
          <div className="delivery-actions">
            <button type="button" className="delivery-secondary" onClick={fetchDeliveries} disabled={loading}>
              <AppIcon icon={faRotateRight} /> Refresh
            </button>
          </div>
        </header>

        {error && <p className="delivery-error">{error}</p>}
        {status && <p className="delivery-success">{status}</p>}

        <section className="delivery-kpis">
          <div className="delivery-kpi">
            <span>Total stops</span>
            <strong>{stats.total}</strong>
            <small>{stats.routeCount} routed groups</small>
          </div>
          <div className="delivery-kpi">
            <span>In progress</span>
            <strong>{stats.inProgress}</strong>
            <small>{stats.assignedDriverCount} drivers assigned</small>
          </div>
          <div className="delivery-kpi">
            <span>Completed</span>
            <strong>{stats.delivered}</strong>
            <small>{Math.max(stats.total - stats.delivered, 0)} still open</small>
          </div>
          <div className="delivery-kpi">
            <span>Issues</span>
            <strong>{stats.issues}</strong>
            <small>{stats.unassignedCount} unassigned</small>
          </div>
        </section>

        <div className="delivery-filters">
          <SearchField
            className="delivery-search"
            placeholder="Search customer, address, driver..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            aria-label="Search customer, address, or driver"
          />
          <div className="delivery-statuses">
            {["all", ...STATUS_OPTIONS.map((opt) => opt.value)].map((key) => (
              <button
                key={key}
                type="button"
                className={`delivery-filter ${statusFilter === key ? "active" : ""}`}
                onClick={() => setStatusFilter(key)}
              >
                {key === "all" ? "All" : STATUS_OPTIONS.find((opt) => opt.value === key)?.label || key}
              </button>
            ))}
          </div>
          <p className="delivery-filter-note">
            Select a stop to update the driver, route order, ETA, and handoff notes from the same screen.
          </p>
        </div>

        <div className="delivery-grid">
          <section className="delivery-panel">
            <div className="delivery-panel-head">
              <h3>
                <AppIcon icon={faTruck} /> Active routes
              </h3>
              <span>{filteredDeliveries.length} stops</span>
            </div>

            <div className="delivery-routes">
              {routeGroups.map((route) => (
                <div key={route.name} className="delivery-route-card">
                  <div>
                    <strong>{route.name}</strong>
                    <span>{route.count} stops</span>
                  </div>
                  <p>
                    Next: {route.nextStop?.customerName || "Unassigned"} · {formatDate(route.nextStop?.eventDate)}
                  </p>
                </div>
              ))}
            </div>

            <div className="delivery-list">
              {loading ? (
                <p className="delivery-muted">Loading deliveries...</p>
              ) : filteredDeliveries.length === 0 ? (
                <p className="delivery-muted">No deliveries match your filters.</p>
              ) : (
                filteredDeliveries.map((delivery) => {
                  const statusKey = normalizeStatus(delivery.deliveryStatus);
                  const isActive = selected?.id === delivery.id;
                  const driverLabel = delivery.driverName || delivery.assignedUserName || "Unassigned";
                  return (
                    <button
                      key={delivery.id}
                      type="button"
                      className={`delivery-list-item ${isActive ? "is-active" : ""}`}
                      onClick={() => setSelected(delivery)}
                    >
                      <div>
                        <strong>{delivery.customerName || "Customer"}</strong>
                        <span>{formatDate(delivery.eventDate)} · {formatTime(delivery.startTime)}</span>
                        <span>{delivery.venueAddress}</span>
                      </div>
                      <div>
                        <span className={`delivery-pill ${statusKey}`}>{statusKey.replace("_", " ")}</span>
                        <span>{driverLabel}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <aside className="delivery-panel delivery-detail">
            {!selected ? (
              <p className="delivery-muted">Select a delivery to view details.</p>
            ) : (
              <>
                <div className="delivery-detail-head">
                  <div>
                    <p className="delivery-eyebrow">Stop details</p>
                    <h2>{selected.customerName || "Customer"}</h2>
                    <p className="delivery-muted">{selected.venueAddress}</p>
                  </div>
                  <span className={`delivery-pill ${selectedStatus}`}>{selectedStatus.replace("_", " ")}</span>
                </div>

                <div className="delivery-map">
                  {selected.venueAddress ? (
                    <iframe
                      title="Delivery location"
                      src={buildMapUrl(selected.venueAddress)}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <p className="delivery-muted">No address provided.</p>
                  )}
                </div>

                <div className="delivery-items">
                  <h4>Rental items</h4>
                  {selectedItems.length ? (
                    <ul>
                      {selectedItems.map((item) => {
                        const attendants = Number(item.attendantsNeeded) || 0;
                        const blowers = Number(item.blowersNeeded) || 0;
                        const metaParts = [];
                        if (attendants > 0) metaParts.push(`Attendants: ${attendants}`);
                        if (blowers > 0) metaParts.push(`Blowers: ${blowers}`);
                        const meta = metaParts.join(" · ");
                        return (
                          <li key={item.id || item.productId}>
                            <div className="delivery-item-info">
                              <span className="delivery-item-name">{item.productName || "Item"}</span>
                              {meta && <span className="delivery-item-meta">{meta}</span>}
                            </div>
                            <span className="delivery-item-qty">x{item.quantity}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="delivery-muted">No rental items listed.</p>
                  )}
                </div>

                <form className="delivery-form" onSubmit={saveDelivery}>
                  <div className="delivery-form-row">
                    <label>
                      Status
                      <select
                        value={form.status}
                        onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      ETA
                      <input
                        type="text"
                        value={form.eta}
                        placeholder="e.g. 14:30"
                        onChange={(event) => setForm((prev) => ({ ...prev, eta: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="delivery-form-row">
                    <label>
                      Driver
                      <select
                        className="delivery-driver-select"
                        value={form.driverName}
                        onChange={(event) => setForm((prev) => ({ ...prev, driverName: event.target.value }))}
                      >
                        <option value="">Auto-assign driver</option>
                        {driverOptions.map((driver) => (
                          <option key={driver.id} value={driver.name} disabled={driver.isLegacy}>
                            {driver.isLegacy ? `Current: ${driver.name}` : driver.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Route
                      <input
                        type="text"
                        value={form.routeGroup}
                        placeholder="Route A"
                        onChange={(event) => setForm((prev) => ({ ...prev, routeGroup: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="delivery-form-row">
                    <label>
                      Route order
                      <input
                        type="number"
                        value={form.routeOrder}
                        placeholder="1"
                        onChange={(event) => setForm((prev) => ({ ...prev, routeOrder: event.target.value }))}
                      />
                    </label>
                    <label>
                      Notes
                      <input
                        type="text"
                        value={form.notes}
                        placeholder="Gate code, setup notes..."
                        onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                      />
                    </label>
                  </div>
                  <button type="submit" className="delivery-primary" disabled={saving}>
                    {saving ? "Saving..." : "Update delivery"}
                  </button>
                </form>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default AdminDelivery;
