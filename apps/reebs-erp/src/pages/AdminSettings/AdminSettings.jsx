import React, { useEffect, useMemo, useState } from "react";
import "./AdminSettings.css";
import { useLocation } from "react-router-dom";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import { useAuth } from "../../components/AuthContext/AuthContext";

const defaultConfig = {
  currency: "GHS",
  taxRate: "0",
  storeName: "Reebs Rentals",
  storeEmail: "",
  storePhone: "",
  storeAddress: "Sakumono Broadway, Tema, Ghana",
  transportRate: "0",
};

function AdminSettings() {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", password: "" });
  const [profileStatus, setProfileStatus] = useState("");
  const [profileError, setProfileError] = useState("");

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [inviteForm, setInviteForm] = useState({ firstName: "", lastName: "", role: "Staff", password: "" });
  const [inviteStatus, setInviteStatus] = useState("");

  const [configForm, setConfigForm] = useState(defaultConfig);
  const [configStatus, setConfigStatus] = useState("");

  const roleKey = (user?.role || "staff").toLowerCase();
  const isAdmin = roleKey === "admin";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get("tab");
    const allowedTabs = new Set(["profile", "users", "config"]);
    if (!allowedTabs.has(requestedTab)) return;
    if (requestedTab === "users" && !isAdmin) {
      setActiveTab("profile");
      return;
    }
    setActiveTab(requestedTab);
  }, [location.search, isAdmin]);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("reebs_erp_config");
    if (stored) {
      try {
        setConfigForm({ ...defaultConfig, ...JSON.parse(stored) });
      } catch {
        setConfigForm(defaultConfig);
      }
    }
  }, []);

  useEffect(() => {
    const name = user?.name || user?.fullName || "";
    const parts = name.trim().split(" ");
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");
    setProfileForm((prev) => ({ ...prev, firstName, lastName }));
  }, [user]);

  const fullName = useMemo(() => {
    const { firstName, lastName } = profileForm;
    return [firstName, lastName].filter(Boolean).join(" ");
  }, [profileForm]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const res = await fetch("/.netlify/functions/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Users load failed", err);
      setUsersError(err.message || "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "users" || !isAdmin) return;
    fetchUsers();
  }, [activeTab, isAdmin]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileStatus("");
    setProfileError("");
    if (!profileForm.firstName || !profileForm.lastName) {
      setProfileError("First and last name are required.");
      return;
    }
    try {
      const res = await fetch("/.netlify/functions/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user?.id,
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
          password: profileForm.password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update profile");
      updateUser({
        id: user?.id,
        name: fullName,
        email: data.email || user?.email,
        role: user?.role,
      });
      setProfileStatus("Profile updated.");
      setProfileForm((prev) => ({ ...prev, password: "" }));
    } catch (err) {
      console.error("Profile save failed", err);
      setProfileError(err.message || "Failed to update profile");
    }
  };

  const inviteUser = async (event) => {
    event.preventDefault();
    setInviteStatus("");
    setUsersError("");
    try {
      const res = await fetch("/.netlify/functions/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add user");
      setUsers((prev) => [data, ...prev]);
      setInviteStatus("User added.");
      setInviteForm({ firstName: "", lastName: "", role: "Staff", password: "" });
    } catch (err) {
      console.error("Invite failed", err);
      setUsersError(err.message || "Failed to add user");
    }
  };

  const saveConfig = (event) => {
    event.preventDefault();
    localStorage.setItem("reebs_erp_config", JSON.stringify(configForm));
    setConfigStatus("Configuration saved.");
  };

  return (
    <div className="settings-page">
      <div className="settings-shell">
        <AdminBreadcrumb items={[{ label: "Settings" }]} />

        <header className="settings-header">
          <div>
            <p className="settings-eyebrow">ERP Brain</p>
            <h1>Settings</h1>
            <p className="settings-subtitle">Manage your profile, staff access, and global ERP configuration.</p>
          </div>
        </header>

        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "profile"}
            className={activeTab === "profile" ? "is-active" : ""}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "users"}
            className={activeTab === "users" ? "is-active" : ""}
            onClick={() => setActiveTab("users")}
            disabled={!isAdmin}
          >
            User Management
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "config"}
            className={activeTab === "config" ? "is-active" : ""}
            onClick={() => setActiveTab("config")}
          >
            ERP Config
          </button>
        </div>

        {activeTab === "profile" && (
          <section className="settings-panel">
            <div className="settings-panel-head">
              <div>
                <h3>Profile</h3>
                <p className="settings-muted">Update your name or reset your password.</p>
              </div>
            </div>
            <form className="settings-form" onSubmit={saveProfile}>
              <div className="settings-grid">
                <label>
                  First name
                  <input
                    type="text"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Last name
                  <input
                    type="text"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </label>
              </div>
              <label>
                Email
                <input type="email" value={user?.email || ""} readOnly />
              </label>
              <label>
                Reset password
                <input
                  type="password"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="New password"
                />
              </label>
              {profileError && <p className="settings-error">{profileError}</p>}
              {profileStatus && <p className="settings-success">{profileStatus}</p>}
              <div className="settings-actions">
                <button type="submit" className="settings-primary">Save profile</button>
              </div>
            </form>
          </section>
        )}

        {activeTab === "users" && (
          <section className="settings-panel">
            <div className="settings-panel-head">
              <div>
                <h3>User management</h3>
                <p className="settings-muted">Admins can add staff and adjust roles.</p>
              </div>
            </div>
            {usersLoading && <p className="settings-muted">Loading users...</p>}
            {usersError && <p className="settings-error">{usersError}</p>}
            <div className="settings-users">
              <div className="settings-users-list">
                {users.map((member) => (
                  <div key={member.id} className="settings-user-card">
                    <div>
                      <strong>{member.fullName || member.name || "Unnamed"}</strong>
                      <p className="settings-muted">{member.email}</p>
                    </div>
                    <span className="settings-role">{member.role}</span>
                  </div>
                ))}
                {!usersLoading && users.length === 0 && (
                  <p className="settings-muted">No users found.</p>
                )}
              </div>
              <aside className="settings-sidebar">
                <h4>Add new user</h4>
                <form className="settings-form" onSubmit={inviteUser}>
                  <label>
                    First name
                    <input
                      type="text"
                      value={inviteForm.firstName}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      type="text"
                      value={inviteForm.lastName}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Role
                    <select
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value }))}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Manager">Manager</option>
                      <option value="Staff">Staff</option>
                      <option value="Water">Water</option>
                      <option value="Warehouse">Warehouse</option>
                    </select>
                  </label>
                  <label>
                    Temporary password
                    <input
                      type="password"
                      value={inviteForm.password}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </label>
                  {inviteStatus && <p className="settings-success">{inviteStatus}</p>}
                  <button type="submit" className="settings-primary">Add user</button>
                </form>
              </aside>
            </div>
          </section>
        )}

        {activeTab === "config" && (
          <section className="settings-panel">
            <div className="settings-panel-head">
              <div>
                <h3>ERP configuration</h3>
                <p className="settings-muted">Set defaults like currency and tax rates.</p>
              </div>
            </div>
            <form className="settings-form" onSubmit={saveConfig}>
              <label>
                Base currency
                <select
                  value={configForm.currency}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, currency: e.target.value }))}
                >
                  <option value="GHS">GHS</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
              <label>
                Tax rate (%)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={configForm.taxRate}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, taxRate: e.target.value }))}
                />
              </label>
              <label>
                Store address
                <input
                  type="text"
                  value={configForm.storeAddress}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, storeAddress: e.target.value }))}
                />
              </label>
              <label>
                Transport rate (GHS per km)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={configForm.transportRate}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, transportRate: e.target.value }))}
                />
              </label>
              <label>
                Store name
                <input
                  type="text"
                  value={configForm.storeName}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, storeName: e.target.value }))}
                />
              </label>
              <label>
                Store email
                <input
                  type="email"
                  value={configForm.storeEmail}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, storeEmail: e.target.value }))}
                />
              </label>
              <label>
                Store phone
                <input
                  type="text"
                  value={configForm.storePhone}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, storePhone: e.target.value }))}
                />
              </label>
              {configStatus && <p className="settings-success">{configStatus}</p>}
              <div className="settings-actions">
                <button type="submit" className="settings-primary">Save configuration</button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

export default AdminSettings;
