import React, { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import useSEOMeta from "../hooks/useSEOMeta";
import { useAuth } from "../context/AuthContext";
import "../styles/pages/Auth.css";

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
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="auth-page">
        <div className="auth-card">
          <span className="auth-card__kicker">Get started</span>
          <h1 className="auth-card__title">Create your account</h1>
          <p className="auth-card__sub">
            Save your basket and details for faster checkout.
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
            Already have an account? <Link to="/signin">Sign in</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default SignUp;
