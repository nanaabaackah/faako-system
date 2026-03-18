import React, { useEffect, useMemo, useState } from "react";
import "./AdminVendors.css";
import { Link } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faPlus,
  faPen,
  faRotateRight,
  faXmark,
  faPhone,
  faEnvelope,
} from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import SearchField from "../../components/SearchField/SearchField";

const emptyForm = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  mobileMoneyNumber: "",
  address: "",
  bankName: "",
  bankAccount: "",
  leadTimeDays: "",
  suppliedItemsText: "",
  notes: "",
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatLeadTime = (value) => {
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return "Not set";
  return `${days} day${days === 1 ? "" : "s"}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const parseSuppliedItemsText = (value) =>
  Array.from(
    new Set(
      String(value || "")
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );

const MOBILE_VIEW_QUERY = "(max-width: 720px)";

const getIsMobileView = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_VIEW_QUERY).matches;

function AdminVendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [activeVendor, setActiveVendor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [isMobileView, setIsMobileView] = useState(getIsMobileView);
  const [autoLinking, setAutoLinking] = useState(false);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(MOBILE_VIEW_QUERY);
    const handleChange = () => {
      const matches = mediaQuery.matches;
      setIsMobileView(matches);
      if (matches) {
        setFormOpen(false);
        setActiveVendor(null);
        setForm({ ...emptyForm });
      }
    };
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/.netlify/functions/vendors");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load vendors.");
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Vendor fetch failed", err);
      setError(err.message || "Unable to load vendors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const filteredVendors = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return vendors;
    return vendors.filter((vendor) => {
      const fields = [
        vendor.name,
        vendor.contactName,
        vendor.email,
        vendor.phone,
        vendor.address,
      ];
      return fields.some((field) => String(field || "").toLowerCase().includes(needle));
    });
  }, [vendors, searchTerm]);

  const vendorStats = useMemo(() => {
    const totalVendors = vendors.length;
    const totalProducts = vendors.reduce((sum, vendor) => sum + toNumber(vendor.products), 0);
    const leadTimes = vendors
      .map((vendor) => toNumber(vendor.leadTimeDays, 0))
      .filter((value) => value > 0);
    const avgLeadTime = leadTimes.length
      ? Math.round(leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length)
      : 0;
    const withContacts = vendors.filter(
      (vendor) => vendor.contactName || vendor.email || vendor.phone
    ).length;
    return { totalVendors, totalProducts, avgLeadTime, withContacts };
  }, [vendors]);

  useEffect(() => {
    if (!filteredVendors.length) return;
    if (!selectedVendorId || !filteredVendors.some((vendor) => vendor.id === selectedVendorId)) {
      setSelectedVendorId(filteredVendors[0].id);
    }
  }, [filteredVendors, selectedVendorId]);

  const selectedVendor = useMemo(() => {
    if (!vendors.length) return null;
    return vendors.find((vendor) => vendor.id === selectedVendorId) || vendors[0];
  }, [vendors, selectedVendorId]);

  const vendorItems = useMemo(() => {
    const names = Array.isArray(selectedVendor?.productNames) ? selectedVendor.productNames : [];
    return names.filter(Boolean);
  }, [selectedVendor]);

  const vendorSuppliedItems = useMemo(() => {
    const items = Array.isArray(selectedVendor?.suppliedItems) ? selectedVendor.suppliedItems : [];
    return items.filter(Boolean);
  }, [selectedVendor]);

  const openCreateForm = () => {
    if (isMobileView) return;
    setStatus("");
    setActiveVendor(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  };

  const openEditForm = (vendor) => {
    if (isMobileView) return;
    setStatus("");
    setActiveVendor(vendor);
    setForm({
      name: vendor.name || "",
      contactName: vendor.contactName || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      mobileMoneyNumber: vendor.mobileMoneyNumber || "",
      address: vendor.address || "",
      bankName: vendor.bankName || "",
      bankAccount: vendor.bankAccount || "",
      leadTimeDays: vendor.leadTimeDays ?? "",
      suppliedItemsText: Array.isArray(vendor.suppliedItems) ? vendor.suppliedItems.join("\n") : "",
      notes: vendor.notes || "",
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setActiveVendor(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    const payload = {
      ...form,
      suppliedItems: parseSuppliedItemsText(form.suppliedItemsText),
      leadTimeDays:
        form.leadTimeDays === "" || form.leadTimeDays === null
          ? null
          : Number(form.leadTimeDays),
    };

    if (activeVendor?.id) {
      payload.id = activeVendor.id;
    }

    try {
      const res = await fetch("/.netlify/functions/vendors", {
        method: activeVendor ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save vendor.");
      setStatus(activeVendor ? "Vendor updated." : "Vendor added.");
      closeForm();
      await fetchVendors();
    } catch (err) {
      console.error("Vendor save failed", err);
      setError(err.message || "Unable to save vendor.");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoLink = async (vendorId = null) => {
    setAutoLinking(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/.netlify/functions/vendors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "autolink-products",
          vendorId: vendorId || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to auto-link products.");
      }
      const message = data?.message || "No matching in-stock products were linked.";
      setStatus(message);
      await fetchVendors();
    } catch (err) {
      console.error("Vendor auto-link failed", err);
      setError(err.message || "Unable to auto-link products.");
    } finally {
      setAutoLinking(false);
    }
  };

  return (
    <div className="vendors-page">
      <div className="vendors-shell">
        <AdminBreadcrumb items={[{ label: "Vendors" }]} />

        <header className="vendors-header">
          <div>
            <p className="vendors-eyebrow">Supply Chain</p>
            <h1>Vendor Command Center</h1>
            <p className="vendors-subtitle">
              Build a reliable supplier network with lead times, contacts, and coverage insights.
            </p>
          </div>
          {!isMobileView && (
            <div className="vendors-actions">
              <button type="button" className="vendors-secondary" onClick={fetchVendors}>
                <AppIcon icon={faRotateRight} /> Refresh
              </button>
              <button
                type="button"
                className="vendors-secondary"
                onClick={() => handleAutoLink()}
                disabled={autoLinking}
              >
                {autoLinking ? "Linking..." : "Auto-link stock"}
              </button>
              <button type="button" className="vendors-primary" onClick={openCreateForm}>
                <AppIcon icon={faPlus} /> Add Vendor
              </button>
            </div>
          )}
        </header>

        {error && <p className="vendors-error">{error}</p>}
        {status && <p className="vendors-success">{status}</p>}

        <section className="vendors-overview">
          <div className="vendors-kpis">
            <div className="vendors-kpi">
              <p className="vendors-label">Total vendors</p>
              <h3>{vendorStats.totalVendors}</h3>
              <p className="vendors-sub">Active suppliers on file</p>
            </div>
            <div className="vendors-kpi">
              <p className="vendors-label">Catalog coverage</p>
              <h3>{vendorStats.totalProducts}</h3>
              <p className="vendors-sub">Products linked to vendors</p>
            </div>
            <div className="vendors-kpi">
              <p className="vendors-label">Avg lead time</p>
              <h3>{vendorStats.avgLeadTime ? `${vendorStats.avgLeadTime} days` : "—"}</h3>
              <p className="vendors-sub">{vendorStats.withContacts} vendors with contacts</p>
            </div>
          </div>
          <SearchField
            className="vendors-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onClear={() => setSearchTerm("")}
            placeholder="Search vendors by name, contact, email, or phone..."
            aria-label="Search vendors"
          />
        </section>

        {loading ? (
          <p className="vendors-muted">Loading vendors...</p>
        ) : (
          <section className="vendors-board">
            <div className="vendors-list">
              <div className="vendors-list-head">
                <div>
                  <h3>Vendor list</h3>
                  <p className="vendors-muted">{filteredVendors.length} suppliers</p>
                </div>
                {!isMobileView && (
                  <div className="vendors-actions">
                    <button
                      type="button"
                      className="vendors-secondary"
                      onClick={() => handleAutoLink()}
                      disabled={autoLinking}
                    >
                      {autoLinking ? "Linking..." : "Auto-link"}
                    </button>
                    <button type="button" className="vendors-secondary" onClick={openCreateForm}>
                      <AppIcon icon={faPlus} /> New
                    </button>
                  </div>
                )}
              </div>
              <div className="vendors-list-items">
                {filteredVendors.map((vendor) => (
                  <button
                    key={vendor.id}
                    type="button"
                    className={`vendors-list-item ${selectedVendorId === vendor.id ? "active" : ""}`}
                    onClick={() => setSelectedVendorId(vendor.id)}
                  >
                    <div>
                      <h4>{vendor.name}</h4>
                      <span>{vendor.contactName || "No primary contact"}</span>
                    </div>
                    <div className="vendors-list-meta">
                      <span>{formatLeadTime(vendor.leadTimeDays)}</span>
                      <strong>{toNumber(vendor.products)} items</strong>
                    </div>
                  </button>
                ))}
                {!filteredVendors.length && <p className="vendors-muted">No vendors found.</p>}
              </div>
            </div>

            <aside className="vendors-profile">
              {selectedVendor ? (
                <>
                  <div className="vendors-profile-head">
                    <div>
                      <p className="vendors-eyebrow">Vendor profile</p>
                      <h2>{selectedVendor.name}</h2>
                      <p className="vendors-subtitle">
                        {selectedVendor.contactName || "Primary contact not set"}
                      </p>
                    </div>
                    {!isMobileView && (
                      <button
                        type="button"
                        className="vendors-secondary"
                        onClick={() => openEditForm(selectedVendor)}
                      >
                        <AppIcon icon={faPen} /> Edit
                      </button>
                    )}
                  </div>

                  <div className="vendors-profile-actions">
                    {!isMobileView && (
                      <button
                        type="button"
                        className="vendors-secondary"
                        onClick={() => handleAutoLink(selectedVendor.id)}
                        disabled={autoLinking || !vendorSuppliedItems.length}
                      >
                        {autoLinking ? "Linking..." : "Link stock"}
                      </button>
                    )}
                    {selectedVendor.email && (
                      <a className="vendors-action" href={`mailto:${selectedVendor.email}`}>
                        <AppIcon icon={faEnvelope} /> Email
                      </a>
                    )}
                    {selectedVendor.phone && (
                      <a className="vendors-action" href={`tel:${selectedVendor.phone}`}>
                        <AppIcon icon={faPhone} /> Call
                      </a>
                    )}
                  </div>

                  <div className="vendors-profile-grid">
                    <div className="vendors-profile-card">
                      <p className="vendors-label">Lead time</p>
                      <h3>{formatLeadTime(selectedVendor.leadTimeDays)}</h3>
                      <p className="vendors-sub">{toNumber(selectedVendor.products)} linked items</p>
                    </div>
                    <div className="vendors-profile-card">
                      <p className="vendors-label">Contact</p>
                      <h3>{selectedVendor.email || "No email"}</h3>
                      <p className="vendors-sub">{selectedVendor.phone || "No phone"}</p>
                    </div>
                    
                  </div>

                  <div className="vendors-profile-details">
                    <div>
                      <p className="vendors-label">Address</p>
                      <p>{selectedVendor.address || "No address saved."}</p>
                    </div>
                    <div>
                      <p className="vendors-label">Bank details</p>
                      <p>
                        {selectedVendor.bankName
                          ? `${selectedVendor.bankName}${selectedVendor.bankAccount ? ` · ${selectedVendor.bankAccount}` : ""}`
                          : "No banking info"}
                      </p>
                    </div>
                    <div>
                      <p className="vendors-label">Mobile money</p>
                      <p>{selectedVendor.mobileMoneyNumber || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="vendors-label">Last updated</p>
                      <p>{formatDate(selectedVendor.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="vendors-profile-items">
                    <p className="vendors-label">Supplied item keywords</p>
                    {vendorSuppliedItems.length ? (
                      <div className="vendors-items-list">
                        {vendorSuppliedItems.map((item) => (
                          <span key={item} className="vendors-item-chip">
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="vendors-muted">No supplied item keywords saved yet.</p>
                    )}
                  </div>

                  <div className="vendors-profile-items">
                    <p className="vendors-label">Linked stock items</p>
                    {vendorItems.length ? (
                      <div className="vendors-items-list">
                        {vendorItems.map((item) => {
                          const query = encodeURIComponent(item);
                          return (
                            <Link
                              key={item}
                              className="vendors-item-chip"
                              to={`/admin/inventory?search=${query}`}
                            >
                              {item}
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="vendors-muted">No linked items yet.</p>
                    )}
                  </div>

                  {selectedVendor.notes && (
                    <div className="vendors-profile-notes">
                      <p className="vendors-label">Internal notes</p>
                      <p>{selectedVendor.notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="vendors-muted">Select a vendor to view details.</p>
              )}
            </aside>
          </section>
        )}
      </div>

      {formOpen && !isMobileView && (
        <div className="admin-modal" role="dialog" aria-modal="true">
          <div className="admin-modal-panel">
            <header>
              <div>
                <p className="admin-eyebrow">{activeVendor ? "Edit vendor" : "New vendor"}</p>
                <h2>{activeVendor?.name || "Add vendor"}</h2>
                {activeVendor?.id && <span className="admin-modal-meta">ID {activeVendor.id}</span>}
              </div>
              <button className="admin-close" onClick={closeForm} aria-label="Close">
                <AppIcon icon={faXmark} />
              </button>
            </header>

            <form className="admin-form" onSubmit={handleSave}>
              <label>
                Vendor name
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                Contact person
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
              <label>
                Phone
                <input
                  type="text"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </label>
              <label>
                Mobile money number
                <input
                  type="text"
                  value={form.mobileMoneyNumber}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, mobileMoneyNumber: event.target.value }))
                  }
                />
              </label>
              <label>
                Address
                <input
                  type="text"
                  value={form.address}
                  onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                />
              </label>
              <label>
                Bank name
                <input
                  type="text"
                  value={form.bankName}
                  onChange={(event) => setForm((prev) => ({ ...prev, bankName: event.target.value }))}
                />
              </label>
              <label>
                Bank account
                <input
                  type="text"
                  value={form.bankAccount}
                  onChange={(event) => setForm((prev) => ({ ...prev, bankAccount: event.target.value }))}
                />
              </label>
              <label>
                Lead time (days)
                <input
                  type="number"
                  min="0"
                  value={form.leadTimeDays}
                  onChange={(event) => setForm((prev) => ({ ...prev, leadTimeDays: event.target.value }))}
                />
              </label>
              <label>
                Supplied items
                <textarea
                  rows="4"
                  value={form.suppliedItemsText}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, suppliedItemsText: event.target.value }))
                  }
                  placeholder="Gift bag&#10;Balloon pack&#10;Ribbon"
                />
              </label>
              <label>
                Notes
                <textarea
                  rows="3"
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Payment terms, pickup instructions, etc."
                />
              </label>
              <div className="admin-form-actions">
                <button type="button" className="admin-secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="admin-primary" disabled={saving}>
                  {saving ? "Saving..." : activeVendor ? "Save changes" : "Add vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminVendors;
