import React, { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import { useAuth } from "../../context/AuthContext";
import { PORTAL_LOGIN_URL } from "../../config/appSurface";
import "../styles/Auth.css";

const SignUp: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      await signUp(name, email);
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
          <h1 className="auth-card__title">Create your customer profile</h1>
          <p className="auth-card__sub">
            Save a temporary profile for the account area while customer account
            services are prepared.
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

            {error ? (
              <p className="auth-form__error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="auth-form__submit"
              disabled={loading || !name || !email}
            >
              {loading ? "Saving..." : "Save profile"}
            </button>
          </form>

            <p className="auth-card__alt">
              Staff member? <a href={PORTAL_LOGIN_URL}>Open admin portal</a>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SignUp;
