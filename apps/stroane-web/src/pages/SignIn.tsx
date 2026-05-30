import React, { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Layout from "../components/Layout";
import useSEOMeta from "../hooks/useSEOMeta";
import { useAuth } from "../context/AuthContext";
import { adminOrderApi, storeAdminSession } from "../api/adminOrders";
import "../styles/pages/Auth.css";

const SignIn: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useSEOMeta({
    title: "Sign In | Stroane",
    description: "Sign in to your Stroane account.",
    canonical: "https://stroanesolutions.com/signin",
    noIndex: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn(identifier, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const customerError = err instanceof Error ? err.message : "";

      if (customerError !== "No account found for that email.") {
        setError(customerError || "Could not sign in.");
        setLoading(false);
        return;
      }

      try {
        const session = await adminOrderApi.login(identifier, password);
        storeAdminSession(session);
        navigate(redirectTo.startsWith("/admin/") ? redirectTo : "/admin/orders", {
          replace: true,
        });
      } catch {
        setError("No account matched those credentials.");
        setLoading(false);
      }
    }
  };

  return (
    <Layout>
      <div className="auth-page">
        <aside className="auth-visual" aria-hidden="true">
          <video
            className="auth-visual__video"
            src="/imgs/bg_imgs/auth_bg.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
          <div className="auth-visual__overlay" />
          <div className="auth-visual__content">
            <span className="auth-visual__brand">Stroane</span>
            <p className="auth-visual__tagline">
              Food safety supplies and compliance support for Ghana.
            </p>
          </div>
        </aside>

        <div className="auth-form-col">
          <div className="auth-card">
            <span className="auth-card__kicker">Welcome back</span>
          <h1 className="auth-card__title">Sign in</h1>
          <p className="auth-card__sub">
            Access your basket, orders, and saved details.
          </p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span>Email or username</span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setError("");
                }}
                autoComplete="username"
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoComplete="current-password"
                required
              />
            </label>

            {error ? (
              <p className="auth-form__error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="auth-form__submit"
              disabled={loading || !identifier || !password}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

            <p className="auth-card__alt">
              New to Stroane? <Link to="/signup">Create an account</Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SignIn;
