/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./AdminSettings.css";
import { useLocation, useNavigate } from "react-router-dom";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { InlineNotice } from "../../components/InlineNotice/InlineNotice";
import { ADMIN_QUICK_ACTIONS } from "../../utils/adminQuickActions";
import {
  ADMIN_FONT_SIZE_OPTIONS,
  ADMIN_THEME_OPTIONS,
  DEFAULT_ADMIN_PREFERENCES,
  readAdminPreferences,
  writeAdminPreferences,
} from "../../utils/adminPreferences";
import {
  loadCustomerSnapshot,
  loadInventorySnapshot,
  loadOfflineQueue,
} from "../../utils/offlineQueue";

const defaultConfig = {
  currency: "GHS",
  taxRate: "0",
  storeName: "Reebs Rentals",
  storeEmail: "",
  storePhone: "",
  storeAddress: "Sakumono Broadway, Tema, Ghana",
  transportRate: "0",
};
const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PROFILE_IMAGE_TARGET_SIZE = 320;
const PROFILE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const LOW_STOCK_THRESHOLD = 3;

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });

const loadImageElement = (src) =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to process the selected image."));
    image.src = src;
  });

const normalizeProfileImage = async (file) => {
  if (!PROFILE_IMAGE_TYPES.has(file.type)) {
    throw new Error("Upload a JPG, PNG, WEBP, or GIF image.");
  }
  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    throw new Error("Profile picture must be 2 MB or smaller.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImageElement(source);
  const width = image.naturalWidth || image.width || PROFILE_IMAGE_TARGET_SIZE;
  const height = image.naturalHeight || image.height || PROFILE_IMAGE_TARGET_SIZE;
  const cropSize = Math.max(1, Math.min(width, height));
  const offsetX = Math.max(0, (width - cropSize) / 2);
  const offsetY = Math.max(0, (height - cropSize) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = PROFILE_IMAGE_TARGET_SIZE;
  canvas.height = PROFILE_IMAGE_TARGET_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image processing is not available in this browser.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, PROFILE_IMAGE_TARGET_SIZE, PROFILE_IMAGE_TARGET_SIZE);
  context.drawImage(
    image,
    offsetX,
    offsetY,
    cropSize,
    cropSize,
    0,
    0,
    PROFILE_IMAGE_TARGET_SIZE,
    PROFILE_IMAGE_TARGET_SIZE,
  );

  const webpResult = canvas.toDataURL("image/webp", 0.86);
  if (webpResult.startsWith("data:image/webp")) {
    return webpResult;
  }
  return canvas.toDataURL("image/png");
};

const getInitials = (firstName, lastName, fallback = "") => {
  const firstParts = String(firstName || "")
    .split(/\s+/)
    .filter(Boolean);
  const lastParts = String(lastName || "")
    .split(/\s+/)
    .filter(Boolean);
  if (firstParts.length || lastParts.length) {
    return [firstParts[0], lastParts[lastParts.length - 1]]
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "TM";
  }
  if (fallback) {
    const fallbackParts = String(fallback)
      .split(/\s+/)
      .filter(Boolean);
    return [fallbackParts[0], fallbackParts[fallbackParts.length - 1]]
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }
  return "TM";
};

function AdminSettings({ profileOnly = false }) {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    password: "",
    imageUrl: "",
    personalEmail: "",
    jobTitle: "",
    phone: "",
    address: "",
  });
  const [profileStatus, setProfileStatus] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileImageError, setProfileImageError] = useState("");
  const [profileImageLoading, setProfileImageLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [preferencesForm, setPreferencesForm] = useState(DEFAULT_ADMIN_PREFERENCES);
  const [preferencesStatus, setPreferencesStatus] = useState("");

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [inviteForm, setInviteForm] = useState({ firstName: "", lastName: "", role: "Staff", password: "" });
  const [inviteStatus, setInviteStatus] = useState("");

  const [configForm, setConfigForm] = useState(defaultConfig);
  const [configStatus, setConfigStatus] = useState("");
  const [advancedViewMode, setAdvancedViewMode] = useState("simple");
  const [advancedHealth, setAdvancedHealth] = useState({
    queuePending: 0,
    queueFailed: 0,
    inventorySnapshotItems: 0,
    customerSnapshotItems: 0,
    lowStockItems: 0,
  });

  const roleKey = (user?.role || "staff").toLowerCase();
  const isAdmin = roleKey === "admin";
  const showTabs = !profileOnly;
  const pageTitle = profileOnly ? "My Profile" : "Settings";
  const pageSubtitle = profileOnly
    ? "Update your name, username, delivery email, password, photo, and system preferences."
    : "Manage your profile, staff access, ERP configuration, and admin controls.";
  const breadcrumbItems = [{ label: profileOnly ? "Profile" : "Settings" }];
  const viewModeStorageKey = useMemo(
    () => `reebs_admin_view_mode_${user?.id || "guest"}`,
    [user?.id]
  );
  const legacyModuleLinks = useMemo(() => ADMIN_QUICK_ACTIONS, []);

  const syncUserProfile = (data) => {
    const nextFirstName = String(data?.firstName || "").trim();
    const nextLastName = String(data?.lastName || "").trim();
    const nextFullName =
      String(data?.fullName || "").trim()
      || [nextFirstName, nextLastName].filter(Boolean).join(" ");

    updateUser({
      id: data?.id || user?.id,
      firstName: nextFirstName,
      lastName: nextLastName,
      fullName: nextFullName,
      name: nextFullName,
      email: data?.email || user?.email,
      personalEmail: data?.personalEmail ?? "",
      role: data?.role || user?.role,
      imageUrl: data?.imageUrl || null,
      jobTitle: data?.jobTitle || "",
      phone: data?.phone || "",
      address: data?.address || "",
    });
  };

  useEffect(() => {
    if (profileOnly) {
      setActiveTab("profile");
      return;
    }
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get("tab");
    const allowedTabs = new Set(["profile", "users", "config", "advanced"]);
    if (!allowedTabs.has(requestedTab)) return;
    if (requestedTab === "users" && !isAdmin) {
      setActiveTab("profile");
      return;
    }
    setActiveTab(requestedTab);
  }, [isAdmin, location.search, profileOnly]);

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
    const name =
      user?.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.name ||
      "";
    const parts = name.trim().split(" ").filter(Boolean);
    const firstName = String(user?.firstName || parts[0] || "").trim();
    const lastName = String(user?.lastName || parts.slice(1).join(" ") || "").trim();
    setProfileForm((prev) => ({
      ...prev,
      firstName,
      lastName,
      imageUrl: String(user?.imageUrl || "").trim(),
      personalEmail: String(user?.personalEmail || "").trim(),
      jobTitle: String(user?.jobTitle || "").trim(),
      phone: String(user?.phone || "").trim(),
      address: String(user?.address || "").trim(),
    }));
  }, [user]);

  useEffect(() => {
    setPreferencesForm(readAdminPreferences(user?.id));
    setPreferencesStatus("");
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined" || !isAdmin) {
      setAdvancedViewMode("simple");
      return;
    }
    try {
      const stored = window.localStorage.getItem(viewModeStorageKey);
      if (stored === "advanced" || stored === "simple") {
        setAdvancedViewMode(stored);
      }
    } catch {
      setAdvancedViewMode("simple");
    }
  }, [isAdmin, viewModeStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !isAdmin) return;
    try {
      window.localStorage.setItem(viewModeStorageKey, advancedViewMode);
    } catch {
      // ignore storage failures
    }
  }, [advancedViewMode, isAdmin, viewModeStorageKey]);

  useEffect(() => {
    if (activeTab !== "profile") return;
    let ignore = false;

    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError("");
      try {
        const response = await fetch("/.netlify/functions/staffProfile");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load profile.");
        }
        if (ignore) return;
        setProfileForm((prev) => ({
          ...prev,
          firstName: String(data.firstName || "").trim(),
          lastName: String(data.lastName || "").trim(),
          imageUrl: String(data.imageUrl || "").trim(),
          personalEmail: String(data.personalEmail || "").trim(),
          jobTitle: String(data.jobTitle || "").trim(),
          phone: String(data.phone || "").trim(),
          address: String(data.address || "").trim(),
        }));
        syncUserProfile(data);
      } catch (error) {
        if (!ignore) {
          setProfileError(error.message || "Failed to load profile.");
        }
      } finally {
        if (!ignore) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      ignore = true;
    };
  }, [activeTab]);

  const refreshAdvancedHealth = useCallback(() => {
    const queue = loadOfflineQueue();
    const inventorySnapshot = loadInventorySnapshot();
    const customerSnapshot = loadCustomerSnapshot();
    const lowStockItems = inventorySnapshot.filter((item) => {
      const quantity = Number(item?.quantity ?? item?.stock ?? item?.stockOnHand ?? 0);
      return Number.isFinite(quantity) && quantity <= LOW_STOCK_THRESHOLD;
    }).length;

    setAdvancedHealth({
      queuePending: queue.filter((item) => item?.status === "pending").length,
      queueFailed: queue.filter((item) => item?.status === "failed").length,
      inventorySnapshotItems: inventorySnapshot.length,
      customerSnapshotItems: customerSnapshot.length,
      lowStockItems,
    });
  }, []);

  useEffect(() => {
    if (activeTab !== "advanced") return;
    refreshAdvancedHealth();
  }, [activeTab, refreshAdvancedHealth]);

  const profileInitials = useMemo(
    () =>
      getInitials(
        profileForm.firstName,
        profileForm.lastName,
        user?.fullName ||
          [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
          user?.name ||
          "",
      ),
    [profileForm.firstName, profileForm.lastName, user?.firstName, user?.lastName, user?.fullName, user?.name],
  );

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
    setProfileImageError("");
    if (!profileForm.firstName || !profileForm.lastName) {
      setProfileError("First and last name are required.");
      return;
    }
    try {
      const res = await fetch("/.netlify/functions/staffProfile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
          password: profileForm.password || undefined,
          imageUrl: profileForm.imageUrl || null,
          personalEmail: profileForm.personalEmail,
          jobTitle: profileForm.jobTitle,
          phone: profileForm.phone,
          address: profileForm.address,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update profile");
      setProfileForm((prev) => ({
        ...prev,
        firstName: String(data.firstName || "").trim(),
        lastName: String(data.lastName || "").trim(),
        password: "",
        imageUrl: String(data.imageUrl || "").trim(),
        personalEmail: String(data.personalEmail || "").trim(),
        jobTitle: String(data.jobTitle || "").trim(),
        phone: String(data.phone || "").trim(),
        address: String(data.address || "").trim(),
      }));
      syncUserProfile(data);
      setProfileStatus("Profile updated.");
    } catch (err) {
      console.error("Profile save failed", err);
      setProfileError(err.message || "Failed to update profile");
    }
  };

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProfileStatus("");
    setProfileError("");
    setProfileImageError("");
    setProfileImageLoading(true);
    try {
      const imageUrl = await normalizeProfileImage(file);
      setProfileForm((prev) => ({ ...prev, imageUrl }));
    } catch (error) {
      setProfileImageError(error.message || "Failed to process the selected image.");
    } finally {
      setProfileImageLoading(false);
    }
  };

  const removeProfileImage = () => {
    setProfileStatus("");
    setProfileError("");
    setProfileImageError("");
    setProfileForm((prev) => ({ ...prev, imageUrl: "" }));
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

  const savePreferences = (event) => {
    event.preventDefault();
    const nextPreferences = writeAdminPreferences(user?.id, preferencesForm);
    setPreferencesForm(nextPreferences);
    setPreferencesStatus("System preferences updated.");
  };

  return (
    <div className="settings-page">
      <div className="settings-shell">
        <AdminBreadcrumb items={breadcrumbItems} />

        <AdminPageHeader title={pageTitle} subtitle={pageSubtitle} />

        {showTabs && (
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
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "advanced"}
              className={activeTab === "advanced" ? "is-active" : ""}
              onClick={() => setActiveTab("advanced")}
            >
              Advanced
            </button>
          </div>
        )}

        {activeTab === "profile" && (
          <>
            <section className="settings-panel">
              <form className="settings-form" onSubmit={saveProfile}>
                {profileLoading && <p className="settings-muted">Loading profile...</p>}
                <div className="settings-profile-media">
                  <div className="settings-profile-avatar" aria-hidden="true">
                    {profileForm.imageUrl ? (
                      <img src={profileForm.imageUrl} alt="" />
                    ) : (
                      <span>{profileInitials}</span>
                    )}
                  </div>
                  <div className="settings-profile-media-copy">
                    <p>Profile picture</p>
                    <div className="settings-profile-media-actions">
                      <label className="settings-profile-upload">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleProfileImageChange}
                        />
                        <span>{profileImageLoading ? "Processing..." : "Upload photo"}</span>
                      </label>
                      {profileForm.imageUrl && (
                        <button
                          type="button"
                          className="settings-profile-remove"
                          onClick={removeProfileImage}
                        >
                          Remove photo
                        </button>
                      )}
                    </div>
                    <p className="settings-profile-note">
                      JPG, PNG, WEBP, or GIF up to 2 MB. The image is cropped to a square avatar.
                    </p>
                    {profileImageError && (
                      <InlineNotice
                        tone="error"
                        title="Photo not updated"
                        message={profileImageError}
                        compact
                      />
                    )}
                  </div>
                </div>
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
                <div className="settings-grid settings-grid--profile-details">
                  <label>
                    Personal email
                    <input
                      type="email"
                      value={profileForm.personalEmail}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, personalEmail: e.target.value }))}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    <span className="settings-muted">
                      Password reset links and staff notifications are sent here.
                    </span>
                  </label>
                  <label>
                    Phone number
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+233 24 000 0000"
                      autoComplete="tel"
                    />
                  </label>
                </div>
                <label>
                  Address
                  <textarea
                    value={profileForm.address}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="House number, street, area, city"
                    rows={3}
                    autoComplete="street-address"
                  />
                </label>
                <label>
                  Portal username
                  <input type="text" value={user?.email || ""} readOnly />
                  <span className="settings-muted">
                    This autogenerated `@reebs.com` value is your login ID, not your delivery inbox.
                  </span>
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
                {profileError && (
                  <InlineNotice
                    tone="error"
                    title="Profile not saved"
                    message={profileError}
                  />
                )}
                {profileStatus && (
                  <InlineNotice
                    tone="success"
                    title="Profile saved"
                    message={profileStatus}
                  />
                )}
                <div className="settings-actions">
                  <button type="submit" className="settings-primary">Save profile</button>
                </div>
              </form>
            </section>

            <section className="settings-panel">
              <div className="settings-panel-head">
                <div>
                  <h3>System preferences</h3>
                  <p className="settings-muted">
                    Choose how the admin system looks on this device for your account.
                  </p>
                </div>
              </div>
              <form className="settings-form" onSubmit={savePreferences}>
                <div className="settings-grid settings-grid--preferences">
                  <label>
                    Theme mode
                    <span className="settings-select">
                      <select
                        value={preferencesForm.theme}
                        onChange={(e) => {
                          setPreferencesStatus("");
                          setPreferencesForm((prev) => ({ ...prev, theme: e.target.value }));
                        }}
                      >
                        {ADMIN_THEME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <label>
                    Font size
                    <span className="settings-select">
                      <select
                        value={preferencesForm.fontSize}
                        onChange={(e) => {
                          setPreferencesStatus("");
                          setPreferencesForm((prev) => ({ ...prev, fontSize: e.target.value }));
                        }}
                      >
                        {ADMIN_FONT_SIZE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                </div>
                <p className="settings-muted settings-preferences-note">
                  These preferences are stored per user in this browser and apply across the admin system.
                </p>
                {preferencesStatus && (
                  <InlineNotice
                    tone="success"
                    title="Preferences saved"
                    message={preferencesStatus}
                  />
                )}
                <div className="settings-actions">
                  <button type="submit" className="settings-primary">Save preferences</button>
                </div>
              </form>
            </section>
          </>
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
            {usersError && (
              <InlineNotice
                tone="error"
                title="User update failed"
                message={usersError}
              />
            )}
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
                    <span className="settings-select">
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
                    </span>
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
                  {inviteStatus && (
                    <InlineNotice
                      tone="success"
                      title="User added"
                      message={inviteStatus}
                    />
                  )}
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
                <span className="settings-select">
                  <select
                    value={configForm.currency}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, currency: e.target.value }))}
                  >
                    <option value="GHS">GHS</option>
                    <option value="GBP">GBP</option>
                  </select>
                </span>
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
              {configStatus && (
                <InlineNotice
                  tone="success"
                  title="Configuration saved"
                  message={configStatus}
                />
              )}
              <div className="settings-actions">
                <button type="submit" className="settings-primary">Save configuration</button>
              </div>
            </form>
          </section>
        )}

        {activeTab === "advanced" && (
          <>
            <section className="settings-panel">
              <div className="settings-panel-head">
                <div>
                  <h3>Admin controls</h3>
                  <p className="settings-muted">
                    Advanced controls now live inside Settings instead of a separate module.
                  </p>
                </div>
              </div>
              {isAdmin ? (
                <>
                  <div className="settings-advanced-toggle" role="group" aria-label="Admin view mode">
                    <button
                      type="button"
                      className={advancedViewMode === "simple" ? "is-active" : ""}
                      onClick={() => setAdvancedViewMode("simple")}
                    >
                      Simple
                    </button>
                    <button
                      type="button"
                      className={advancedViewMode === "advanced" ? "is-active" : ""}
                      onClick={() => setAdvancedViewMode("advanced")}
                    >
                      Advanced
                    </button>
                  </div>
                  <p className="settings-muted settings-advanced-note">
                    This sets which dashboard control view is used for your account.
                  </p>
                </>
              ) : (
                <p className="settings-muted">
                  Managers can review system shortcuts and local health data here.
                </p>
              )}
            </section>

            <section className="settings-panel">
              <div className="settings-panel-head">
                <div>
                  <h3>Legacy modules</h3>
                  <p className="settings-muted">
                    Quick access to modules that still use the older flow.
                  </p>
                </div>
              </div>
              <div className="settings-advanced-links">
                {legacyModuleLinks.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    className="settings-advanced-link"
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-panel">
              <div className="settings-panel-head settings-panel-head--split">
                <div>
                  <h3>System health</h3>
                  <p className="settings-muted">
                    Local queue and saved fallback data on this device.
                  </p>
                </div>
                <button
                  type="button"
                  className="settings-advanced-refresh"
                  onClick={refreshAdvancedHealth}
                >
                  Refresh
                </button>
              </div>
              <div className="settings-advanced-kpis">
                <article className="settings-advanced-kpi">
                  <p>Queue pending</p>
                  <strong>{advancedHealth.queuePending}</strong>
                  <span>Waiting to sync</span>
                </article>
                <article className="settings-advanced-kpi">
                  <p>Queue failed</p>
                  <strong>{advancedHealth.queueFailed}</strong>
                  <span>Need retry</span>
                </article>
                <article className="settings-advanced-kpi">
                  <p>Inventory snapshot</p>
                  <strong>{advancedHealth.inventorySnapshotItems}</strong>
                  <span>Saved stock rows</span>
                </article>
                <article className="settings-advanced-kpi">
                  <p>Customer snapshot</p>
                  <strong>{advancedHealth.customerSnapshotItems}</strong>
                  <span>Saved customer rows</span>
                </article>
                <article className="settings-advanced-kpi">
                  <p>Low stock in snapshot</p>
                  <strong>{advancedHealth.lowStockItems}</strong>
                  <span>{LOW_STOCK_THRESHOLD} units or less</span>
                </article>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminSettings;
