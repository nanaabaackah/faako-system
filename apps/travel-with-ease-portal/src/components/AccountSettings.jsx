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
      </header>
      <div className="account-summary">
        <span className="account-summary__icon"><IconsaxIcon name="ShieldTick" /></span>
        <div>
          <h3>Your staff account</h3>
        </div>
        <StatusPill tone="neutral"><span className="account-role">{role}</span></StatusPill>
      </div>
      <div className="account-grid">
        <section className="workspace-panel" aria-labelledby="account-access-heading">
          <h3 id="account-access-heading">Workspace access</h3>
          <dl className="account-details">
            <div><dt>Workspace reference</dt><dd>{session.user.organisationId || "Unavailable"}</dd></div>
            <div><dt>Session expires</dt><dd>{expiresLabel}</dd></div>
          </dl>
        </section>
        <section className="workspace-panel account-security" aria-labelledby="account-security-heading">
          <h3 id="account-security-heading">Sign-in and security</h3>
          <p>Password recovery and sign-in settings are managed by your work account.</p>
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
          <p>You become Owner; the developer becomes Superadmin. Both sessions end.</p>
          <p>Expires {new Date(handover.expires_at).toLocaleString()}.</p>
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
            <p>Awaiting approval from the selected client. Do not share sign-in codes.</p>
          )}
        </section>
      )}
    </section>
  );
}
