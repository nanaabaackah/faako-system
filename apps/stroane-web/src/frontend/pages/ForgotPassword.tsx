import React, { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { HiArrowRight } from "react-icons/hi";
import { TextField } from "@faako/ui";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import { useAuth } from "../../context/AuthContext";
import { isLikelyEmail } from "../../utils/contactValidation";
import "../styles/Auth.css";

type ForgotFieldErrors = Partial<Record<"email", string>>;

const ForgotPassword: React.FC = () => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ForgotFieldErrors>({});
  const [loading, setLoading] = useState(false);

  useSEOMeta({
    title: "Reset Password | Stroane",
    description: "Request a secure password reset link for your Stroane account.",
    canonical: "https://stroanesolutions.com/forgot-password",
    noIndex: true,
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isLikelyEmail(email.trim().toLowerCase())) {
      const nextErrors = { email: "Add a valid email address." };
      setFieldErrors(nextErrors);
      setError(nextErrors.email);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const nextMessage = await requestPasswordReset({ email: email.trim().toLowerCase() });
      setMessage(nextMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request a password reset.");
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
            <span className="auth-card__kicker">Account access</span>
            <h1 className="auth-card__title">Reset your password</h1>
            <p className="auth-card__sub">
              Enter your account email and we will send a secure reset link.
            </p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <TextField
                fieldClassName="auth-field"
                label="Email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                  setMessage("");
                  setFieldErrors((current) => {
                    if (!current.email) return current;
                    const next = { ...current };
                    delete next.email;
                    return next;
                  });
                }}
                autoComplete="email"
                error={fieldErrors.email}
                required
              />

              {error ? (
                <p className="auth-form__error" role="alert">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="auth-form__success" role="status">
                  {message}
                </p>
              ) : null}

              <button
                type="submit"
                className="auth-form__submit"
                disabled={loading || !email}
              >
                {loading ? "Sending link..." : "Send reset link"}
                {!loading ? <HiArrowRight size={17} aria-hidden="true" /> : null}
              </button>
            </form>

            <p className="auth-card__alt">
              Remembered it? <Link to="/sign">Sign in</Link>
            </p>
            <p className="auth-card__alt">
              New to Stroane? <Link to="/signup">Create an account</Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ForgotPassword;
