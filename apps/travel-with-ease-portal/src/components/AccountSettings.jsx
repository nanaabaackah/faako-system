import Button from "./ActionButton.jsx";
import { useEffect, useState } from "react";
import { IconsaxIcon, InlineNotice, StatusPill, ERPConfirmDialog } from "@faako/ui";
import "../styles/account-settings.css";
import "../styles/activity.css";

export default function AccountSettings({ api, session, onLogout, onHandoverCompleted }) {
  const [handover, setHandover] = useState(null);
  const [handoverMessage, setHandoverMessage] = useState("");
  const [handoverBusy, setHandoverBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
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
        <h2 id="account-settings-heading">Account settings</h2>
      </header>
      <div className="account-summary">
        <span className="account-summary__icon"><IconsaxIcon name="ShieldTick" /></span>
        <div>
          <h3>Your staff account</h3>
          <p>Session expires: {expiresLabel}</p>
        </div>
        <StatusPill tone="neutral"><span className="account-role">{role}</span></StatusPill>
      </div>
      <div className="account-grid">
        <section className="workspace-panel" aria-labelledby="account-access-heading">
          <h3 id="account-access-heading">Workspace access</h3>
          <details className="twe-admin-disclosure">
            <summary><span>Workspace reference</span><IconsaxIcon name="ArrowRight4"/></summary>
            <div className="twe-admin-disclosure-body"><code>{session.user.organisationId || "Unavailable"}</code></div>
          </details>
        </section>
        <section className="workspace-panel account-security" aria-labelledby="account-security-heading">
          <h3 id="account-security-heading">Sign-in and security</h3>
          <p>Password recovery and sign-in settings are managed by your work account.</p>
          <div className="editor-actions">
            <Button type="button" icon="logout" onClick={() => onLogout(false)}>Sign out this device</Button>
            <Button
              type="button"
              variant="danger"
              icon="logout"
              onClick={() => setConfirmation({ kind: "logout", title: "Sign out all devices?", message: "Every active Travel With Ease portal session for this account will end.", label: "Sign out all devices" })}
            >Sign out all devices</Button>
          </div>
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
              loading={handoverBusy}
              loadingLabel="Approving handover…"
              onClick={() => setConfirmation({ kind: "handover", title: "Approve staging handover?", message: "You will become Owner, the developer will become Superadmin, and both application sessions will end.", label: "Approve and sign out" })}
            >
              Approve handover and sign out
            </Button>
          ) : (
            <p>Awaiting approval from the selected client. Do not share sign-in codes.</p>
          )}
        </section>
      )}
      <ERPConfirmDialog open={Boolean(confirmation)} title={confirmation?.title} message={confirmation?.message} confirmLabel={confirmation?.label} loading={handoverBusy}
        onCancel={() => setConfirmation(null)} onConfirm={async () => {
          const kind = confirmation?.kind;
          setConfirmation(null);
          if (kind === "logout") { onLogout(true); return; }
          if (kind === "handover") {
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
          }
        }} />
    </section>
  );
}
