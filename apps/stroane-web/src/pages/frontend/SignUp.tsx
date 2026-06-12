import React, { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import { useAuth } from "../../context/AuthContext";
import { PORTAL_LOGIN_URL } from "../../config/appSurface";
import "../../styles/pages/Auth.css";

const SignUp: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useSEOMeta({
    title: "Create Account | Stroane",
    description: "Create a Stroane account.",
    canonical: "https://stroanesolutions.com/signup",
    noIndex: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signUp(name, email, password);
      navigate("/account", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
      setLoading(false);
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
            <span className="auth-card__kicker">Get started</span>
          <h1 className="auth-card__title">Create your account</h1>
          <p className="auth-card__sub">
            Create a customer profile placeholder while account services are prepared.
          </p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span>Full name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                autoComplete="name"
                required
              />
            </label>

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
                autoComplete="new-password"
                required
              />
              <small className="auth-field__hint">
                At least 8 characters.
              </small>
            </label>

            {error ? (
              <p className="auth-form__error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="auth-form__submit"
              disabled={loading || !name || !email || !password}
            >
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>

            <p className="auth-card__alt">
              Already have an account? <a href={PORTAL_LOGIN_URL}>Sign in</a>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SignUp;
