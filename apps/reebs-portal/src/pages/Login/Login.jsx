import React, { useState } from "react";
import "./Login.css";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { AppIcon } from "/src/components/Icon/Icon";
import { faEye, faEyeSlash } from "/src/icons/iconSet";
import { buildWebsiteUrl } from "../../utils/website";

function Login({ mode = "staff" }) {
  const navigate = useNavigate();
  const { login, authLoading, authError } = useAuth();
  const isCustomer = mode === "customer";
  const [form, setForm] = useState({
    email: "",
    password: "",
    phone: "",
    remember: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotPersonalEmail, setForgotPersonalEmail] = useState("");
  const [forgotNeedsPersonalEmail, setForgotNeedsPersonalEmail] = useState(false);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotRequiresPhoneVerification, setForgotRequiresPhoneVerification] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotStatus, setForgotStatus] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const pageId = isCustomer ? "customer-login" : "staff-login";
  const errorMessage = isCustomer
    ? localError
    : forgotMode
      ? forgotError
      : localError || authError;

  const openForgotPassword = () => {
    setForgotMode(true);
    setShowPassword(false);
    setLocalError("");
    setForgotError("");
    setForgotStatus("");
    setForgotPersonalEmail("");
    setForgotNeedsPersonalEmail(false);
    setForgotPhone("");
    setForgotRequiresPhoneVerification(false);
    setForgotIdentifier((currentValue) => currentValue || form.email.trim());
  };

  const closeForgotPassword = () => {
    setForgotMode(false);
    setForgotPersonalEmail("");
    setForgotNeedsPersonalEmail(false);
    setForgotPhone("");
    setForgotRequiresPhoneVerification(false);
    setForgotError("");
    setForgotStatus("");
    setLocalError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError("");

    const email = form.email.trim().toLowerCase();

    if (isCustomer) {
      const phone = form.phone.trim();
      if (!email || !phone) {
        setLocalError("Email and phone are required.");
        return;
      }
      navigate("/book", {
        state: {
          leadEmail: email,
          leadPhone: phone,
        },
      });
      return;
    }

    if (!email || !form.password) {
      setLocalError("Username and password are required.");
      return;
    }

    try {
      const password = form.password.trim();
      await login(email, password, form.remember);
      navigate("/admin");
    } catch (err) {
      setLocalError(err.message || "Login failed");
    }
  };

  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    setForgotError("");
    setForgotStatus("");

    const identifier = forgotIdentifier.trim().toLowerCase();
    if (!identifier) {
      setForgotError("Enter your username or personal email.");
      return;
    }
    if (forgotNeedsPersonalEmail && !forgotPersonalEmail.trim()) {
      setForgotError("Enter the personal email you want to use for reset links.");
      return;
    }
    if (forgotNeedsPersonalEmail && forgotRequiresPhoneVerification && !forgotPhone.trim()) {
      setForgotError("Enter the staff phone number linked to your account.");
      return;
    }

    setForgotSubmitting(true);
    try {
      const response = await fetch("/.netlify/functions/forgotPassword", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          personalEmail: forgotNeedsPersonalEmail ? forgotPersonalEmail.trim() : undefined,
          phone: forgotNeedsPersonalEmail && forgotRequiresPhoneVerification ? forgotPhone.trim() : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to send a reset link right now.");
      }
      if (data?.requiresPersonalEmailSetup) {
        const canSelfServe = Boolean(data?.requiresPhoneVerification);
        setForgotNeedsPersonalEmail(canSelfServe);
        setForgotRequiresPhoneVerification(canSelfServe);
        if (!canSelfServe) {
          setForgotPersonalEmail("");
          setForgotPhone("");
        }
        setForgotStatus(data?.message || "Set your personal email to receive the reset link.");
        return;
      }
      setForgotNeedsPersonalEmail(false);
      setForgotPersonalEmail("");
      setForgotPhone("");
      setForgotRequiresPhoneVerification(false);
      setForgotStatus(
        data?.message
        || "If an account matches that username or personal email, a reset link will be sent."
      );
    } catch (err) {
      setForgotError(err.message || "Unable to send a reset link right now.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className={`login-page ${isCustomer ? "customer-login-page" : "staff-login-page"}`}>
      <a href="#main" className="skip-link">Skip to main content</a>
      <main className="login-shell page-shell" id="main" role="main">
        <section className="login-stage page-hero" aria-labelledby={`${pageId}-heading`}>
          <div className="login-stage-inner">
            <div className="login-stage-copy page-hero-copy">
              <h1 id={`${pageId}-heading`} className="page-hero-title">
                {isCustomer ? "Customer login" : "Staff login"}
              </h1>
              <p className="login-stage-subtitle">
                {isCustomer
                  ? "Use the same contact details from your booking to jump back into your party plans."
                  : null}
              </p>
            </div>

            <div className="login-card">
              <div className="login-header">
                <p className="login-eyebrow">{isCustomer ? "Continue your booking" : "Workspace access"}</p>
                <h2>
                  {isCustomer
                    ? "Pick up where you left off"
                    : forgotMode
                      ? "Reset your password"
                      : "Sign in to continue"}
                </h2>
                <p className="login-subtitle">
                  {isCustomer
                    ? "Customer accounts run through your booking details. Enter your email and phone number and we’ll take you into the booking flow."
                    : forgotMode
                      ? forgotNeedsPersonalEmail
                        ? forgotRequiresPhoneVerification
                          ? "This username does not have a delivery inbox yet. Confirm your staff phone and set your personal email below to receive the reset link."
                          : "This username does not have a delivery inbox yet. Set your personal email below and we’ll send the reset link there."
                        : "Enter the username or personal email tied to your account. If it matches, we’ll send a secure reset link to your personal inbox."
                      : "Use your REEBS username and password to open the staff portal."}
                </p>
              </div>

              <form
                className="login-form"
                onSubmit={forgotMode && !isCustomer ? handleForgotSubmit : handleSubmit}
              >
                <div className="login-form-stack">
                  <label className="login-field">
                    <span className="login-field-label">
                      {isCustomer ? "Email" : forgotMode ? "Personal email or username" : "Username"}
                    </span>
                    <input
                      type={isCustomer ? "email" : "text"}
                      value={forgotMode && !isCustomer ? forgotIdentifier : form.email}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (forgotMode && !isCustomer) {
                          if (forgotNeedsPersonalEmail) {
                            setForgotNeedsPersonalEmail(false);
                            setForgotPersonalEmail("");
                            setForgotPhone("");
                            setForgotRequiresPhoneVerification(false);
                            setForgotStatus("");
                          }
                          setForgotIdentifier(nextValue);
                          return;
                        }
                        setForm((prev) => ({ ...prev, email: nextValue }));
                      }}
                      placeholder={
                        isCustomer
                          ? "booking@email.com"
                          : forgotMode
                            ? "you@example.com or username"
                            : "firstname_lastname"
                      }
                      autoComplete={isCustomer ? "email" : "username"}
                      required
                    />
                  </label>

                  {isCustomer ? (
                    <label className="login-field">
                      <span className="login-field-label">Phone number</span>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                        placeholder="+233 24 000 0000"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                      />
                    </label>
                  ) : forgotMode ? (
                    <>
                      <p className="login-customer-note" role="note">
                        {forgotNeedsPersonalEmail
                          ? forgotRequiresPhoneVerification
                            ? "To protect the account, match the staff phone on file before we save the new delivery email."
                            : "Your personal email becomes the delivery address for password resets and staff notifications."
                          : "We do not reveal whether an account exists. If the details match a REEBS staff account, the reset link will expire after 30 minutes and active sessions will be signed out after the password change."}
                      </p>
                      {forgotNeedsPersonalEmail && (
                        <>
                          {forgotRequiresPhoneVerification && (
                            <label className="login-field">
                              <span className="login-field-label">Confirm staff phone</span>
                              <input
                                type="tel"
                                value={forgotPhone}
                                onChange={(event) => setForgotPhone(event.target.value)}
                                placeholder="+233 24 000 0000"
                                autoComplete="tel"
                                inputMode="tel"
                                required
                              />
                            </label>
                          )}
                          <label className="login-field">
                            <span className="login-field-label">Set personal email</span>
                            <input
                              type="email"
                              value={forgotPersonalEmail}
                              onChange={(event) => setForgotPersonalEmail(event.target.value)}
                              placeholder="you@example.com"
                              autoComplete="email"
                              required
                            />
                          </label>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <label className="login-field login-password-row">
                        <span className="login-field-label">Password</span>
                        <div className="login-password-field">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={form.password}
                            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            required
                          />
                          <button
                            type="button"
                            className="login-toggle"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            <AppIcon icon={showPassword ? faEyeSlash : faEye} />
                          </button>
                        </div>
                      </label>

                      <div className="login-aux">
                        <label className="login-remember">
                          <input
                            type="checkbox"
                            checked={form.remember}
                            onChange={(e) => setForm((prev) => ({ ...prev, remember: e.target.checked }))}
                          />
                          Remember me
                        </label>
                        <button type="button" className="login-link" onClick={openForgotPassword}>
                          Forgot password?
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {isCustomer && (
                  <p className="login-customer-note">
                    Use the same email and phone number attached to your booking request.
                  </p>
                )}

                {errorMessage && <p className="customers-error login-error">{errorMessage}</p>}
                {forgotMode && forgotStatus && (
                  <p className="login-customer-note" role="status">{forgotStatus}</p>
                )}

                <button
                  type="submit"
                  className="login-button"
                  disabled={
                    isCustomer
                      ? false
                      : forgotMode
                        ? forgotSubmitting
                        : authLoading
                  }
                >
                  {isCustomer
                    ? "Continue to booking"
                    : forgotMode
                      ? forgotSubmitting
                        ? forgotNeedsPersonalEmail
                          ? "Saving email..."
                          : "Sending link..."
                        : forgotNeedsPersonalEmail
                          ? "Save email and send link"
                          : "Send reset link"
                      : authLoading
                        ? "Signing in..."
                        : "Sign in"}
                </button>
                {forgotMode && !isCustomer && (
                  <button type="button" className="login-link" onClick={closeForgotPassword}>
                    Back to sign in
                  </button>
                )}
              </form>

              <div className="login-switches">
                <div className="login-switch">
                  <span>{isCustomer ? "Team member?" : "Booking customer?"}</span>
                  {isCustomer ? (
                    <Link to="/login">Staff login</Link>
                  ) : (
                    <a href={buildWebsiteUrl("/customer-login")}>Customer login</a>
                  )}
                </div>

                <div className="login-switch">
                  <span>Need help?</span>
                  <a href={buildWebsiteUrl("/contact")}>Contact REEBS</a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Login;
