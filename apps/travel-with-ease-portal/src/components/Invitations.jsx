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
  const canInviteOwner=!installer&&session?.user.permissions?.includes('staff.roles.manage');
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
        .then((result) => setItems(result.items))
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
      if (result.code) setIssued(result);
      else if (issued && url.includes(issued.id)) setIssued(null);
      if (!installer)
        setItems((await api.get(path, { responseMode: "data" })).items);
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
        Independently verify the recipient's Cloudflare Access subject. Deliver
        the invitation code through your approved private channel. It is not an
        email address, password or permanent credential.
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
          mutate(path, { subject, approvalReference: reference,...(!installer?{role}: {}) });
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
        <TextField
          label="Approval reference"
          required
          pattern="[A-Za-z0-9][A-Za-z0-9._/-]{2,119}"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <Button type="submit" disabled={busy}>
          Create {installer || role==='owner' ? "Owner" : "Editor"} invitation
        </Button>
      </form>
      {issued && (
        <div role="status" className="invitation-secret">
          <h3>Save this invitation now</h3>
          <p>
            This code is shown only in this session. It expires{" "}
            {new Date(issued.expiresAt).toLocaleString()} and works only for the
            verified recipient.
          </p>
          <TextField
            label="Single-use invitation code"
            readOnly
            value={issued.code}
            autoComplete="off"
          />
          <Button type="button" onClick={() => setIssued(null)}>
            Hide code
          </Button>
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
        <ActivityList title="Invitation history" items={items.map(item=>({...item,action:`${item.role} invitation · ${item.accepted_at?'Accepted':item.revoked_at?'Revoked':new Date(item.expires_at)<=new Date()?'Expired':'Pending'}`}))}
          renderAction={item=><>
            <p>Expires: {new Date(item.expires_at).toLocaleString()}</p>
            {!item.accepted_at&&!item.revoked_at&&(item.role==='editor'||canInviteOwner)&&<Button type="button" disabled={busy} onClick={()=>mutate(`${path}/${item.id}/revoke`,{})}>Revoke invitation</Button>}
          </>}/>
      )}
      {!installer && (
        <details>
          <summary>Staff access audit history</summary>
          <ActivityList title="Staff access audit history" items={events}/>
        </details>
      )}
    </section>
  );
}
