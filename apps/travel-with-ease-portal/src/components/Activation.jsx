import { useState } from "react";
import { TextField, InlineNotice } from "@faako/ui";
import Button from "./ActionButton.jsx";
import Invitations from "./Invitations.jsx";
import "../styles/activation.css";

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
        "We couldn't activate this account. Check your invitation or contact your workspace owner.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="activation-panel" aria-labelledby="activation-heading">
      <h2 id="activation-heading">Activate your account</h2>
      <p className="activation-identity">Signed in as <strong>{status.email || status.subject}</strong></p>
      {status.status === "disabled" ? (
        <InlineNotice
          tone="warning"
          title="Account disabled"
          message="Contact your workspace owner."
        />
      ) : complete ? (
        <div role="status">
          <h3>Your {complete.role} account is ready</h3>
          <Button type="button" onClick={onActivated}>
            Enter workspace
          </Button>
        </div>
      ) : (
        <form onSubmit={claim}>
          <p>Enter the invitation code sent to your email.</p>
          {invitation ? (
            <p role="status">
              <strong>{invitation.role === "owner" ? "Owner" : "Editor"} access</strong> · Expires{" "}
              {new Date(invitation.expiresAt).toLocaleString()}
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
      {(error || status.status === "disabled") && (
        <Button type="button" disabled={busy} onClick={onActivated}>
          Check account status
        </Button>
      )}
      {status.canIssueOwner && !complete && <Invitations api={api} installer />}
    </section>
  );
}
