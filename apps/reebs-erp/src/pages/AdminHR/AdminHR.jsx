import React, { useEffect, useMemo, useState } from "react";
import "./AdminHR.css";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import SearchField from "../../components/SearchField/SearchField";
import roleColors from "../../utils/roleColors";

const initialsFromName = (employee) => {
  const first = employee.firstName || "";
  const last = employee.lastName || "";
  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }
  const fullName = employee.fullName || employee.name || "";
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
};

function AdminHR() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeEmployee, setActiveEmployee] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/.netlify/functions/hr");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load employees");
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load employees", err);
      setError(err.message || "Unable to load employees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const roleCounts = useMemo(() => {
    const counts = {};
    for (const employee of employees) {
      const key = (employee.role || "Staff").toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return employees
      .filter((employee) => {
        if (roleFilter !== "all" && (employee.role || "").toLowerCase() !== roleFilter) {
          return false;
        }
        if (!needle) return true;
        const name = (employee.fullName || employee.name || "").toLowerCase();
        return (
          name.includes(needle) ||
          (employee.email || "").toLowerCase().includes(needle) ||
          (employee.jobTitle || "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        const nameA = (a.fullName || a.name || "").toLowerCase();
        const nameB = (b.fullName || b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [employees, searchTerm, roleFilter]);

  const openEditor = (employee) => {
    setSaveError("");
    setActiveEmployee(employee);
    setForm({
      id: employee.id,
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      role: employee.role || "Staff",
      jobTitle: employee.jobTitle || "",
      phone: employee.phone || "",
      emergencyContactName: employee.emergencyContactName || "",
      emergencyContactPhone: employee.emergencyContactPhone || "",
    });
  };

  const closeEditor = () => {
    setActiveEmployee(null);
    setForm(null);
    setSaveError("");
    setSaving(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form?.id) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/.netlify/functions/hr", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update employee");
      setEmployees((prev) =>
        prev.map((employee) =>
          employee.id === data.id
            ? { ...employee, ...data }
            : employee
        )
      );
      closeEditor();
    } catch (err) {
      console.error("Failed to update employee", err);
      setSaveError(err.message || "Failed to update employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hr-page">
      <div className="hr-shell">
        <AdminBreadcrumb items={[{ label: "HR" }]} />

        <header className="hr-header">
          <div>
            <p className="hr-eyebrow">Operations & Logistics</p>
            <h1>Human Resources</h1>
            <p className="hr-subtitle">
              Track employee profiles, accountability, and performance across orders, bookings, and inventory.
            </p>
          </div>
          <div className="hr-actions">
            <button type="button" className="bookings-secondary" onClick={fetchEmployees}>
              Refresh
            </button>
          </div>
        </header>

        <section className="hr-kpis">
          <div className="hr-card">
            <p className="hr-label">Total users</p>
            <h3>{employees.length}</h3>
            <p className="hr-sub">Verified team members</p>
          </div>
          <div className="hr-card">
            <p className="hr-label">Active sessions</p>
            <h3>Coming soon</h3>
            <p className="hr-sub">Login activity tracking</p>
          </div>
          <div className="hr-card">
            <p className="hr-label">Role distribution</p>
            <div className="hr-legend">
              {Object.keys(roleCounts).length === 0 ? (
                <span className="hr-sub">No roles yet.</span>
              ) : (
                Object.entries(roleCounts).map(([roleKey, count]) => (
                  <span key={roleKey} className={`pill ${roleColors[roleKey] || "blue"}`}>
                    {roleKey} {count}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="hr-panel">
          <div className="hr-panel-head">
            <div>
              <h3>Employee directory</h3>
              <p className="hr-sub">Select a profile to update roles or contact details.</p>
            </div>
            <span className="hr-count">{filteredEmployees.length} employees</span>
          </div>

          <div className="hr-toolbar">
            <label className="hr-search">
              Search
              <SearchField
                placeholder="Search by name, email, or title..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onClear={() => setSearchTerm("")}
                aria-label="Search employees"
              />
            </label>
            <label className="hr-filter">
              Role
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="warehouse">Warehouse</option>
                <option value="driver">Driver</option>
                <option value="sales">Sales</option>
              </select>
            </label>
          </div>

          {loading ? (
            <p className="hr-muted">Loading team directory...</p>
          ) : error ? (
            <p className="hr-error">{error}</p>
          ) : filteredEmployees.length === 0 ? (
            <p className="hr-muted">No employees match this filter.</p>
          ) : (
            <div className="hr-grid">
              {filteredEmployees.map((employee) => {
                const roleKey = (employee.role || "staff").toLowerCase();
                return (
                  <article key={employee.id} className="hr-employee-card">
                    <div className="hr-employee-head">
                      <div className="hr-avatar">{initialsFromName(employee)}</div>
                      <span className={`pill ${roleColors[roleKey] || "blue"}`}>
                        {employee.role || "Staff"}
                      </span>
                    </div>
                    <div className="hr-employee-info">
                      <h4>{employee.fullName || "Unnamed employee"}</h4>
                      <p className="hr-role-title">{employee.jobTitle || "Role title not set"}</p>
                      <p className="hr-contact">{employee.email || "No email set"}</p>
                      <p className="hr-contact">{employee.phone || "No phone set"}</p>
                    </div>
                    <div className="hr-activity">
                      <div>
                        <span>Orders</span>
                        <strong>{employee.orders || 0}</strong>
                      </div>
                      <div>
                        <span>Bookings</span>
                        <strong>{employee.bookings || 0}</strong>
                      </div>
                      <div>
                        <span>Stock</span>
                        <strong>{employee.stockMovements || 0}</strong>
                      </div>
                    </div>
                    <div className="hr-emergency">
                      <p className="hr-emergency-label">Emergency contact</p>
                      <p>{employee.emergencyContactName || "Not set"}</p>
                      <p className="hr-contact">{employee.emergencyContactPhone || ""}</p>
                    </div>
                    <button type="button" className="bookings-secondary" onClick={() => openEditor(employee)}>
                      Edit profile
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {activeEmployee && form && (
        <div className="hr-overlay" role="dialog" aria-modal="true">
          <div className="hr-modal">
            <div className="hr-modal-head">
              <div>
                <p className="hr-label">Employee profile</p>
                <h3>{activeEmployee.fullName || "Employee update"}</h3>
              </div>
              <button type="button" className="hr-close" onClick={closeEditor} aria-label="Close">
                ✕
              </button>
            </div>
            <form className="hr-form" onSubmit={handleSave}>
              <div className="hr-form-row">
                <label>
                  First name
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Last name
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                    required
                  />
                </label>
              </div>
              <div className="hr-form-row">
                <label>
                  Role
                  <select
                    value={form.role}
                    onChange={(event) => setForm({ ...form, role: event.target.value })}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Staff">Staff</option>
                    <option value="Water">Water</option>
                    <option value="Warehouse">Warehouse</option>
                    <option value="Driver">Driver</option>
                    <option value="Sales">Sales</option>
                  </select>
                </label>
                <label>
                  Job title
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
                  />
                </label>
              </div>
              <div className="hr-form-row">
                <label>
                  Phone
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </label>
                <label>
                  Emergency contact
                  <input
                    type="text"
                    value={form.emergencyContactName}
                    onChange={(event) => setForm({ ...form, emergencyContactName: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Emergency phone
                <input
                  type="text"
                  value={form.emergencyContactPhone}
                  onChange={(event) => setForm({ ...form, emergencyContactPhone: event.target.value })}
                />
              </label>
              {saveError && <p className="hr-error">{saveError}</p>}
              <div className="hr-form-actions">
                <button type="button" className="bookings-secondary" onClick={closeEditor}>
                  Cancel
                </button>
                <button type="submit" className="bookings-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminHR;
