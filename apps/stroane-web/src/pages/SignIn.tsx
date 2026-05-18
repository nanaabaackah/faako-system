import React, { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Layout from "../components/Layout";
import useSEOMeta from "../hooks/useSEOMeta";
import { useAuth } from "../context/AuthContext";
import "../styles/pages/Auth.css";

const SignIn: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
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
      await signIn(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="auth-page">
        <div className="auth-card">
          <span className="auth-card__kicker">Welcome back</span>
          <h1 className="auth-card__title">Sign in</h1>
          <p className="auth-card__sub">
            Access your basket, orders, and saved details.
          </p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                autoComplete="email"
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
              disabled={loading || !email || !password}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="auth-card__alt">
            New to Stroane? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default SignIn;
