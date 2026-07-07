import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../api/client";
import { clearAuthStore, setAuthenticatedUser } from "../../auth/authStore";
import ThemeToggle from "../../components/ThemeToggle";
import "./Login.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RequiredMark = () => (
  <>
    <span className="form-field-required" aria-hidden="true">
      *
    </span>
    <span className="sr-only">required</span>
  </>
);

const getFirstFieldError = (errors) => Object.values(errors).find(Boolean) || "";

const Login = ({ theme, onToggleTheme }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [forgotStatus, setForgotStatus] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotFieldErrors, setForgotFieldErrors] = useState({});

  const fieldError = (field) => fieldErrors[field] || "";
  const forgotFieldError = (field) => forgotFieldErrors[field] || "";

  const updateLoginField = (field, value, setter) => {
    setter(value);
    setError("");
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateLogin = () => {
    const nextErrors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      nextErrors.email = "Enter your email address.";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "Use a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Enter your password.";
    }
    return nextErrors;
  };

  const validateForgotPassword = () => {
    const nextErrors = {};
    const trimmedEmail = forgotEmail.trim();
    if (!trimmedEmail) {
      nextErrors.email = "Enter the email you used to register.";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "Use a valid email address.";
    }
    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const nextErrors = validateLogin();
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setError(getFirstFieldError(nextErrors));
      return;
    }
    setFieldErrors({});

    try {
      const data = await apiPost("/api/auth/login", { email: email.trim(), password }, {
        fallbackMessage: "Login failed",
      });

      if (!data?.user) {
        throw new Error("Login succeeded but user details were missing.");
      }

      const session = await apiGet("/api/auth/session", {
        cache: "no-store",
        fallbackMessage: "Your browser could not establish a secure session. Please reload and try again.",
      });
      if (!session?.user) {
        throw new Error("Your browser could not establish a secure session. Please reload and try again.");
      }

      setAuthenticatedUser(session.user);
      navigate("/dashboard");
    } catch (err) {
      clearAuthStore();
      setError(err.message || "Network error or server unavailable");
      console.error("Login error:", err);
    }
  };
  
  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = forgotEmail.trim();

    const nextErrors = validateForgotPassword();
    if (Object.keys(nextErrors).length) {
      setForgotFieldErrors(nextErrors);
      setForgotError(getFirstFieldError(nextErrors));
      return;
    }
    setForgotFieldErrors({});
    setIsSendingReset(true);
    setForgotError("");
    setForgotStatus("");
    try {
      const payload = await apiPost("/api/auth/forgot-password", { email: trimmedEmail }, {
        fallbackMessage: "Unable to request password help",
      });
      const statusMessage = payload?.message || "If that email exists we sent instructions.";
      setForgotStatus(statusMessage);
      setForgotError("");
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <span className="brand">Dev KPI</span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="auth-layout">
        <div className="panel auth-hero">
          <h1>Monitor every live signal in one place</h1>
          <p className="muted">
            This site surfaces live metrics from all databases along with system health
            insights.
          </p>
          <div className="auth-list">
            <div className="auth-list-row">
              <span>Live API data</span>
              <strong>Real time</strong>
            </div>
            <div className="auth-list-row">
              <span>Secure access</span>
              <strong>Session protected</strong>
            </div>
            <div className="auth-list-row">
              <span>System visibility</span>
              <strong>Status checks</strong>
            </div>
          </div>
        </div>
        <div className="panel auth-card">
          <div className="auth-card__header">
            <h2>Sign in</h2>
            <p className="muted">
              Use your admin credentials to access the KPI dashboard.
            </p>
          </div>
          {error ? (
            <div className="notice is-error" role="alert">
              {error}
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <label
              className={`form-field ${fieldError("email") ? "is-error" : ""}`}
              htmlFor="loginEmail"
            >
              <span className="form-field-label">
                Email address
                <RequiredMark />
              </span>
              <input
                id="loginEmail"
                className="input"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => updateLoginField("email", e.target.value, setEmail)}
                aria-invalid={fieldError("email") ? "true" : undefined}
                aria-describedby={fieldError("email") ? "loginEmail-error" : undefined}
                required
              />
              {fieldError("email") ? (
                <span className="form-field-error" id="loginEmail-error">
                  {fieldError("email")}
                </span>
              ) : null}
            </label>

            <label
              className={`form-field ${fieldError("password") ? "is-error" : ""}`}
              htmlFor="loginPassword"
            >
              <span className="form-field-label">
                Password
                <RequiredMark />
              </span>
              <div className={`input-group ${fieldError("password") ? "is-error" : ""}`}>
                <input
                  id="loginPassword"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => updateLoginField("password", e.target.value, setPassword)}
                  aria-invalid={fieldError("password") ? "true" : undefined}
                  aria-describedby={fieldError("password") ? "loginPassword-error" : undefined}
                  required
                />
                <button
                  className="input-button"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {fieldError("password") ? (
                <span className="form-field-error" id="loginPassword-error">
                  {fieldError("password")}
                </span>
              ) : null}
            </label>

            <button className="button button-primary auth-submit" type="submit">
              Sign in
            </button>
          </form>
          <div className="auth-helper">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setForgotMode((prev) => !prev);
                setForgotStatus("");
                setForgotError("");
                setForgotFieldErrors({});
              }}
            >
              {forgotMode ? "Back to sign in" : "Forgot password?"}
            </button>
          </div>
          {forgotMode ? (
            <form className="auth-forgot" onSubmit={handleForgotSubmit} noValidate>
              <p className="muted">
                Enter the email you use for this dashboard and we will send recovery steps.
              </p>
              {forgotStatus ? <div className="notice is-success">{forgotStatus}</div> : null}
              {forgotError ? (
                <div className="notice is-error" role="alert">
                  {forgotError}
                </div>
              ) : null}
              <label
                className={`form-field ${forgotFieldError("email") ? "is-error" : ""}`}
                htmlFor="forgotEmail"
              >
                <span className="form-field-label">
                  Email address
                  <RequiredMark />
                </span>
                <input
                  id="forgotEmail"
                  className="input"
                  type="email"
                  placeholder="name@example.com"
                  value={forgotEmail}
                  onChange={(e) => {
                    setForgotEmail(e.target.value);
                    setForgotError("");
                    setForgotFieldErrors((current) => {
                      if (!current.email) return current;
                      const next = { ...current };
                      delete next.email;
                      return next;
                    });
                  }}
                  aria-invalid={forgotFieldError("email") ? "true" : undefined}
                  aria-describedby={forgotFieldError("email") ? "forgotEmail-error" : undefined}
                  required
                />
                {forgotFieldError("email") ? (
                  <span className="form-field-error" id="forgotEmail-error">
                    {forgotFieldError("email")}
                  </span>
                ) : null}
              </label>
              <button
                className="button button-ghost auth-submit"
                type="submit"
                disabled={isSendingReset}
              >
                {isSendingReset ? "Sending reset link..." : "Send reset link"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Login;
