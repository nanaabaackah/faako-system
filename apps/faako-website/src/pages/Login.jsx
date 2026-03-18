import { useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRightToBracket,
  faEnvelope,
  faLock,
  faEye,
  faEyeSlash,
  faShieldHalved,
  faCircleCheck,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";
import {
  faGoogle,
  faFacebookF,
  faApple,
} from "@fortawesome/free-brands-svg-icons";
import "../styles/pages/Auth.css";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <section className="page auth login-page auth-suite">
      <div className="auth-suite-shell">
        <aside className="auth-suite-panel reveal" data-scroll style={{ "--delay": "0ms" }}>
          <span className="auth-suite-kicker">
            <FontAwesomeIcon icon={faLayerGroup} />
            Account Access
          </span>
          <h1>Sign in to your Faako account.</h1>
          <p className="lead">
            Check project progress, team updates, and approvals in one secure place.
          </p>
          <ul className="auth-suite-points">
            <li>
              <FontAwesomeIcon icon={faCircleCheck} />
              Shared project timeline
            </li>
            <li>
              <FontAwesomeIcon icon={faCircleCheck} />
              Role-based access
            </li>
            <li>
              <FontAwesomeIcon icon={faCircleCheck} />
              Project notes and approvals in one feed
            </li>
          </ul>
          <div className="auth-suite-note">
            <FontAwesomeIcon icon={faShieldHalved} />
            <span>Protected with secure sign-in and encrypted sessions.</span>
          </div>
        </aside>

        <form
          className="form card auth-card login-card auth-suite-form reveal"
          data-scroll
          style={{ "--delay": "120ms" }}
          onSubmit={handleSubmit}
        >
          <div className="login-card-badge" aria-hidden="true">
            <FontAwesomeIcon icon={faRightToBracket} />
          </div>

          <div className="login-copy">
            <h2>Sign in with email</h2>
            <p className="muted">
              Use the email linked to your account.
            </p>
          </div>

          <label className="login-field">
            <span className="login-field-icon">
              <FontAwesomeIcon icon={faEnvelope} />
            </span>
            <input
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="login-field login-field--password">
            <span className="login-field-icon">
              <FontAwesomeIcon icon={faLock} />
            </span>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-field-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
            </button>
          </label>

          <div className="auth-actions login-actions-row">
            <Link to="/forgot-password" className="text-link">
              Forgot password?
            </Link>
          </div>

          <button className="button button-primary login-submit" type="submit">
            Continue
          </button>

          <div className="login-divider">
            <span>Or sign in with</span>
          </div>

          <div className="login-social-grid">
            <button className="login-social-button" type="button" aria-label="Sign in with Google">
              <FontAwesomeIcon icon={faGoogle} />
            </button>
            <button className="login-social-button" type="button" aria-label="Sign in with Facebook">
              <FontAwesomeIcon icon={faFacebookF} />
            </button>
            <button className="login-social-button" type="button" aria-label="Sign in with Apple">
              <FontAwesomeIcon icon={faApple} />
            </button>
          </div>

          <div className="auth-meta login-meta">
            <span>Need an account?</span>
            <Link to="/signup" className="text-link">
              Sign up today
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
