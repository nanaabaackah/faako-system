import React, { useState, type FormEvent } from "react";
import { HiOutlineLockClosed } from "react-icons/hi";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminPortal } from "../context/AdminPortalContext";
import useSEOMeta from "../hooks/useSEOMeta";
import "../styles/pages/AdminPortal.css";

const getAdminRedirect = (state: unknown) => {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== "string" || !from.startsWith("/admin") || from === "/admin/signin") {
    return "/admin";
  }
  return from;
};

const AdminPortalSignIn: React.FC = () => {
  const { session, signIn } = useAdminPortal();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useSEOMeta({
    title: "Operations sign in | Stroane",
    description: "Private Stroane operations portal sign in.",
    canonical: "https://stroanesolutions.com/admin/signin",
    noIndex: true,
  });

  if (session) return <Navigate to="/admin" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn(username, password);
      navigate(getAdminRedirect(location.state), { replace: true });
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="stroane-portal-login">
      <div className="stroane-portal-login__panel">
        <span className="stroane-portal-login__kicker">
          <HiOutlineLockClosed aria-hidden="true" />
          Internal access
        </span>
        <h1>Stroane operations</h1>
        <p>Sign in with a staff account to manage private operational work.</p>
        <form className="stroane-portal-login__form" onSubmit={handleSubmit}>
          <label>
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="stroane-portal-login__error" role="alert">{error}</p> : null}
          <button type="submit" disabled={loading || !username || !password}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <Link className="stroane-portal-login__back" to="/">
          Return to storefront
        </Link>
      </div>
    </main>
  );
};

export default AdminPortalSignIn;
