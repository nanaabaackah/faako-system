import React, { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/components/AuthGate.css";

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <>{children}</>;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect username or password.");
      setLoading(false);
    }
  };

  const hasError = error.length > 0;

  return (
    <div className="auth-gate">
      <div className="auth-gate__card">
        <img
          src="/assets/logos/logo_long.svg"
          alt="Stroane"
          className="auth-gate__logo"
        />

        <h1 className="auth-gate__heading">Preview Access</h1>
        <p className="auth-gate__sub">
          This site is currently in development.
          <br />
          Enter your credentials to continue.
        </p>

        <form className="auth-gate__form" onSubmit={handleSubmit} noValidate>
          <div className="auth-gate__field">
            <label className="auth-gate__label" htmlFor="auth-username">
              Username
            </label>
            <input
              id="auth-username"
              type="text"
              className={`auth-gate__input${hasError ? " auth-gate__input--error" : ""}`}
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="auth-gate__field">
            <label className="auth-gate__label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              className={`auth-gate__input${hasError ? " auth-gate__input--error" : ""}`}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              autoComplete="current-password"
              required
            />
          </div>

          <p className="auth-gate__error" role="alert" aria-live="polite">
            {error}
          </p>

          <button
            type="submit"
            className="auth-gate__submit"
            disabled={loading || !username || !password}
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthGate;
