import { useState } from "react";
import { InlineNotice } from "@faako/ui";
import { useAuth } from "../auth/AuthContext.jsx";

export default function WaterLogin() {
  const { login, authLoading, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    try {
      await login(email, password);
    } catch {
      // The shared session provider exposes the authentication error to the form.
    }
  };

  return (
    <main className="water-login-page">
      <section className="water-login-card" aria-labelledby="water-login-title">
        <div className="water-app-brand">
          <span className="water-app-brand-mark">W</span>
          <span><strong>REEBS Water</strong><small>Inventory &amp; sales</small></span>
        </div>
        <h1 id="water-login-title">Sign in to Water</h1>
        <p>Use your existing REEBS account to continue.</p>
        {authError ? (
          <InlineNotice tone="error" title="Sign in failed" message={authError} />
        ) : null}
        <form className="water-login-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="admin-primary" type="submit" disabled={authLoading}>
            {authLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
