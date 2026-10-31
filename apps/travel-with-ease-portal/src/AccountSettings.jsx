import Button from "./ActionButton.jsx";
import { IconsaxIcon, StatusPill } from "@faako/ui";
import "./account-settings.css";

export default function AccountSettings({ session, onLogout }) {
  const role = session.user.role.replaceAll("_", " ");
  const expires = session.expiresAt ? new Date(session.expiresAt) : null;
  const expiresLabel = expires && !Number.isNaN(expires.getTime())
    ? expires.toLocaleString()
    : session.demo ? "Ends when you leave or reset the demo" : "Check your session status";
  return (
    <section
      className="account-workspace"
      aria-labelledby="account-settings-heading"
      data-tour="account-settings"
    >
      <header className="workspace-intro">
        <h2 id="account-settings-heading">Account and workspace settings</h2>
        <p>Your access, session and workspace preferences.</p>
      </header>
      <div className="account-summary">
        <span className="account-summary__icon"><IconsaxIcon name="ShieldTick" /></span>
        <div>
          <h3>{session.demo ? "Your demo workspace" : "Your staff account"}</h3>
          <p>Travel With Ease · Staff workspace</p>
        </div>
        <StatusPill tone="neutral"><span className="account-role">{role}</span></StatusPill>
      </div>
      <div className="account-grid">
        <section className="workspace-panel" aria-labelledby="account-access-heading">
          <h3 id="account-access-heading">Workspace access</h3>
          <dl className="account-details">
            <div><dt>Your role</dt><dd className="account-role">{role}</dd></div>
            <div><dt>Workspace reference</dt><dd>{session.user.organisationId || (session.demo ? "Local demonstration" : "Unavailable")}</dd></div>
            <div><dt>Session expires</dt><dd>{expiresLabel}</dd></div>
          </dl>
          {!session.demo && expires && <p className="workspace-caption">Times are shown in your device’s local timezone.</p>}
        </section>
        <section className="workspace-panel account-security" aria-labelledby="account-security-heading">
          <h3 id="account-security-heading">Sign-in and security</h3>
          <p>Your identity provider manages your Google account, password recovery and MFA. Workspace roles are managed separately by authorised staff.</p>
          <p>Signing out all devices ends your TWE application sessions. Your identity-provider session is managed separately.</p>
          <Button
            type="button"
            variant="danger"
            icon="logout"
            onClick={() => {
              if (window.confirm("Sign out all your Travel With Ease sessions?")) onLogout(true);
            }}
          >Sign out all devices</Button>
        </section>
      </div>
      <section className="account-guidance" aria-labelledby="account-guidance-heading">
        <h3 id="account-guidance-heading">Make the workspace your own</h3>
        <p>Use Tutorial Mode in the footer to save your guidance preference. These preferences apply only to your account.</p>
        <p className="workspace-caption">Infrastructure, billing and workspace ownership cannot be changed here. Contact your authorised administrator for those requests.</p>
      </section>
    </section>
  );
}
