import React, { useEffect, useState } from "react";
import "./Login.css";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { AppIcon } from "/src/components/Icon/Icon";
import { faEye, faEyeSlash } from "/src/icons/iconSet";
import { buildWebsiteUrl } from "../../utils/website";
import { reebsApiResponse } from "../../api/client";

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
  const [accountMode, setAccountMode] = useState("signin");
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [accountForm, setAccountForm] = useState({
    token: "",
    setupCode: "",
    firstName: "",
    lastName: "",
    personalEmail: "",
    password: "",
    confirmPassword: "",
  });
  const pageId = isCustomer ? "customer-login" : "staff-login";
  const errorMessage = isCustomer
    ? localError
    : accountMode !== "signin"
      ? accountError
      : forgotMode
      ? forgotError
      : localError || authError;

  useEffect(() => {
    if (isCustomer) return;
    reebsApiResponse("/api/v1/auth/bootstrap/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : { available: false })
      .then((data) => setBootstrapAvailable(data?.available === true))
      .catch(() => setBootstrapAvailable(false));

    const hash = window.location.hash || "";
    if (hash.startsWith("#invite=")) {
      const token = decodeURIComponent(hash.slice("#invite=".length));
      setAccountForm((current) => ({ ...current, token }));
      setAccountMode("activate");
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
    }
  }, [isCustomer]);

  const openAccountMode = (mode) => {
    setForgotMode(false);
    setLocalError("");
    setAccountError("");
    setAccountStatus("");
    setAccountMode(mode);
  };

  const closeAccountMode = () => {
    setAccountMode("signin");
    setAccountError("");
    setAccountStatus("");
  };

  const handleAccountSubmit = async (event) => {
    event.preventDefault();
    setAccountError("");
    setAccountStatus("");
    if (accountForm.password.length < 12) {
      setAccountError("Use a password of at least 12 characters.");
      return;
    }
    if (accountForm.password !== accountForm.confirmPassword) {
      setAccountError("The passwords do not match.");
      return;
    }
    setAccountSubmitting(true);
    try {
      const isBootstrap = accountMode === "bootstrap";
      const response = await reebsApiResponse(
        isBootstrap ? "/api/v1/auth/bootstrap" : "/api/v1/auth/invitations/accept",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isBootstrap ? {
            setupCode: accountForm.setupCode,
            firstName: accountForm.firstName,
            lastName: accountForm.lastName,
            personalEmail: accountForm.personalEmail,
            password: accountForm.password,
          } : {
            token: accountForm.token,
            personalEmail: accountForm.personalEmail,
            password: accountForm.password,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to activate the account.");
      setAccountStatus(data?.message || "Account created. You can now sign in.");
      setForm((current) => ({ ...current, email: data?.username || (isBootstrap ? "system_admin" : current.email) }));
      setBootstrapAvailable(false);
      setAccountForm({ token: "", setupCode: "", firstName: "", lastName: "", personalEmail: "", password: "", confirmPassword: "" });
      setAccountMode("signin");
    } catch (error) {
      setAccountError(error.message || "Unable to activate the account.");
    } finally {
      setAccountSubmitting(false);
    }
  };

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
      const response = await reebsApiResponse("/api/v1/auth/forgot-password", {
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
                    : accountMode === "bootstrap"
                      ? "Set up administrator"
                      : accountMode === "activate"
                        ? "Activate your account"
                    : forgotMode
                      ? "Reset your password"
                      : "Sign in to continue"}
                </h2>
                <p className="login-subtitle">
                  {isCustomer
                    ? "Customer accounts run through your booking details. Enter your email and phone number and we’ll take you into the booking flow."
                    : accountMode === "bootstrap"
                      ? "Create the first system administrator using the one-time setup code configured for this environment."
                      : accountMode === "activate"
                        ? "Use the single-use invitation from your administrator and choose your own password."
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
                onSubmit={accountMode !== "signin" && !isCustomer ? handleAccountSubmit : forgotMode && !isCustomer ? handleForgotSubmit : handleSubmit}
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
                  ) : accountMode !== "signin" ? (
                    <>
                      {accountMode === "bootstrap" && (
                        <>
                          <label className="login-field">
                            <span className="login-field-label">First name</span>
                            <input value={accountForm.firstName} onChange={(event) => setAccountForm((current) => ({ ...current, firstName: event.target.value }))} autoComplete="given-name" required />
                          </label>
                          <label className="login-field">
                            <span className="login-field-label">Last name</span>
                            <input value={accountForm.lastName} onChange={(event) => setAccountForm((current) => ({ ...current, lastName: event.target.value }))} autoComplete="family-name" required />
                          </label>
                          <label className="login-field">
                            <span className="login-field-label">One-time setup code</span>
                            <input type="password" value={accountForm.setupCode} onChange={(event) => setAccountForm((current) => ({ ...current, setupCode: event.target.value }))} autoComplete="off" required />
                          </label>
                        </>
                      )}
                      {accountMode === "activate" && (
                        <label className="login-field">
                          <span className="login-field-label">Invitation code</span>
                          <input value={accountForm.token} onChange={(event) => setAccountForm((current) => ({ ...current, token: event.target.value }))} autoComplete="off" required />
                        </label>
                      )}
                      <label className="login-field">
                        <span className="login-field-label">Personal email</span>
                        <input type="email" value={accountForm.personalEmail} onChange={(event) => setAccountForm((current) => ({ ...current, personalEmail: event.target.value }))} autoComplete="email" required />
                      </label>
                      <label className="login-field">
                        <span className="login-field-label">Password</span>
                        <input type="password" value={accountForm.password} onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" minLength={12} required />
                      </label>
                      <label className="login-field">
                        <span className="login-field-label">Confirm password</span>
                        <input type="password" value={accountForm.confirmPassword} onChange={(event) => setAccountForm((current) => ({ ...current, confirmPassword: event.target.value }))} autoComplete="new-password" minLength={12} required />
                      </label>
                    </>
                  ) : forgotMode ? (
                    <>
                      {forgotNeedsPersonalEmail && (
                        <p className="login-customer-note" role="note">
                          {forgotRequiresPhoneVerification
                            ? "To protect the account, match the staff phone on file before we save the new delivery email."
                            : "Your personal email becomes the delivery address for password resets and staff notifications."}
                        </p>
                      )}
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
                {accountStatus && <p className="login-customer-note" role="status">{accountStatus}</p>}

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
                    : accountMode !== "signin"
                      ? accountSubmitting
                        ? "Creating account..."
                        : accountMode === "bootstrap" ? "Create administrator" : "Activate account"
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
                {accountMode !== "signin" && !isCustomer && (
                  <button type="button" className="login-link" onClick={closeAccountMode} disabled={accountSubmitting}>
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

                {!isCustomer && accountMode === "signin" && !forgotMode && (
                  <div className="login-switch">
                    <span>New team member?</span>
                    <button type="button" className="login-link" onClick={() => openAccountMode("activate")}>Activate invitation</button>
                  </div>
                )}
                {!isCustomer && accountMode === "signin" && !forgotMode && bootstrapAvailable && (
                  <div className="login-switch">
                    <span>First-time setup?</span>
                    <button type="button" className="login-link" onClick={() => openAccountMode("bootstrap")}>Create first administrator</button>
                  </div>
                )}

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
