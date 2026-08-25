import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./ResetPassword.css";
import { AppIcon } from "/src/components/Icon/Icon";
import { faEye, faEyeSlash } from "/src/icons/iconSet";
import { clearAuthState } from "@faako/core";
import { publicApiResponse } from "../../lib/publicApi";

const MIN_PASSWORD_LENGTH = 8;

function ResetPassword() {
  const location = useLocation();
  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token")?.trim() || "";
  }, [location.search]);

  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!token) {
      setError("This reset link is missing or invalid.");
      return;
    }

    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await publicApiResponse("/v1/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password: form.password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to reset password right now.");
      }

      clearAuthState({
        notify: true,
        reason: "password-reset",
      });
      setStatus(data?.message || "Your password has been reset.");
      setForm({
        password: "",
        confirmPassword: "",
      });
    } catch (err) {
      setError(err.message || "Unable to reset password right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page staff-login-page">
      <a href="#main" className="skip-link">Skip to main content</a>
      <main className="login-shell page-shell" id="main" role="main">
        <section className="login-stage page-hero" aria-labelledby="reset-password-heading">
          <div className="login-stage-inner">
            <div className="login-stage-copy page-hero-copy">
              <span className="kicker">Account recovery</span>
              <h1 id="reset-password-heading" className="page-hero-title">Reset password</h1>
              <p className="login-stage-subtitle">
                Choose a new password for your REEBS staff account. For security, active sessions are
                revoked when the reset completes.
              </p>
              <div className="login-stage-pills" aria-hidden="true">
                <span>Single-use link</span>
                <span>30-minute expiry</span>
                <span>Secure sign-out</span>
              </div>
            </div>

            <div className="login-card">
              <header className="login-brand">
                <span className="login-brand-name">Password reset</span>
              </header>

              <div className="login-header">
                <p className="login-eyebrow">Account recovery</p>
                <h2>Set your new password</h2>
                <p className="login-subtitle">
                  Use a strong password that you do not reuse elsewhere. This page only works for a
                  valid reset link.
                </p>
              </div>

              {!token && (
                <p className="login-error">
                  This reset link is missing the required token. Request a new email from the login page.
                </p>
              )}

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="login-form-stack">
                  <label className="login-field login-password-row">
                    <span className="login-field-label">New password</span>
                    <div className="login-password-field">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, password: event.target.value }))}
                        autoComplete="new-password"
                        placeholder="Choose a new password"
                        minLength={MIN_PASSWORD_LENGTH}
                        required
                        disabled={!token || isSubmitting}
                      />
                      <button
                        type="button"
                        className="login-toggle"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        disabled={!token}
                      >
                        <AppIcon icon={showPassword ? faEyeSlash : faEye} />
                      </button>
                    </div>
                  </label>

                  <label className="login-field login-password-row">
                    <span className="login-field-label">Confirm password</span>
                    <div className="login-password-field">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                        autoComplete="new-password"
                        placeholder="Repeat your new password"
                        minLength={MIN_PASSWORD_LENGTH}
                        required
                        disabled={!token || isSubmitting}
                      />
                      <button
                        type="button"
                        className="login-toggle"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        disabled={!token}
                      >
                        <AppIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                      </button>
                    </div>
                  </label>

                  <p className="login-customer-note" role="note">
                    After reset, sign in again with the new password on every device.
                  </p>
                </div>

                {error && <p className="login-error">{error}</p>}
                {status && <p className="login-customer-note" role="status">{status}</p>}

                <button
                  type="submit"
                  className="login-button"
                  disabled={!token || isSubmitting}
                >
                  {isSubmitting ? "Resetting password..." : "Reset password"}
                </button>
              </form>

              <div className="login-switches">
                <div className="login-switch">
                  <span>Remembered it?</span>
                  <Link to="/login">Back to sign in</Link>
                </div>
                <div className="login-switch">
                  <span>Need help?</span>
                  <Link to="/contact">Contact REEBS</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ResetPassword;
