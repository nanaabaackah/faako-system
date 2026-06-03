import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { AnimatedLoadingState } from "@faako/ui";
import { apiGet, apiPatch, ApiError } from "../../api/client";
import { clearAuthStore, setAuthenticatedUser } from "../../auth/authStore";
import {
  readStoredSessionUser,
} from "../../utils/authSession";
import { formatDateTime } from "../../utils/formatters";

const PASSWORD_POLICY_HELP =
  "Password: at least 14 characters, with uppercase, lowercase, number, and special character (no spaces).";

const readLocalUser = () => readStoredSessionUser();

const buildFullName = (profile) => {
  const fullName = String(profile?.fullName || "").trim();
  if (fullName) return fullName;
  const firstName = String(profile?.firstName || "").trim();
  const lastName = String(profile?.lastName || "").trim();
  return `${firstName} ${lastName}`.trim() || "N/A";
};

const buildProfileFormState = (profile) => ({
  firstName: String(profile?.firstName || ""),
  lastName: String(profile?.lastName || ""),
  email: String(profile?.email || ""),
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const Profile = () => {
  const navigate = useNavigate();
  const initialLocalUser = useMemo(() => readLocalUser(), []);
  const [profile, setProfile] = useState(initialLocalUser);
  const [formState, setFormState] = useState(() => buildProfileFormState(initialLocalUser));
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loadProfile = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const payload = await apiGet("/api/users/me", {
          fallbackMessage: "Unable to load profile",
        });

        const currentLocalUser = readLocalUser();
        const nextLocalUser = {
          ...(currentLocalUser && typeof currentLocalUser === "object" ? currentLocalUser : {}),
          ...(payload && typeof payload === "object" ? payload : {}),
        };
        setAuthenticatedUser(nextLocalUser);
        setProfile(nextLocalUser);
        setFormState(buildProfileFormState(nextLocalUser));
        setLastLoadedAt(new Date().toISOString());
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          clearAuthStore();
          navigate("/login");
          return;
        }
        setError(requestError.message || "Unable to load profile");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const fullName = buildFullName(profile);
  const emailLabel = String(profile?.email || "").trim() || "N/A";
  const lastLoadedLabel = useMemo(
    () => (lastLoadedAt ? formatDateTime(lastLoadedAt) : "N/A"),
    [lastLoadedAt]
  );

  const hasPasswordInput =
    String(formState.currentPassword || "").trim() ||
    String(formState.newPassword || "").trim() ||
    String(formState.confirmPassword || "").trim();

  const hasIdentityChanges =
    formState.firstName.trim() !== String(profile?.firstName || "").trim() ||
    formState.lastName.trim() !== String(profile?.lastName || "").trim() ||
    formState.email.trim().toLowerCase() !== String(profile?.email || "").trim().toLowerCase();

  const isDirty = Boolean(hasIdentityChanges || hasPasswordInput);

  const handleFormField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    if (saveError) setSaveError("");
    if (saveNotice) setSaveNotice("");
  };

  const handleResetForm = () => {
    setFormState(buildProfileFormState(profile));
    setSaveError("");
    setSaveNotice("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    const firstName = formState.firstName.trim();
    const lastName = formState.lastName.trim();
    const email = formState.email.trim().toLowerCase();
    if (!firstName || !lastName) {
      setSaveError("First name and last name are required.");
      return;
    }
    if (!email) {
      setSaveError("Email is required.");
      return;
    }

    const currentPassword = String(formState.currentPassword || "").trim();
    const newPassword = String(formState.newPassword || "").trim();
    const confirmPassword = String(formState.confirmPassword || "").trim();
    const wantsPasswordChange = Boolean(currentPassword || newPassword || confirmPassword);

    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setSaveError("Provide current, new, and confirm password to change password.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setSaveError("New password and confirm password must match.");
        return;
      }
    }

    setSaveError("");
    setSaveNotice("");
    setIsSaving(true);

    try {
      const requestBody = {
        firstName,
        lastName,
        email,
      };
      if (wantsPasswordChange) {
        requestBody.currentPassword = currentPassword;
        requestBody.newPassword = newPassword;
      }

      const payload = await apiPatch("/api/users/me", requestBody, {
        fallbackMessage: "Unable to save profile",
      });
      const currentLocalUser = readLocalUser();
      const nextLocalUser = {
        ...(currentLocalUser && typeof currentLocalUser === "object" ? currentLocalUser : {}),
        ...(payload && typeof payload === "object" ? payload : {}),
      };
      setAuthenticatedUser(nextLocalUser);
      setProfile(nextLocalUser);
      setFormState(buildProfileFormState(nextLocalUser));
      setLastLoadedAt(new Date().toISOString());
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setSaveNotice(
        payload && typeof payload === "object" && payload.sessionUpdated
          ? "Profile updated. Session refreshed."
          : "Profile updated."
      );
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearAuthStore();
        navigate("/login");
        return;
      }
      const passwordPolicy =
        requestError instanceof ApiError &&
        requestError.payload &&
        typeof requestError.payload === "object" &&
        typeof requestError.payload.passwordPolicy === "string"
          ? requestError.payload.passwordPolicy
          : "";
      if (passwordPolicy) {
        setSaveError(`${requestError.message || "Unable to save profile"} ${passwordPolicy}`);
        return;
      }
      setSaveError(requestError.message || "Unable to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Profile</h1>
          <p className="muted">{profile?.email || "Signed-in account"}</p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => loadProfile({ silent: true })}
            disabled={loading || isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {loading ? (
        <AnimatedLoadingState compact className="panel" title="Loading profile" />
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="panel-grid">
        <article className="panel metric-card">
          <span className="kpi-label">Full name</span>
          <div className="kpi-value">{fullName}</div>
        </article>
        <article className="panel metric-card">
          <span className="kpi-label">Email</span>
          <div className="kpi-value">{emailLabel}</div>
        </article>
        <article className="panel metric-card">
          <span className="kpi-label">Profile sync</span>
          <div className="kpi-value">{lastLoadedLabel}</div>
        </article>
      </div>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Edit profile</h3>
            <p className="muted">Update your name, email, and password.</p>
          </div>
        </div>
        {saveError ? (
          <div className="notice is-error" role="alert">
            {saveError}
          </div>
        ) : null}
        {saveNotice ? (
          <div className="notice is-success" role="status">
            {saveNotice}
          </div>
        ) : null}

        <form className="stack" onSubmit={handleSaveProfile}>
          <label className="form-field">
            <span>First name</span>
            <input
              className="input"
              type="text"
              autoComplete="given-name"
              value={formState.firstName}
              onChange={(event) => handleFormField("firstName", event.target.value)}
              disabled={loading || isSaving}
            />
          </label>

          <label className="form-field">
            <span>Last name</span>
            <input
              className="input"
              type="text"
              autoComplete="family-name"
              value={formState.lastName}
              onChange={(event) => handleFormField("lastName", event.target.value)}
              disabled={loading || isSaving}
            />
          </label>

          <label className="form-field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={formState.email}
              onChange={(event) => handleFormField("email", event.target.value)}
              disabled={loading || isSaving}
            />
          </label>

          <label className="form-field">
            <span>Current password</span>
            <div className="password-input-inline">
              <input
                className="input"
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                value={formState.currentPassword}
                onChange={(event) => handleFormField("currentPassword", event.target.value)}
                disabled={loading || isSaving}
                placeholder="Leave blank if not changing password"
              />
              <button
                className="password-input-inline__toggle"
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
              >
                {showCurrentPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
              </button>
            </div>
          </label>

          <label className="form-field">
            <span>New password</span>
            <div className="password-input-inline">
              <input
                className="input"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={formState.newPassword}
                onChange={(event) => handleFormField("newPassword", event.target.value)}
                disabled={loading || isSaving}
              />
              <button
                className="password-input-inline__toggle"
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
              >
                {showNewPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
              </button>
            </div>
          </label>

          <label className="form-field">
            <span>Confirm new password</span>
            <div className="password-input-inline">
              <input
                className="input"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={formState.confirmPassword}
                onChange={(event) => handleFormField("confirmPassword", event.target.value)}
                disabled={loading || isSaving}
              />
              <button
                className="password-input-inline__toggle"
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                }
              >
                {showConfirmPassword ? (
                  <FiEyeOff aria-hidden="true" />
                ) : (
                  <FiEye aria-hidden="true" />
                )}
              </button>
            </div>
          </label>

          <p className="muted">{PASSWORD_POLICY_HELP}</p>

          <div className="header-actions">
            <button
              className="button button-ghost"
              type="button"
              onClick={handleResetForm}
              disabled={loading || isSaving || !isDirty}
            >
              Reset
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={loading || isSaving || !isDirty}
            >
              {isSaving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
};

export default Profile;
