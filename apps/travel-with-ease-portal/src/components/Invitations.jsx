import { useEffect, useState } from "react";
import { TextField, InlineNotice, SelectField } from "@faako/ui";
import Button from "./ActionButton.jsx";
import NavigationIcon from "./NavigationIcon.jsx";
import { ActivityList } from "./ActivityView.jsx";

const deliveryLabels = {
  pending: "Email queued", processing: "Email processing",
  sent: "Email accepted by provider", failed: "Email failed",
  cancelled: "Email cancelled",
};

export default function Invitations({ api, session, installer = false }) {
  // First-Owner bootstrap retains its existing independently approved subject
  // flow. All routine staff invitations require only a recipient email.
  const [subject, setSubject] = useState("");
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [issued, setIssued] = useState(null);
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canInviteOwner = !installer && session?.user?.permissions?.includes("staff.roles.manage");
  const path = installer ? "/api/auth/activation/owner-invitation" : "/api/auth/invitations";
  const headers = installer
    ? { "X-TWE-Session-Init": "1" }
    : { "X-CSRF-Token": session.csrfToken };

  async function refresh() {
    if (installer) return;
    const response = await api.get("/api/auth/invitations", { responseMode: "data" });
    setItems(response.items);
    setEmailAvailable(response.emailAvailable === true);
    try {
      const activity = await api.get("/api/agent/administration/staff-events", { responseMode: "data" });
      setEvents(activity.items);
    } catch {
      // Auditing remains enforced server-side even when history cannot load.
    }
  }

  useEffect(() => {
    if (!installer) refresh().catch(() => setError("Invitations could not be loaded."));
  }, [api, installer]);

  async function mutate(url, json) {
    setBusy(true);
    setError("");
    try {
      const result = await api.post(url, { json, headers, responseMode: "data" });
      if (result.code || result.delivery === "queued") {
        setIssued(result);
        if (!installer) setEmail("");
      } else if (issued && url.includes(issued.id)) setIssued(null);
      // Do not tell administrators issuance failed if only history refresh fails.
      await refresh().catch(() => setError("Invitation action succeeded, but history could not be refreshed."));
    } catch {
      setError("Invitation not confirmed. Check invitation history before retrying.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="staff-invitations" data-tour="staff-invitations" aria-labelledby="invitations-heading">
      <h2 id="invitations-heading">
        {installer ? "Initial Owner invitation" : "Invite a team member"}
      </h2>
      <p>
        {installer
          ? "Enter the verified identity and approval reference for the first Owner."
          : "Enter a colleague’s email to send an invitation code."}
      </p>
      {error && <InlineNotice tone="danger" title="Invitation needs attention" message={error} />}
      <form onSubmit={(event) => {
        event.preventDefault();
        mutate(path, installer
          ? { subject, approvalReference: reference }
          : { recipientEmail: email, role: canInviteOwner ? role : "editor" });
      }}>
        {installer ? (
          <>
            <TextField
              label="Verified recipient subject" required maxLength={255}
              value={subject} onChange={(event) => setSubject(event.target.value)}
            />
            <TextField
              label="Approval reference" required
              pattern="[A-Za-z0-9][A-Za-z0-9._/-]{2,119}"
              value={reference} onChange={(event) => setReference(event.target.value)}
            />
          </>
        ) : (
          <>
            <TextField
              label="Email address" type="email" required maxLength={254}
              value={email} onChange={(event) => setEmail(event.target.value)}
            />
            {canInviteOwner && (
              <SelectField
                label="Workspace role" value={role} onChange={(event) => setRole(event.target.value)}
                options={[{ value: "editor", label: "Editor" }, { value: "owner", label: "Owner" }]}
              />
            )}
            {!emailAvailable && (
              <p role="status">Email invitations are unavailable. Contact support.</p>
            )}
          </>
        )}
        <Button type="submit" disabled={busy || (!installer && !emailAvailable)}>
          {installer ? "Create Owner invitation" : "Send invitation"}
        </Button>
      </form>
      {issued && (
        <div role="status" className="invitation-secret">
          <h3>{issued.delivery === "queued" ? "Invitation queued" : "Save this invitation now"}</h3>
          <p>
            {issued.delivery === "queued"
              ? "Waiting to send. Check invitation history for delivery status."
              : "Share this code privately."}
            {" "}Expires {new Date(issued.expiresAt).toLocaleString()}.
          </p>
          {issued.code && (
            <>
              <TextField label="Single-use invitation code" readOnly value={issued.code} autoComplete="off" />
              <Button type="button" onClick={() => setIssued(null)}>Hide code</Button>
            </>
          )}
          <Button
            type="button" disabled={busy}
            onClick={() => mutate(`${path}/${issued.id}/revoke`, {})}
          >
            Revoke invitation
          </Button>
        </div>
      )}
      {!installer && (
        <ActivityList
          title="Invitation history" emptyTitle="No invitations yet"
          emptyMessage=""
          items={items.map(item => ({
            ...item,
            action: `${item.invited_email || item.role} · ${item.accepted_at ? "Activated" : item.revoked_at ? "Revoked" : new Date(item.expires_at) <= new Date() ? "Expired" : "Pending"} · ${item.delivery_status ? (deliveryLabels[item.delivery_status] || "Email status unavailable") : "Manual code"}`,
          }))}
          renderAction={item => <>
            <p>Expires: {new Date(item.expires_at).toLocaleString()}</p>
            {!item.accepted_at && !item.revoked_at && (item.role === "editor" || canInviteOwner) &&
              <Button type="button" disabled={busy} onClick={() => mutate(`${path}/${item.id}/revoke`, {})}>
                Revoke invitation
              </Button>}
          </>}
        />
      )}
      {!installer && (
        <details className="twe-admin-disclosure">
          <summary><span>Staff access audit history</span><NavigationIcon name="arrow"/></summary>
          <ActivityList
            title="Staff access audit history" emptyTitle="No staff access changes yet"
            emptyMessage="Role and access changes will appear here." items={events}
          />
        </details>
      )}
    </section>
  );
}
