import { useEffect, useState } from "react";
import { TextField, InlineNotice, SelectField } from "@faako/ui";
import Button from "./ActionButton.jsx";
import { ActivityList } from './ActivityView.jsx';

export default function Invitations({ api, session, installer = false }) {
  const [subject, setSubject] = useState("");
  const [reference, setReference] = useState("");
  const [issued, setIssued] = useState(null);
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [role,setRole]=useState('editor');
  const [deliveryMethod, setDeliveryMethod] = useState("manual");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailAvailable, setEmailAvailable] = useState(false);
  const canInviteOwner=!installer&&session?.user.permissions?.includes('staff.roles.manage');
  const deliveryLabels = {
    pending: "Email queued", processing: "Email processing",
    sent: "Email accepted by provider", failed: "Email failed",
    cancelled: "Email cancelled",
  };
  const path = installer
    ? "/api/auth/activation/owner-invitation"
    : "/api/auth/invitations";
  const headers = installer
    ? { "X-TWE-Session-Init": "1" }
    : { "X-CSRF-Token": session.csrfToken };
  useEffect(() => {
    if (!installer)
      api
        .get("/api/auth/invitations", { responseMode: "data" })
        .then((result) => {
          setItems(result.items);
          setEmailAvailable(result.emailAvailable === true);
          setDeliveryMethod(result.emailAvailable === true ? "email" : "manual");
        })
        .catch(() => setError("Invitations could not be loaded."));
    if (!installer)
      api
        .get("/api/agent/administration/staff-events", { responseMode: "data" })
        .then((result) => setEvents(result.items))
        .catch(() => setError("Staff audit history could not be loaded."));
  }, [api, installer]);
  async function mutate(url, json) {
    setBusy(true);
    setError("");
    try {
      const result = await api.post(url, {
        json,
        headers,
        responseMode: "data",
      });
      if (result.code || result.delivery === "queued") setIssued(result);
      else if (issued && url.includes(issued.id)) setIssued(null);
      if (!installer) {
        const list = await api.get(path, { responseMode: "data" });
        setItems(list.items);
        setEmailAvailable(list.emailAvailable === true);
      }
      if (!installer)
        setEvents(
          (
            await api.get("/api/agent/administration/staff-events", {
              responseMode: "data",
            })
          ).items,
        );
    } catch {
      setError(
        "Invitation action was not completed or its confirmation was lost. Reload the list before retrying. Issuing another invitation for the same identity revokes the earlier one.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="staff-invitations"
      data-tour="staff-invitations"
      aria-labelledby="invitations-heading"
    >
      <h2 id="invitations-heading">
        {installer ? "Initial Owner invitation" : canInviteOwner ? 'Invite a team member' : "Invite an Editor"}
      </h2>
      <p>
        Independently verify the recipient's Cloudflare Access subject and email address.
        Email invitations are queued for delivery; access still requires the
        verified identity and a single-use code. You can also share a manual code privately.
      </p>
      {error && (
        <InlineNotice
          tone="danger"
          title="Invitation not confirmed"
          message={error}
        />
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutate(path, {
            subject, approvalReference: reference,
            ...(!installer ? {
              role,
              sendEmail: deliveryMethod === "email",
              ...(deliveryMethod === "email" ? { recipientEmail } : {}),
            } : {}),
          });
        }}
      >
        {canInviteOwner&&<SelectField label="Invitation role" value={role} onChange={event=>setRole(event.target.value)} options={[{value:'editor',label:'Editor'},{value:'owner',label:'Owner'}]} />}
        <TextField
          label="Verified recipient subject"
          required
          maxLength={255}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
        {!installer && (
          <>
            <SelectField
              label="Invitation delivery"
              value={deliveryMethod}
              onChange={(event) => setDeliveryMethod(event.target.value)}
              options={emailAvailable
                ? [{ value: "email", label: "Email invitation" }, { value: "manual", label: "Manual activation code" }]
                : [{ value: "manual", label: "Manual activation code" }]}
            />
            {!emailAvailable && <p>Automatic invitation emails are not enabled in this environment. Create a manual code until the verified email worker is configured.</p>}
            {emailAvailable && deliveryMethod === "email" && (
              <TextField
                label="Recipient email"
                type="email"
                required
                maxLength={254}
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                hint="Verify that this address belongs to the selected Cloudflare Access identity. Staging delivery goes to the TWE testing mailbox."
              />
            )}
          </>
        )}
        <TextField
          label="Approval reference"
          required
          pattern="[A-Za-z0-9][A-Za-z0-9._/-]{2,119}"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <Button type="submit" disabled={busy}>
          {installer || deliveryMethod === "manual" ? "Create" : "Queue"} {installer || role==='owner' ? "Owner" : "Editor"} invitation
        </Button>
      </form>
      {issued && (
        <div role="status" className="invitation-secret">
          <h3>{issued.delivery === "queued" ? "Invitation queued" : "Save this invitation now"}</h3>
          <p>
            {issued.delivery === "queued"
              ? "The invitation is saved and queued, not yet confirmed as delivered. Staff access remains identity-bound. Check the invitation history for delivery status."
              : "This code is shown only in this session. Share it through your approved private channel."}
            {" "}It expires {new Date(issued.expiresAt).toLocaleString()}.
          </p>
          {issued.code && (
            <>
              <TextField
                label="Single-use invitation code"
                readOnly
                value={issued.code}
                autoComplete="off"
              />
              <Button type="button" onClick={() => setIssued(null)}>
                Hide code
              </Button>
            </>
          )}
          <Button
            type="button"
            disabled={busy}
            onClick={() => mutate(`${path}/${issued.id}/revoke`, {})}
          >
            Revoke this invitation
          </Button>
        </div>
      )}
      {!installer && (
        <ActivityList title="Invitation history" emptyTitle="No invitations yet" emptyMessage="Created staff invitations will appear here." items={items.map(item=>({...item,action:`${item.role} invitation · ${item.accepted_at?'Accepted':item.revoked_at?'Revoked':new Date(item.expires_at)<=new Date()?'Expired':'Pending'} · ${item.delivery_status ? (deliveryLabels[item.delivery_status] || "Email status unavailable") : "Manual code"}`}))}
          renderAction={item=><>
            <p>Expires: {new Date(item.expires_at).toLocaleString()}</p>
            {!item.accepted_at&&!item.revoked_at&&(item.role==='editor'||canInviteOwner)&&<Button type="button" disabled={busy} onClick={()=>mutate(`${path}/${item.id}/revoke`,{})}>Revoke invitation</Button>}
          </>}/>
      )}
      {!installer && (
        <details>
          <summary>Staff access audit history</summary>
          <ActivityList title="Staff access audit history" emptyTitle="No staff access changes yet" emptyMessage="Role and access changes will appear here." items={events}/>
        </details>
      )}
    </section>
  );
}
