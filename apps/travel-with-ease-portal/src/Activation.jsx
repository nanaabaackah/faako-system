import { useState } from "react";
import { TextField, InlineNotice } from "@faako/ui";
import Button from "./ActionButton.jsx";
import Invitations from "./Invitations.jsx";
import "./activation.css";

export default function Activation({ status, api, onActivated }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(null);
  const [invitation, setInvitation] = useState(null);
  async function claim(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!invitation) {
        setInvitation(
          await api.post("/api/auth/activation/preview", {
            json: { code },
            responseMode: "data",
            headers: { "X-TWE-Session-Init": "1" },
          }),
        );
        return;
      }
      const result = await api.post("/api/auth/activation/claim", {
        json: { code },
        responseMode: "data",
        headers: { "X-TWE-Session-Init": "1" },
      });
      setCode("");
      setComplete(result);
    } catch {
      setCode("");
      setInvitation(null);
      setError(
        "Activation was not confirmed. The code may be expired, revoked, already used or issued for another identity. Check account status before requesting a replacement. Disabled accounts require an Owner's review.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="activation-panel" aria-labelledby="activation-heading">
      <h2 id="activation-heading">Welcome to Travel With Ease</h2>
      <p>
        Your identity has passed Cloudflare Access verification. Workspace
        access is a separate, approved step.
      </p>
      <dl>
        <dt>Workspace</dt>
        <dd>{status.organisation}</dd>
        <dt>Your verified subject</dt>
        <dd>
          <code>{status.subject}</code>
        </dd>
      </dl>
      {status.status === "disabled" ? (
        <InlineNotice
          tone="warning"
          title="Account disabled"
          message="Contact your workspace Owner. An invitation cannot reactivate this account."
        />
      ) : complete ? (
        <div role="status">
          <h3>Your {complete.role} account is ready</h3>
          <p>
            Continue to your workspace introduction. You can skip the guide or
            return to it later.
          </p>
          <Button type="button" onClick={onActivated}>
            Enter workspace
          </Button>
        </div>
      ) : (
        <form onSubmit={claim}>
          <h3>Activate your approved account</h3>
          <p>
            Enter the single-use invitation supplied by your workspace Owner or
            authorised installer. Your role is set by that invitation, never by
            this form.
          </p>
          {invitation ? (
            <p role="status">
              Activate as <strong>{invitation.role}</strong> in{" "}
              <strong>{status.organisation}</strong>. The invitation expires{" "}
              {new Date(invitation.expiresAt).toLocaleString()}.
            </p>
          ) : (
            <TextField
              label="Invitation code"
              autoComplete="off"
              required
              minLength={43}
              maxLength={43}
              value={code}
              onChange={(event) => setCode(event.target.value.trim())}
            />
          )}
          <Button type="submit" disabled={busy}>
            {invitation ? "Confirm account activation" : "Review invitation"}
          </Button>
          {invitation && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setInvitation(null);
                setCode("");
              }}
            >
              Use another invitation
            </Button>
          )}
        </form>
      )}
      {error && (
        <InlineNotice
          tone="danger"
          title="Activation needs attention"
          message={error}
        />
      )}
      <Button type="button" disabled={busy} onClick={onActivated}>
        Check account status
      </Button>
      {status.canIssueOwner && !complete && <Invitations api={api} installer />}
    </section>
  );
}
