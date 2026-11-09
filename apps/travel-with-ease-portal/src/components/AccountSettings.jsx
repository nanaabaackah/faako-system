import Button from "./ActionButton.jsx";
import { useEffect, useState } from "react";
import { IconsaxIcon, InlineNotice, StatusPill } from "@faako/ui";
import "../styles/account-settings.css";

export default function AccountSettings({ api, session, onLogout, onHandoverCompleted }) {
  const [handover, setHandover] = useState(null);
  const [handoverMessage, setHandoverMessage] = useState("");
  const [handoverBusy, setHandoverBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api.get("/api/agent/administration/handover", { responseMode: "data" })
      .then((data) => { if (active) setHandover(data.request || null); })
      .catch(() => { if (active) setHandover(null); });
    return () => { active = false; };
  }, [api]);
  const role = session.user.role === "platform_admin" ? "Superadmin" : session.user.role.replaceAll("_", " ");
  const expires = session.expiresAt ? new Date(session.expiresAt) : null;
  const expiresLabel = expires && !Number.isNaN(expires.getTime())
    ? expires.toLocaleString()
    : "Check your session status";
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
          <h3>Your staff account</h3>
          <p>Travel With Ease · Staff workspace</p>
        </div>
        <StatusPill tone="neutral"><span className="account-role">{role}</span></StatusPill>
      </div>
      <div className="account-grid">
        <section className="workspace-panel" aria-labelledby="account-access-heading">
          <h3 id="account-access-heading">Workspace access</h3>
          <dl className="account-details">
            <div><dt>Your role</dt><dd className="account-role">{role}</dd></div>
            <div><dt>Workspace reference</dt><dd>{session.user.organisationId || "Unavailable"}</dd></div>
            <div><dt>Session expires</dt><dd>{expiresLabel}</dd></div>
          </dl>
          {expires && <p className="workspace-caption">Times are shown in your device’s local timezone.</p>}
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
      {handover && (
        <section className="workspace-panel account-security" aria-labelledby="handover-approval-heading">
          <h3 id="handover-approval-heading">Staging developer handover</h3>
          <p>Approval reference: <strong>{handover.approval_reference}</strong></p>
          <p>The current developer Owner requested a transition to Superadmin. Approval makes this client account the Owner first, records both role changes, and ends both application sessions.</p>
          <p>This request expires at {new Date(handover.expires_at).toLocaleString()} on your device.</p>
          {handoverMessage && <InlineNotice tone="danger" title="Handover not completed" message={handoverMessage} />}
          {handover.can_approve ? (
            <Button
              type="button"
              variant="primary"
              disabled={handoverBusy}
              onClick={async () => {
                if (!window.confirm("Approve this staging handover now? You will become Owner, the developer will become Superadmin, and both application sessions will end.")) return;
                setHandoverBusy(true);
                setHandoverMessage("");
                try {
                  await api.post(`/api/agent/administration/handover/${handover.id}/approve`, {
                    json: { approved: true },
                    responseMode: "data",
                    headers: { "X-CSRF-Token": session.csrfToken },
                  });
                  onHandoverCompleted();
                } catch (error) {
                  setHandoverMessage(error.message || "The approval was not completed. Refresh and verify both sessions before trying again.");
                } finally {
                  setHandoverBusy(false);
                }
              }}
            >
              Approve handover and sign out
            </Button>
          ) : (
            <p>Waiting for the named client account to approve. No Cloudflare Access token should be copied or shared.</p>
          )}
        </section>
      )}
      <section className="account-guidance" aria-labelledby="account-guidance-heading">
        <h3 id="account-guidance-heading">Make the workspace your own</h3>
        <p>Use Tutorial Mode in the footer to save your guidance preference. These preferences apply only to your account.</p>
        <p className="workspace-caption">Infrastructure, billing and workspace ownership cannot be changed here. Contact your authorised administrator for those requests.</p>
      </section>
    </section>
  );
}
