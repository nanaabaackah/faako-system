import React, { useState } from "react";
import "./Login.css";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../components/AuthContext/AuthContext";
import { AppIcon } from "/src/components/Icon/Icon";
import { faEye, faEyeSlash } from "/src/icons/iconSet";

function Login({ mode = "staff" }) {
  const navigate = useNavigate();
  const { login, authLoading, authError } = useAuth();
  const isCustomer = mode === "customer";
  const heroKicker = isCustomer ? "Booking portal" : "Team portal";
  const heroPills = isCustomer
    ? ["Fast return", "Saved details", "Live support"]
    : ["Secure access", "Daily ops", "Team workspace"];
  const [form, setForm] = useState({
    email: "",
    password: "",
    phone: "",
    remember: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const pageId = isCustomer ? "customer-login" : "staff-login";
  const errorMessage = localError || (!isCustomer ? authError : "");

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
      setLocalError("Email/username and password are required.");
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

  return (
    <div className={`login-page ${isCustomer ? "customer-login-page" : "staff-login-page"}`}>
      <a href="#main" className="skip-link">Skip to main content</a>
      <main className="login-shell page-shell" id="main" role="main">
        <section className="login-stage page-hero" aria-labelledby={`${pageId}-heading`}>
          <div className="login-stage-inner">
            <div className="login-stage-copy page-hero-copy">
              <span className="kicker">{heroKicker}</span>
              <h1 id={`${pageId}-heading`} className="page-hero-title">
                {isCustomer ? "Customer login" : "Staff login"}
              </h1>
              <p className="login-stage-subtitle">
                {isCustomer
                  ? "Use the same contact details from your booking to jump back into your party plans."
                  : "Secure sign-in for the REEBS team workspace, scheduling, and operations."}
              </p>
              <div className="login-stage-pills" aria-hidden="true">
                {heroPills.map((pill) => (
                  <span key={pill}>{pill}</span>
                ))}
              </div>
            </div>

            <div className="login-card">
              <header className="login-brand">
                <span className="login-brand-chip">
                  {isCustomer ? "Guest access" : "Protected access"}
                </span>
                <span className="login-brand-name">REEBS Party Themes</span>
                <span className="login-brand-tag">{isCustomer ? "Customer access" : "Staff portal"}</span>
              </header>

              <div className="login-header">
                <p className="login-eyebrow">{isCustomer ? "Continue your booking" : "Workspace access"}</p>
                <h2>{isCustomer ? "Pick up where you left off" : "Sign in to continue"}</h2>
                <p className="login-subtitle">
                  {isCustomer
                    ? "Customer accounts run through your booking details. Enter your email and phone number and we’ll take you into the booking flow."
                    : "Use your staff email or username and password to open the REEBS admin workspace."}
                </p>
              </div>

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="login-form-stack">
                  <label className="login-field">
                    <span className="login-field-label">{isCustomer ? "Email" : "Email or username"}</span>
                    <input
                      type={isCustomer ? "email" : "text"}
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder={isCustomer ? "booking@email.com" : "firstname_lastname or you@reebs.com"}
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
                        <button type="button" className="login-link">Forgot password?</button>
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

                <button
                  type="submit"
                  className="login-button"
                  disabled={!isCustomer && authLoading}
                >
                  {isCustomer ? "Continue to booking" : authLoading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <div className="login-switches">
                <div className="login-switch">
                  <span>{isCustomer ? "Team member?" : "Booking customer?"}</span>
                  <Link to={isCustomer ? "/login" : "/customer-login"}>
                    {isCustomer ? "Staff login" : "Customer login"}
                  </Link>
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

export default Login;
