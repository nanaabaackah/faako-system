import React, { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { HiArrowRight } from "react-icons/hi";
import { TextField } from "@faako/ui";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import { useAuth } from "../../context/AuthContext";
import { isLikelyEmail } from "../../utils/contactValidation";
import "../styles/Auth.css";

const CUSTOMER_ACCOUNT_PATHS = ["/account", "/orders", "/quotes"];

const getCustomerRedirect = (state: unknown) => {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== "string") return "/account";
  return CUSTOMER_ACCOUNT_PATHS.some((path) => from === path || from.startsWith(`${path}/`))
    ? from
    : "/account";
};

type SignInFieldErrors = Partial<Record<"identifier" | "password", string>>;

const getFirstFieldError = (errors: SignInFieldErrors) =>
  Object.values(errors).find(Boolean) || "";

const SignIn: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = getCustomerRedirect(location.state);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>({});
  const [loading, setLoading] = useState(false);

  useSEOMeta({
    title: "Sign In | Stroane",
    description: "Sign in to your Stroane account.",
    canonical: "https://stroanesolutions.com/sign",
    noIndex: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const nextErrors: SignInFieldErrors = {};
    const normalizedEmail = identifier.trim().toLowerCase();

    if (!isLikelyEmail(normalizedEmail)) {
      nextErrors.identifier = "Add a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Add your password.";
    }

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setError(getFirstFieldError(nextErrors));
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      await signIn(normalizedEmail, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
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
            <span className="auth-card__kicker">Welcome back</span>
            <h1 className="auth-card__title">Customer sign in</h1>
            <p className="auth-card__sub">
              View your Stroane profile, delivery details, and order history.
            </p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <TextField
                fieldClassName="auth-field"
                label="Email"
                type="email"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setError("");
                  setFieldErrors((current) => {
                    if (!current.identifier) return current;
                    const next = { ...current };
                    delete next.identifier;
                    return next;
                  });
                }}
                autoComplete="email"
                error={fieldErrors.identifier}
                required
              />

              <TextField
                fieldClassName="auth-field"
                label="Password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                  setFieldErrors((current) => {
                    if (!current.password) return current;
                    const next = { ...current };
                    delete next.password;
                    return next;
                  });
                }}
                autoComplete="current-password"
                error={fieldErrors.password}
                required
              />

              <div className="auth-form__row auth-form__row--right">
                <Link className="auth-form__link" to="/forgot-password">
                  Forgot password?
                </Link>
              </div>

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
                {loading ? "Signing in..." : "Sign in"}
                {!loading ? <HiArrowRight size={17} aria-hidden="true" /> : null}
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
