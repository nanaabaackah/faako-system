import React, { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { HiArrowRight } from "react-icons/hi";
import { TextField } from "@faako/ui";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import { useAuth } from "../../context/AuthContext";
import PasswordRequirementList from "../components/auth/PasswordRequirementList";
import { getPasswordValidationMessage } from "../../utils/passwordRequirements";
import "../styles/Auth.css";

const ResetPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useSEOMeta({
    title: "Set New Password | Stroane",
    description: "Set a new secure password for your Stroane customer account.",
    canonical: "https://stroanesolutions.com/reset-password",
    noIndex: true,
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("Reset link is invalid or expired.");
      return;
    }
    const passwordMessage = getPasswordValidationMessage(password);
    if (passwordMessage) {
      setError(passwordMessage);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, password });
      navigate("/account", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
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
            <span className="auth-card__kicker">Secure reset</span>
            <h1 className="auth-card__title">Set a new password</h1>
            <p className="auth-card__sub">
              Choose a private password for your Stroane customer account.
            </p>

            {!token ? (
              <p className="auth-form__error" role="alert">
                Reset link is invalid or expired. Request a fresh link.
              </p>
            ) : null}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <TextField
                fieldClassName="auth-field"
                label="New password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                aria-describedby="reset-password-requirements"
                required
              />
              <PasswordRequirementList
                id="reset-password-requirements"
                password={password}
              />
              <TextField
                fieldClassName="auth-field"
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                required
              />

              {error ? (
                <p className="auth-form__error" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="auth-form__submit"
                disabled={loading || !token || !password || !confirmPassword}
              >
                {loading ? "Saving password..." : "Save new password"}
                {!loading ? <HiArrowRight size={17} aria-hidden="true" /> : null}
              </button>
            </form>

            <p className="auth-card__alt">
              Need a new link? <Link to="/forgot-password">Request reset</Link>
            </p>
            <p className="auth-card__alt">
              Already updated it? <Link to="/sign">Sign in</Link>
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

export default ResetPassword;
