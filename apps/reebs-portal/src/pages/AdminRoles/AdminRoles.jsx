import React, { useEffect, useMemo, useState } from "react";
import "./AdminRoles.css";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { AppIcon } from "/src/components/Icon/Icon";
import { faEllipsisVertical } from "/src/icons/iconSet";
import { AnimatedLoadingState, ERPFormNotice, SelectField } from "@faako/ui";
import SearchField from "../../components/SearchField/SearchField";
import roleColors from "../../utils/roleColors";
import { reebsApiResponse } from "../../api/client";
import { userAccessFormSchema, validationIssues } from "@faako/validation";
import useUnsavedChanges from "../../hooks/useUnsavedChanges";

const ROLE_OPTIONS = [
  "Owner",
  "Admin",
  "Manager",
  "Staff",
  "Warehouse",
  "Driver",
  "Water",
];
const SYSTEM_ADMIN_EMAIL = "system_admin@reebs.com";
const normalizeRoleKey = (value) => String(value || "").trim().toLowerCase();
const formatRoleLabel = (value) => {
  const normalized = normalizeRoleKey(value);
  if (!normalized) return "Unassigned";
  return (
    ROLE_OPTIONS.find((option) => normalizeRoleKey(option) === normalized)
    || `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
  );
};

const generateEmailFromNames = (firstName, lastName) => {
  const clean = (value) => (value || "").trim().replace(/\s+/g, "").toLowerCase();
  const first = clean(firstName);
  const last = clean(lastName);
  if (!first || !last) return "";
  return `${first}_${last}@reebs.com`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatRelativeTime = (value) => {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60 * 1000) return "Active just now";
  const diffMinutes = Math.round(diffMs / (60 * 1000));
  if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `Active ${diffDays}d ago`;
  return `Seen ${formatDate(value)}`;
};

const getSessionCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const describeSessionDevice = (userAgent = "") => {
  const ua = String(userAgent || "").toLowerCase();
  const browser =
    ua.includes("edg/") ? "Edge"
      : ua.includes("chrome/") && !ua.includes("edg/") ? "Chrome"
        : ua.includes("firefox/") ? "Firefox"
          : ua.includes("safari/") && !ua.includes("chrome/") ? "Safari"
            : "Browser";
  const device =
    ua.includes("iphone") ? "iPhone"
      : ua.includes("ipad") ? "iPad"
        : ua.includes("android") ? "Android"
          : ua.includes("windows") ? "Windows"
            : ua.includes("macintosh") || ua.includes("mac os") ? "Mac"
              : ua.includes("linux") ? "Linux"
                : "Device";
  return `${device} · ${browser}`;
};

const buildDefaultPermissions = (role = "") => {
  const normalized = normalizeRoleKey(role);
  const isAdmin = normalized === "admin";
  return {
    inventoryView: true,
    inventoryEdit: true,
    inventoryAdjustStock: isAdmin,
    bookingsView: true,
    bookingsCreate: true,
    financialViewDash: isAdmin,
    crmView: true,
    crmEditContacts: true,
  };
};

const normalizePermissions = (value, fallbackRole = "") => {
  const defaults = buildDefaultPermissions(fallbackRole);
  if (!value || typeof value !== "object") {
    return defaults;
  }
  return { ...defaults, ...value };
};

function AdminRoles() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [detailUser, setDetailUser] = useState(null);
  const [detailRole, setDetailRole] = useState("Staff");
  const [detailPermissions, setDetailPermissions] = useState({});
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState("");
  const [permissionError, setPermissionError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteForm, setInviteForm] = useState({ firstName: "", lastName: "", role: "Staff", password: "" });
  const [openMenu, setOpenMenu] = useState(null);
  const inviteDirty = inviteOpen && Boolean(
    inviteForm.firstName || inviteForm.lastName || inviteForm.password || inviteForm.role !== "Staff"
  );
  const permissionDirty = Boolean(
    detailUser &&
    (detailRole !== (detailUser.role || "Staff") ||
      JSON.stringify(detailPermissions) !==
        JSON.stringify(normalizePermissions(detailUser.permissions, detailUser.role)))
  );
  useUnsavedChanges((inviteDirty && !inviteSaving) || (permissionDirty && !permissionSaving));
  const openDetailModal = (user) => {
    setOpenMenu(null);
    setDetailUser(user);
    setDetailRole(user.role || "Staff");
    setPermissionStatus("");
    setPermissionError("");
  };

  const togglePermission = (key) => {
    setDetailPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const { user: authUser } = useAuth();
  const normalizedAuthEmail = (authUser?.email || "").toLowerCase();
  const isSystemAdmin = normalizedAuthEmail === SYSTEM_ADMIN_EMAIL;

  useEffect(() => {
    setDetailPermissions(normalizePermissions(detailUser?.permissions, detailUser?.role));
  }, [detailUser?.id, detailUser?.permissions, detailUser?.role]);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await reebsApiResponse("/api/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load users");
      const list = Array.isArray(data) ? data : [];
      setUsers(
        [...list].sort((a, b) => {
          const nameA = (a.fullName || a.name || `${a.firstName || ""} ${a.lastName || ""}` || "").toLowerCase();
          const nameB = (b.fullName || b.name || `${b.firstName || ""} ${b.lastName || ""}` || "").toLowerCase();
          return nameA.localeCompare(nameB);
        })
      );
    } catch (err) {
      console.error("Failed to fetch users", err);
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!openMenu) return undefined;

    const closeMenu = () => setOpenMenu(null);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [openMenu]);

  const roleSummary = useMemo(() => {
    const counts = new Map();
    users.forEach((entry) => {
      const roleKey = normalizeRoleKey(entry.role) || "unassigned";
      counts.set(roleKey, (counts.get(roleKey) || 0) + 1);
    });

    const orderedKeys = [
      ...ROLE_OPTIONS.map((option) => normalizeRoleKey(option)),
      ...Array.from(counts.keys())
        .filter((key) => !ROLE_OPTIONS.some((option) => normalizeRoleKey(option) === key))
        .sort(),
    ];

    return orderedKeys
      .filter((key, index, array) => array.indexOf(key) === index && counts.has(key))
      .map((key) => ({
        key,
        label: formatRoleLabel(key),
        count: counts.get(key) || 0,
        colorClass: roleColors[key] || "blue",
      }));
  }, [users]);

  const roleFilterOptions = useMemo(() => {
    const knownKeys = new Set(ROLE_OPTIONS.map((option) => normalizeRoleKey(option)));
    const extras = [...new Set(users.map((entry) => normalizeRoleKey(entry.role)).filter(Boolean))]
      .filter((key) => !knownKeys.has(key))
      .sort();

    return [
      ...ROLE_OPTIONS.map((option) => ({
        key: normalizeRoleKey(option),
        label: option,
      })),
      ...extras.map((key) => ({
        key,
        label: formatRoleLabel(key),
      })),
    ];
  }, [users]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users
      .filter((user) => {
        if (roleFilter !== "all" && normalizeRoleKey(user.role) !== roleFilter) return false;
        if (!needle) return true;
        const name = (user.fullName || user.name || `${user.firstName || ""} ${user.lastName || ""}` || "").toLowerCase();
        return (
          name.includes(needle) ||
          (user.email || "").toLowerCase().includes(needle) ||
          (user.role || "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        const nameA = (a.fullName || a.name || `${a.firstName || ""} ${a.lastName || ""}` || "").toLowerCase();
        const nameB = (b.fullName || b.name || `${b.firstName || ""} ${b.lastName || ""}` || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [users, query, roleFilter]);

  const totalActiveSessions = useMemo(
    () => users.reduce((sum, entry) => sum + getSessionCount(entry.activeSessionCount), 0),
    [users]
  );

  const usersWithActiveSessions = useMemo(
    () => users.filter((entry) => getSessionCount(entry.activeSessionCount) > 0).length,
    [users]
  );

  const detailSessions = useMemo(
    () => (Array.isArray(detailUser?.sessions) ? detailUser.sessions : []),
    [detailUser?.sessions]
  );

  const openMenuUser = useMemo(
    () => users.find((entry) => entry.id === openMenu?.userId) || null,
    [users, openMenu?.userId]
  );

  const toggleUserMenu = (userId, event) => {
    event.stopPropagation();
    if (openMenu?.userId === userId) {
      setOpenMenu(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 196;
    const menuHeight = 156;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = Math.min(
      Math.max(12, rect.right - menuWidth),
      Math.max(12, viewportWidth - menuWidth - 12)
    );
    const shouldOpenUp = viewportHeight - rect.bottom < menuHeight && rect.top > menuHeight;
    const top = shouldOpenUp
      ? Math.max(12, rect.top - menuHeight - 8)
      : Math.min(Math.max(12, viewportHeight - menuHeight - 12), rect.bottom + 8);

    setOpenMenu({
      userId,
      top,
      left,
    });
  };

  const addUser = async (event) => {
    event.preventDefault();
    setInviteError("");
    setInviteSaving(true);
    try {
      const trimmedFirst = inviteForm.firstName.trim();
      const trimmedLast = inviteForm.lastName.trim();
      const trimmedPassword = inviteForm.password.trim();
      if (!trimmedFirst || !trimmedLast) {
        throw new Error("First and last name are required.");
      }
      if (!trimmedPassword) {
        throw new Error("Password is required.");
      }

      const validation = userAccessFormSchema.safeParse({
        firstName: trimmedFirst,
        lastName: trimmedLast,
        password: trimmedPassword,
        role: inviteForm.role,
      });
      if (!validation.success) {
        throw new Error(validationIssues(validation.error)[0]?.message || "User details are invalid.");
      }

      const res = await reebsApiResponse("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to invite user");
      setUsers((prev) => {
        const next = [data, ...prev];
        return next.sort((a, b) => {
          const nameA = (a.fullName || a.name || `${a.firstName || ""} ${a.lastName || ""}` || "").toLowerCase();
          const nameB = (b.fullName || b.name || `${b.firstName || ""} ${b.lastName || ""}` || "").toLowerCase();
          return nameA.localeCompare(nameB);
        });
      });
      setInviteOpen(false);
      setInviteForm({ firstName: "", lastName: "", role: "Staff", password: "" });
    } catch (err) {
      console.error("Invite failed", err);
      setInviteError(err.message || "Failed to invite user");
    } finally {
      setInviteSaving(false);
    }
  };

  const savePermissions = async () => {
    if (!detailUser) return;
    const targetUserId = detailUser.id;
    setPermissionSaving(true);
    setPermissionStatus("");
    setPermissionError("");
    try {
      const body = {
      id: targetUserId,
      firstName: detailUser.firstName || detailUser.fullName?.split(" ")?.[0] || "",
      lastName:
        detailUser.lastName || detailUser.fullName?.split(" ").slice(1).join(" ") || "",
      permissions: detailPermissions,
      };
      if (isSystemAdmin) {
        body.role = detailRole;
      }
      const response = await reebsApiResponse("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to save permissions");
      setUsers((prev) =>
        prev.map((user) => (user.id === data.id ? { ...user, ...data } : user))
      );
      setDetailUser((prev) => (prev?.id === data.id ? { ...prev, ...data } : prev));
      setDetailRole(data.role || detailRole);
      setDetailPermissions(normalizePermissions(data.permissions, data.role || detailRole));
      setPermissionStatus("Permissions saved.");
    } catch (err) {
      console.error("Permission save failed", err);
      setPermissionError(err.message || "Failed to save permissions.");
    } finally {
      setPermissionSaving(false);
    }
  };

  return (
    <div className="roles-page">
      <div className="roles-shell">
        <AdminBreadcrumb items={[{ label: "Users & Permissions" }]} />

        <AdminPageHeader
          eyebrow="Security Command Center"
          title="Users & Permissions"
          subtitle="Monitor access, roles, and active sessions across your portal."
          actionsClassName="admin-header-actions roles-actions"
          actions={
            <>
              <button type="button" className="bookings-secondary" onClick={fetchUsers}>
                Refresh
              </button>
              <button
                type="button"
                className="bookings-primary"
                onClick={() => {
                  setInviteError("");
                  setInviteForm({ firstName: "", lastName: "", role: "Staff", password: "" });
                  setInviteOpen(true);
                }}
              >
                Add user
              </button>
            </>
          }
        />

        <section className="roles-kpis">
          <div className="glass-card roles-card">
            <p className="roles-label">Total users</p>
            <h3>{users.length}</h3>
            <p className="roles-sub">People with access</p>
          </div>
          <div className="glass-card roles-card">
            <p className="roles-label">Active sessions</p>
            <h3>{loading ? "..." : totalActiveSessions}</h3>
            <p className="roles-sub">
              {loading
                ? "Checking live sessions"
                : usersWithActiveSessions
                  ? `${usersWithActiveSessions} user${usersWithActiveSessions === 1 ? "" : "s"} signed in`
                  : "No signed-in users"}
            </p>
          </div>
          <div className="glass-card roles-card">
            <p className="roles-label">Role distribution</p>
            <div className="roles-legend">
              {roleSummary.map((role) => (
                <span key={role.key} className={`pill ${role.colorClass}`}>
                  {role.label} {role.count}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="glass-card roles-panel">
          <div className="roles-panel-head">
            <div>
              <p className="roles-label">User management</p>
              <h3>User directory</h3>
              <p className="roles-sub">Edit permissions, reset credentials, or deactivate portal access.</p>
            </div>
            <div className="roles-filters">
              <label className="roles-search">
                <span>Search</span>
                <SearchField
                  placeholder="Name, email, role"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onClear={() => setQuery("")}
                  aria-label="Search team directory"
                />
              </label>
              <label className="roles-filter">
                Role
                <SelectField
                  value={roleFilter}
                  onChangeValue={(nextValue) => setRoleFilter(String(nextValue))}
                  ariaLabel="Filter by role"
                >
                  <option value="all">All</option>
                  {roleFilterOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </label>
              <div className="roles-count">
                {query || roleFilter !== "all"
                  ? `${filteredUsers.length} match${filteredUsers.length === 1 ? "" : "es"} · ${users.length} total`
                  : `${users.length} total`}
              </div>
            </div>
          </div>

          {loading && (
            <AnimatedLoadingState
              compact
              className="glass-card admin-module-loading"
              title="Loading users"
              message="Preparing roles, sessions, and permission groups."
              variant="dashboard"
            />
          )}
          {!loading && error && (
            <ERPFormNotice tone="danger" title="Roles unavailable" onDismiss={() => setError("")}>
              {error}
            </ERPFormNotice>
          )}
          {!loading && !error && (
            <div className="roles-table-wrapper">
          <table className="roles-table">
                <thead>
                  <tr>
                    <th className="table-row-index">#</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Last login</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, index) => {
                    const roleKey = normalizeRoleKey(user.role);
                    const menuOpen = openMenu?.userId === user.id;
                    return (
                        <tr key={user.id} onClick={() => openDetailModal(user)} className="roles-row">
                        <td className="table-row-index">{index}</td>
                        <td>
                          <div className="roles-user">
                            <strong>{user.fullName || user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed"}</strong>
                            <p className="roles-sub">{user.email}</p>
                            {getSessionCount(user.activeSessionCount) > 0 && (
                              <span className="roles-session-pill">
                                {getSessionCount(user.activeSessionCount)} active
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`pill ${roleColors[roleKey] ? roleColors[roleKey] : "blue"}`}>
                            {user.role || "Staff"}
                          </span>
                        </td>
                        <td>{formatDate(user.lastSessionAt || user.updatedAt || user.createdAt)}</td>
                        <td className="roles-actions-col" onClick={(e) => e.stopPropagation()}>
                          <div className="roles-menu">
                            <button
                              type="button"
                              className="roles-menu-trigger"
                              aria-haspopup="true"
                              aria-expanded={menuOpen}
                              onClick={(event) => toggleUserMenu(user.id, event)}
                            >
                              <AppIcon icon={faEllipsisVertical} />
                              <span>Actions</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredUsers.length && (
                    <tr>
                      <td colSpan={5} className="roles-empty">{users.length ? "No matches found." : "No users yet."}</td>
                    </tr>
                  )}
                </tbody>
                {filteredUsers.length > 0 && (
                  <tfoot className="admin-table-footer">
                    <tr>
                      <td className="admin-table-summary-cell is-count">
                        <span className="admin-table-summary-value">{filteredUsers.length} users</span>
                      </td>
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>
      </div>

      {openMenu && openMenuUser && (
        <>
          <div
            className="roles-menu-backdrop"
            aria-hidden="true"
            onClick={() => setOpenMenu(null)}
          />
          <div
            className="roles-menu-list roles-menu-list--floating"
            style={{
              top: `${openMenu.top}px`,
              left: `${openMenu.left}px`,
            }}
          >
            <button
              type="button"
              onClick={() => {
                openDetailModal(openMenuUser);
                setOpenMenu(null);
              }}
            >
              Edit permissions
            </button>
            <button type="button" onClick={() => setOpenMenu(null)}>
              Reset password
            </button>
            <button type="button" className="danger" onClick={() => setOpenMenu(null)}>
              Deactivate
            </button>
          </div>
        </>
      )}

      {inviteOpen && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel">
            <header>
              <div>
                <p className="customers-eyebrow">New user</p>
                <h2>Invite teammate</h2>
              </div>
              <button
                type="button"
                className="customers-modal-close"
                onClick={() => setInviteOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <form className="customers-form" onSubmit={addUser}>
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
                Login email (auto)
                <input type="text" value={generateEmailFromNames(inviteForm.firstName, inviteForm.lastName)} readOnly />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                />
              </label>
              <label>
                Role
                <SelectField
                  value={inviteForm.role}
                  onChangeValue={(nextValue) => setInviteForm((prev) => ({ ...prev, role: String(nextValue) }))}
                  ariaLabel="Invite role"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectField>
              </label>
              {inviteError && (
                <ERPFormNotice tone="danger" title="Invite failed" onDismiss={() => setInviteError("")}>
                  {inviteError}
                </ERPFormNotice>
              )}
              <div className="customers-form-actions">
                <button type="button" className="customers-secondary" onClick={() => setInviteOpen(false)} disabled={inviteSaving}>
                  Cancel
                </button>
                <button type="submit" className="customers-primary" disabled={inviteSaving}>
                  {inviteSaving ? "Inviting..." : "Invite user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailUser && (
        <div className="customers-modal" role="dialog" aria-modal="true">
          <div className="customers-modal-panel roles-detail">
            <header>
              <div>
                <p className="customers-eyebrow">Permissions</p>
                <h2>{detailUser.fullName || detailUser.name || [detailUser.firstName, detailUser.lastName].filter(Boolean).join(" ") || "User"}</h2>
                 <p className="roles-sub">{detailUser.email}</p>
                <label className="roles-detail-role">
                  Role
                  <SelectField
                    value={detailRole}
                    onChangeValue={(nextValue) => setDetailRole(String(nextValue))}
                    disabled={!isSystemAdmin}
                    ariaLabel="User role"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </SelectField>
                  {!isSystemAdmin && (
                    <p className="roles-note">Only the system administrator can change roles.</p>
                  )}
                </label>
                {permissionStatus && (
                  <ERPFormNotice tone="success" title="Permissions saved" onDismiss={() => setPermissionStatus("")}>
                    {permissionStatus}
                  </ERPFormNotice>
                )}
                {permissionError && (
                  <ERPFormNotice tone="danger" title="Permissions not saved" onDismiss={() => setPermissionError("")}>
                    {permissionError}
                  </ERPFormNotice>
                )}
              </div>
              <button
                type="button"
                className="customers-modal-close"
                onClick={() => setDetailUser(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="roles-matrix">
              <div className="roles-matrix-row">
                <span>Inventory</span>
                <div className="roles-matrix-perms">
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(detailPermissions.inventoryView)}
                      onChange={() => togglePermission("inventoryView")}
                    />
                    View
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(detailPermissions.inventoryEdit)}
                      onChange={() => togglePermission("inventoryEdit")}
                    />
                    Edit
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(detailPermissions.inventoryAdjustStock)}
                      onChange={() => togglePermission("inventoryAdjustStock")}
                    />
                    Adjust stock
                  </label>
                </div>
              </div>
              <div className="roles-matrix-row">
                <span>Bookings</span>
                <div className="roles-matrix-perms">
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(detailPermissions.bookingsView)}
                      onChange={() => togglePermission("bookingsView")}
                    />
                    View
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(detailPermissions.bookingsCreate)}
                      onChange={() => togglePermission("bookingsCreate")}
                    />
                    Create
                  </label>
                </div>
              </div>
              <div className="roles-matrix-row">
                <span>Financials</span>
                <div className="roles-matrix-perms">
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(detailPermissions.financialViewDash)}
                      onChange={() => togglePermission("financialViewDash")}
                    />
                    View dashboards
                  </label>
                </div>
              </div>
              <div className="roles-matrix-row">
                <span>CRM</span>
                <div className="roles-matrix-perms">
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(detailPermissions.crmView)}
                      onChange={() => togglePermission("crmView")}
                    />
                    View
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(detailPermissions.crmEditContacts)}
                      onChange={() => togglePermission("crmEditContacts")}
                    />
                    Edit contacts
                  </label>
                </div>
              </div>
            </div>
            <section className="glass-card roles-session-panel">
              <div className="roles-session-summary">
                <div>
                  <p className="roles-label">Active sessions</p>
                  <h3>{getSessionCount(detailUser.activeSessionCount)}</h3>
                  <p className="roles-sub">
                    {getSessionCount(detailUser.activeSessionCount) > detailSessions.length
                      ? `Showing the latest ${detailSessions.length} active sessions.`
                      : getSessionCount(detailUser.activeSessionCount) > 0
                        ? "Live sign-ins linked to this user."
                        : "No active sessions right now."}
                  </p>
                </div>
              </div>
              {detailSessions.length > 0 && (
                <div className="roles-session-list">
                  {detailSessions.map((session, index) => (
                    <div
                      key={session.id || `${detailUser.id}-session-${index}`}
                      className="roles-session-item"
                    >
                      <div className="roles-session-copy">
                        <strong className="roles-session-device">
                          {describeSessionDevice(session.userAgent)}
                        </strong>
                        <p className="roles-session-meta">
                          {session.ipAddress ? `IP ${session.ipAddress}` : "IP unavailable"}
                          {session.remember ? " · Remembered sign-in" : " · Session-only sign-in"}
                        </p>
                      </div>
                      <div className="roles-session-times">
                        <span>{formatRelativeTime(session.lastSeenAt || session.createdAt)}</span>
                        <span>Expires {formatDate(session.expiresAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
              <div className="customers-form-actions">
                <button type="button" className="customers-secondary" onClick={() => setDetailUser(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className="customers-primary"
                  onClick={savePermissions}
                  disabled={permissionSaving}
                >
                  {permissionSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminRoles;
