import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faCircleCheck,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import PrimaryButton from "../components/PrimaryButton.jsx";
import "../styles/pages/Auth.css";

export default function ForgotPassword() {
  const handleSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <section className="page auth forgot-page auth-suite">
      <div className="auth-suite-shell">
        <div className="auth-suite-panel reveal" data-scroll style={{ "--delay": "0ms" }}>
          <span className="auth-suite-kicker">
            <FontAwesomeIcon icon={faLock} />
            Recovery
          </span>
          <h1>Recover your Faako login.</h1>
          <p className="lead">
            Enter your work email and we will send a secure reset link.
          </p>
          <ul className="auth-suite-points">
            <li>
              <FontAwesomeIcon icon={faCircleCheck} />
              Reset links expire automatically
            </li>
            <li>
              <FontAwesomeIcon icon={faCircleCheck} />
              Email verification before password change
            </li>
          </ul>
          <div className="auth-suite-note">
            <FontAwesomeIcon icon={faShieldHalved} />
            <span>For account safety, reset requests are tracked and reviewed.</span>
          </div>
        </div>

        <form
          className="form card auth-card auth-suite-form reveal"
          data-scroll
          style={{ "--delay": "120ms" }}
          onSubmit={handleSubmit}
        >
          <label>
            Work email
            <input
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </label>
          <PrimaryButton type="submit">Send reset link</PrimaryButton>
          <div className="auth-meta">
            <span>Remembered your password?</span>
            <Link to="/login" className="text-link">
              Back to login
            </Link>
          </div>
          <p className="form-note">
            If you do not receive an email, contact support for help.
          </p>
        </form>
      </div>
    </section>
  );
}
