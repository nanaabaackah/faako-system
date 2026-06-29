import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  HiOutlineKey,
  HiOutlineRefresh,
  HiOutlineShieldCheck,
  HiOutlineUserAdd,
  HiOutlineUsers,
} from "react-icons/hi";
import {
  ERPFormNotice,
  ERPPrimaryAction,
  ERPSecondaryAction,
  ERPSelectField,
  ERPStatusBadge,
  ERPTextareaField,
  ERPTextField,
} from "@faako/ui";
import { portalUrl } from "../../config/appSurface";
import useSEOMeta from "../../hooks/useSEOMeta";
import {
  ADMIN_ROLE_ACTIONS,
  ADMIN_ROLE_MODULES,
  adminSessionApi,
  normalizeRolePermissions,
  type AdminRole,
  type AdminRoleAction,
  type AdminRoleDefinition,
  type AdminRoleModule,
  type AdminRolePermissions,
  type AdminTeamUser,
  type AdminUpdateUserPayload,
} from "../api/adminSession";
import { useAdminPortal } from "../context/AdminPortalContext";
import "../styles/AdminPortal.css";

const EMPTY_USER_DRAFT = {
  username: "",
  password: "",
  roleKey: "VIEWER",
};

const MODULE_LABELS: Record<AdminRoleModule, string> = {
  dashboard: "Dashboard",
  orders: "Orders",
  receipts: "Receipts",
  accounting: "Accounting",
  crm: "CRM",
  inventory: "Inventory",
  team: "Team",
  profile: "Profile",
};

const ACTION_LABELS: Record<AdminRoleAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  archive: "Archive",
  manage: "Manage",
};

const CUSTOM_ROLE_MODULES = ADMIN_ROLE_MODULES.filter(
  (moduleId): moduleId is Exclude<AdminRoleModule, "team"> => moduleId !== "team"
);

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{1,50}$/;
const ROLE_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,48}[a-z0-9]$/;

const createDefaultCustomPermissions = (): AdminRolePermissions =>
  normalizeRolePermissions(null, "VIEWER");

const createEmptyRoleDraft = () => ({
  key: "",
  name: "",
  description: "",
  permissions: createDefaultCustomPermissions(),
});

const formatDate = (value?: string) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getRoleTone = (role: AdminRole): "neutral" | "success" | "warning" | "danger" | "info" => {
  if (role === "ADMIN") return "danger";
  if (role === "OWNER") return "success";
  if (role === "CUSTOM") return "warning";
  return "neutral";
};

const normalizeRoleKeyInput = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getRoleDisplayName = (
  user: AdminTeamUser,
  roleByKey: Map<string, AdminRoleDefinition>
) => user.roleLabel || roleByKey.get(user.roleKey || user.role)?.name || user.roleKey || user.role;

const TeamManagement: React.FC = () => {
  const { session } = useAdminPortal();
  const [users, setUsers] = useState<AdminTeamUser[]>([]);
  const [roles, setRoles] = useState<AdminRoleDefinition[]>([]);
  const [userDraft, setUserDraft] = useState(EMPTY_USER_DRAFT);
  const [roleDraft, setRoleDraft] = useState(createEmptyRoleDraft);
  const [loading, setLoading] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useSEOMeta({
    title: "Team | Stroane operations",
    description: "Invite and manage Stroane portal users and role-based access.",
    canonical: portalUrl("/admin/team"),
    noIndex: true,
  });

  const activeUsers = useMemo(() => users.filter((user) => user.isActive).length, [users]);
  const elevatedUsers = useMemo(
    () => users.filter((user) => (user.role === "ADMIN" || user.role === "OWNER") && user.isActive).length,
    [users]
  );
  const customRoleCount = useMemo(
    () => roles.filter((role) => !role.isSystem && role.isActive).length,
    [roles]
  );
  const activeRoles = useMemo(() => roles.filter((role) => role.isActive), [roles]);
  const roleByKey = useMemo(
    () => new Map(activeRoles.map((role) => [role.key, role])),
    [activeRoles]
  );
  const roleOptions = useMemo(
    () =>
      activeRoles.map((role) => ({
        value: role.key,
        label: role.isSystem ? role.name : `${role.name} (custom)`,
      })),
    [activeRoles]
  );

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextUsers, nextRoles] = await Promise.all([
        adminSessionApi.listUsers(),
        adminSessionApi.listRoles(),
      ]);
      setUsers(nextUsers);
      setRoles(nextRoles);
      setUserDraft((current) => ({
        ...current,
        roleKey: nextRoles.some((role) => role.key === current.roleKey) ? current.roleKey : "VIEWER",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load portal users and roles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const validateUserDraft = () => {
    const username = userDraft.username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) {
      return "Username must be 1-50 characters using letters, numbers, . _ - only.";
    }
    if (userDraft.password.length < 8 || userDraft.password.length > 100) {
      return "Password must be 8-100 characters.";
    }
    if (!roleByKey.has(userDraft.roleKey)) {
      return "Choose an active role for this user.";
    }
    return "";
  };

  const validateRoleDraft = () => {
    const name = roleDraft.name.trim();
    const key = normalizeRoleKeyInput(roleDraft.key);
    if (!name || name.length > 80) return "Role name must be 1-80 characters.";
    if (roleDraft.description.trim().length > 240) return "Role description must be 240 characters or fewer.";
    if (key && !ROLE_KEY_PATTERN.test(key)) {
      return "Role key must be 3-50 characters using lowercase letters, numbers, _ or -.";
    }
    if (key && roleByKey.has(key)) return "That role key already exists.";
    return "";
  };

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    setNotice("");
    setError("");

    const validationMessage = validateUserDraft();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setCreatingUser(true);
    try {
      const user = await adminSessionApi.createUser({
        username: userDraft.username.trim().toLowerCase(),
        password: userDraft.password,
        roleKey: userDraft.roleKey,
      });
      setUsers((current) => [user, ...current.filter((item) => item.id !== user.id)]);
      setUserDraft(EMPTY_USER_DRAFT);
      setNotice(`${user.username} can now sign in to the Stroane portal.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create portal user.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateRole = async (event: FormEvent) => {
    event.preventDefault();
    setNotice("");
    setError("");

    const validationMessage = validateRoleDraft();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setCreatingRole(true);
    try {
      const role = await adminSessionApi.createRole({
        key: normalizeRoleKeyInput(roleDraft.key) || undefined,
        name: roleDraft.name.trim(),
        description: roleDraft.description.trim() || undefined,
        permissions: roleDraft.permissions,
      });
      setRoles((current) => [...current.filter((item) => item.id !== role.id), role]);
      setRoleDraft(createEmptyRoleDraft());
      setNotice(`${role.name} is available for new and existing users.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create portal role.");
    } finally {
      setCreatingRole(false);
    }
  };

  const updateUser = async (user: AdminTeamUser, payload: AdminUpdateUserPayload) => {
    setNotice("");
    setError("");
    setUpdatingUserId(user.id);
    try {
      const updated = await adminSessionApi.updateUser(user.id, payload);
      setUsers((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setNotice(`${updated.username} was updated.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update portal user.");
    } finally {
      setUpdatingUserId("");
    }
  };

  const updatePermission = (moduleId: AdminRoleModule, action: AdminRoleAction, checked: boolean) => {
    if (moduleId === "team") return;
    setRoleDraft((current) => {
      const permissions = normalizeRolePermissions(current.permissions, "VIEWER");
      permissions[moduleId][action] = checked;
      if (checked && action !== "view") permissions[moduleId].view = true;
      if (!checked && action === "view") {
        ADMIN_ROLE_ACTIONS.forEach((nextAction) => {
          permissions[moduleId][nextAction] = false;
        });
      }
      permissions.profile.view = true;
      return { ...current, permissions };
    });
  };

  return (
    <section className="stroane-team">
      <header className="stroane-team__head">
        <div>
          <span>Portal access</span>
          <h1>Team and roles</h1>
          <p>Create users, assign system roles, and add custom read/write roles as the portal grows.</p>
        </div>
        <ERPSecondaryAction
          type="button"
          icon={<HiOutlineRefresh aria-hidden="true" />}
          onClick={() => void loadTeam()}
          disabled={loading}
        >
          {loading ? "Refreshing" : "Refresh"}
        </ERPSecondaryAction>
      </header>

      {notice ? (
        <ERPFormNotice tone="success" title="Team updated" onDismiss={() => setNotice("")}>
          {notice}
        </ERPFormNotice>
      ) : null}
      {error ? (
        <ERPFormNotice tone="warning" title="Team update" onDismiss={() => setError("")}>
          {error}
        </ERPFormNotice>
      ) : null}

      <div className="stroane-team__stats" aria-label="Team overview">
        <article>
          <span><HiOutlineUsers aria-hidden="true" /> Users</span>
          <strong>{users.length}</strong>
          <small>{activeUsers} active</small>
        </article>
        <article>
          <span><HiOutlineShieldCheck aria-hidden="true" /> Admins and owners</span>
          <strong>{elevatedUsers}</strong>
          <small>Full-access users</small>
        </article>
        <article>
          <span><HiOutlineKey aria-hidden="true" /> Custom roles</span>
          <strong>{customRoleCount}</strong>
          <small>Configurable access profiles</small>
        </article>
      </div>

      <div className="stroane-team__layout">
        <form className="glass-card stroane-team__create" onSubmit={handleCreateUser}>
          <div className="stroane-team__section-head">
            <span><HiOutlineUserAdd aria-hidden="true" /> New portal user</span>
            <h2>Create access</h2>
          </div>

          <ERPTextField
            label="Username"
            value={userDraft.username}
            onChange={(event) => setUserDraft((current) => ({ ...current, username: event.target.value }))}
            autoComplete="username"
            placeholder="team.member"
          />
          <ERPTextField
            label="Temporary password"
            type="password"
            value={userDraft.password}
            onChange={(event) => setUserDraft((current) => ({ ...current, password: event.target.value }))}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <ERPSelectField
            label="Role"
            value={userDraft.roleKey}
            onChange={(event) => setUserDraft((current) => ({ ...current, roleKey: event.target.value }))}
            options={roleOptions}
            disabled={!roleOptions.length}
          />

          <ERPPrimaryAction type="submit" icon={<HiOutlineUserAdd aria-hidden="true" />} disabled={creatingUser}>
            {creatingUser ? "Creating user" : "Create user"}
          </ERPPrimaryAction>
        </form>

        <form className="glass-card stroane-team__role-builder" onSubmit={handleCreateRole}>
          <div className="stroane-team__section-head">
            <span><HiOutlineKey aria-hidden="true" /> Custom role</span>
            <h2>Create role</h2>
          </div>

          <div className="stroane-team__role-fields">
            <ERPTextField
              label="Role Name"
              value={roleDraft.name}
              onChange={(event) => setRoleDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Inventory coordinator"
            />
          </div>
          <ERPTextareaField
            label="Description"
            value={roleDraft.description}
            onChange={(event) => setRoleDraft((current) => ({ ...current, description: event.target.value }))}
            rows={3}
            placeholder="What this role should be able to do."
          />

          <div className="stroane-team__permission-matrix" aria-label="Custom role permissions">
            <div className="stroane-team__permission-head">
              <strong>Module</strong>
              <span>Allowed actions</span>
            </div>
            {CUSTOM_ROLE_MODULES.map((moduleId) => (
              <div key={moduleId} className="stroane-team__permission-row">
                <strong>{MODULE_LABELS[moduleId]}</strong>
                <div>
                  {ADMIN_ROLE_ACTIONS.map((action) => {
                    const checked = roleDraft.permissions[moduleId][action];
                    const locked = moduleId === "profile" && action === "view";
                    return (
                      <label key={action} className={checked ? "is-checked" : ""}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked}
                          onChange={(event) => updatePermission(moduleId, action, event.target.checked)}
                        />
                        <span>{ACTION_LABELS[action]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <ERPPrimaryAction type="submit" icon={<HiOutlineShieldCheck aria-hidden="true" />} disabled={creatingRole}>
            {creatingRole ? "Creating role" : "Create role"}
          </ERPPrimaryAction>
        </form>
      </div>

      <section className="glass-card stroane-team__list" aria-labelledby="stroane-team-list-heading">
        <div className="stroane-team__section-head">
          <span><HiOutlineShieldCheck aria-hidden="true" /> Current access</span>
          <h2 id="stroane-team-list-heading">Portal users</h2>
        </div>

        <div className="stroane-team__table-wrap">
          <table className="stroane-team__table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === session?.id;
                const isUpdating = updatingUserId === user.id;
                const userRoleKey = user.roleKey || user.role;
                return (
                  <tr key={user.id}>
                    <td data-label="User">
                      <strong>{user.username}</strong>
                      {user.createdBy?.username ? <small>Created by {user.createdBy.username}</small> : null}
                    </td>
                    <td data-label="Role">
                      <div className="stroane-team__role-cell">
                        <ERPStatusBadge tone={getRoleTone(user.role)}>{getRoleDisplayName(user, roleByKey)}</ERPStatusBadge>
                        <ERPSelectField
                          value={userRoleKey}
                          onChange={(event) => void updateUser(user, { roleKey: event.target.value })}
                          options={roleOptions}
                          disabled={isSelf || isUpdating}
                          aria-label={`Role for ${user.username}`}
                        />
                      </div>
                    </td>
                    <td data-label="Status">
                      <ERPStatusBadge tone={user.isActive ? "success" : "danger"}>
                        {user.isActive ? "Active" : "Disabled"}
                      </ERPStatusBadge>
                    </td>
                    <td data-label="Created">{formatDate(user.createdAt)}</td>
                    <td data-label="Actions">
                      <div className="stroane-team__row-actions">
                        <button
                          type="button"
                          onClick={() => void updateUser(user, { isActive: !user.isActive })}
                          disabled={isSelf || isUpdating}
                        >
                          {user.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!users.length && !loading ? (
                <tr>
                  <td colSpan={5}>No portal users found.</td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={5}>Loading portal users...</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};

export default TeamManagement;
