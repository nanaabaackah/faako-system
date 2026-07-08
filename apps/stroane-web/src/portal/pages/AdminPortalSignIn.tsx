import React, { useState, type FormEvent } from "react";
import { HiOutlineLockClosed } from "react-icons/hi";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminPortal } from "../context/AdminPortalContext";
import { STOREFRONT_BASE_URL, portalUrl } from "../../config/appSurface";
import useSEOMeta from "../../hooks/useSEOMeta";
import "../styles/AdminPortal.css";

const getAdminRedirect = (state: unknown) => {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== "string" || !from.startsWith("/admin") || from === "/admin/signin") {
    return "/admin";
  }
  return from;
};

type AdminSignInFieldErrors = Partial<Record<"username" | "password", string>>;

const RequiredMark = () => (
  <>
    <span className="stroane-portal-login__required" aria-hidden="true">
      *
    </span>
    <span className="sr-only">required</span>
  </>
);

const getFirstFieldError = (errors: AdminSignInFieldErrors) =>
  Object.values(errors).find(Boolean) || "";

const AdminPortalSignIn: React.FC = () => {
  const { session, signIn } = useAdminPortal();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AdminSignInFieldErrors>({});

  useSEOMeta({
    title: "Operations sign in | Stroane",
    description: "Private Stroane operations portal sign in.",
    canonical: portalUrl("/login"),
    noIndex: true,
  });

  if (session) return <Navigate to="/admin" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: AdminSignInFieldErrors = {};
    if (!username.trim()) nextErrors.username = "Enter your staff username.";
    if (!password) nextErrors.password = "Enter your password.";

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setError(getFirstFieldError(nextErrors));
      return;
    }

    setLoading(true);
    setError("");
    setFieldErrors({});
    try {
      await signIn(username.trim(), password);
      navigate(getAdminRedirect(location.state), { replace: true });
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="stroane-portal-login">
      <div className="stroane-portal-login__panel">
        <span className="stroane-portal-login__kicker">
          <HiOutlineLockClosed aria-hidden="true" />
          Internal access
        </span>
        <h1>Stroane operations</h1>
        <p>Sign in with a staff account to manage private operational work.</p>
        <form className="stroane-portal-login__form" onSubmit={handleSubmit} noValidate>
          <label className={fieldErrors.username ? "is-error" : ""}>
            <span>
              Username
              <RequiredMark />
            </span>
            <input
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError("");
                setFieldErrors((current) => {
                  if (!current.username) return current;
                  const next = { ...current };
                  delete next.username;
                  return next;
                });
              }}
              autoComplete="username"
              aria-invalid={fieldErrors.username ? "true" : undefined}
              aria-describedby={fieldErrors.username ? "admin-username-error" : undefined}
              required
            />
            {fieldErrors.username ? (
              <span className="stroane-portal-login__field-error" id="admin-username-error">
                {fieldErrors.username}
              </span>
            ) : null}
          </label>
          <label className={fieldErrors.password ? "is-error" : ""}>
            <span>
              Password
              <RequiredMark />
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
                setFieldErrors((current) => {
                  if (!current.password) return current;
                  const next = { ...current };
                  delete next.password;
                  return next;
                });
              }}
              autoComplete="current-password"
              aria-invalid={fieldErrors.password ? "true" : undefined}
              aria-describedby={fieldErrors.password ? "admin-password-error" : undefined}
              required
            />
            {fieldErrors.password ? (
              <span className="stroane-portal-login__field-error" id="admin-password-error">
                {fieldErrors.password}
              </span>
            ) : null}
          </label>
          {error ? <p className="stroane-portal-login__error" role="alert">{error}</p> : null}
          <button type="submit" disabled={loading || !username || !password}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <a className="stroane-portal-login__back" href={STOREFRONT_BASE_URL}>
          Return to storefront
        </a>
      </div>
    </section>
  );
};

export default AdminPortalSignIn;
