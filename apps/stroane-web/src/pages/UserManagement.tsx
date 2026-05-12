import React, { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import "../styles/pages/UserManagement.css";

interface SiteUser {
  id: string;
  username: string;
  role: "ADMIN" | "VIEWER";
  isActive: boolean;
  createdAt: string;
  createdBy: { username: string } | null;
}

const BASE_URL = (import.meta.env.VITE_BACKEND_BASE_URL as string) ?? "";

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<SiteUser[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loadingList, setLoadingList] = useState(true);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "VIEWER">("VIEWER");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "ADMIN") {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${user?.token ?? ""}`,
  };

  const fetchUsers = async () => {
    setLoadingList(true);
    setLoadError("");
    try {
      const res = await fetch(`${BASE_URL}/api/auth/users`, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json() as { users: SiteUser[] };
      setUsers(data.users);
    } catch {
      setLoadError("Could not load users. Please try again.");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") void fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const res = await fetch(`${BASE_URL}/api/auth/users`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create user");
      } else {
        setCreateSuccess(`User "${newUsername}" created successfully.`);
        setNewUsername("");
        setNewPassword("");
        setNewRole("VIEWER");
        void fetchUsers();
      }
    } catch {
      setCreateError("Network error — could not create user.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/users/${id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isActive: !isActive } : u)));
    } catch {
      alert("Failed to update user status.");
    }
  };

  if (!user || user.role !== "ADMIN") return null;

  return (
    <Layout>
      <div className="user-mgmt">
        <div className="user-mgmt__header">
          <h1 className="user-mgmt__title">User Management</h1>
          <p className="user-mgmt__sub">Create and manage site access accounts.</p>
        </div>

        {/* Create user form */}
        <section className="user-mgmt__section">
          <h2 className="user-mgmt__section-title">Create New User</h2>
          <form className="user-mgmt__form" onSubmit={handleCreate} noValidate>
            <div className="user-mgmt__row">
              <div className="user-mgmt__field">
                <label className="user-mgmt__label" htmlFor="new-username">Username</label>
                <input
                  id="new-username"
                  type="text"
                  className="user-mgmt__input"
                  value={newUsername}
                  onChange={(e) => { setNewUsername(e.target.value); setCreateError(""); setCreateSuccess(""); }}
                  autoComplete="off"
                  required
                />
              </div>

              <div className="user-mgmt__field">
                <label className="user-mgmt__label" htmlFor="new-password">Password</label>
                <input
                  id="new-password"
                  type="password"
                  className="user-mgmt__input"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setCreateError(""); setCreateSuccess(""); }}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="user-mgmt__field user-mgmt__field--role">
                <label className="user-mgmt__label" htmlFor="new-role">Role</label>
                <select
                  id="new-role"
                  className="user-mgmt__select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "ADMIN" | "VIEWER")}
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            {createError && <p className="user-mgmt__msg user-mgmt__msg--error">{createError}</p>}
            {createSuccess && <p className="user-mgmt__msg user-mgmt__msg--success">{createSuccess}</p>}

            <button
              type="submit"
              className="user-mgmt__btn"
              disabled={creating || !newUsername || !newPassword}
            >
              {creating ? "Creating…" : "Create User"}
            </button>
          </form>
        </section>

        {/* Users list */}
        <section className="user-mgmt__section">
          <h2 className="user-mgmt__section-title">All Users</h2>

          {loadingList && <p className="user-mgmt__loading">Loading…</p>}
          {loadError && <p className="user-mgmt__msg user-mgmt__msg--error">{loadError}</p>}

          {!loadingList && !loadError && (
            <div className="user-mgmt__table-wrap">
              <table className="user-mgmt__table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created by</th>
                    <th>Joined</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={!u.isActive ? "user-mgmt__row--inactive" : ""}>
                      <td className="user-mgmt__name">{u.username}</td>
                      <td>
                        <span className={`user-mgmt__role-badge user-mgmt__role-badge--${u.role.toLowerCase()}`}>
                          {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`user-mgmt__status${u.isActive ? " user-mgmt__status--active" : " user-mgmt__status--inactive"}`}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="user-mgmt__meta">{u.createdBy?.username ?? "—"}</td>
                      <td className="user-mgmt__meta">
                        {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td>
                        {u.id !== user.id && (
                          <button
                            type="button"
                            className={`user-mgmt__toggle${u.isActive ? " user-mgmt__toggle--deactivate" : " user-mgmt__toggle--activate"}`}
                            onClick={() => void handleToggle(u.id, u.isActive)}
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default UserManagement;
