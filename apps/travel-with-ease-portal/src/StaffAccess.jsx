import Button from "./ActionButton.jsx";
import { useCallback, useEffect, useState } from "react";
import {
  TextField,
  KpiCard,
  StatusPill,
  InlineNotice,
  AnimatedLoadingState,
  SelectField,
  ERPConfirmDialog,
} from "@faako/ui";
import Invitations from "./Invitations.jsx";
import "./activation.css";

export default function StaffAccess({ api, session }) {
  const [staff, setStaff] = useState([]),
    [subject, setSubject] = useState(""),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const owner = session.user.role === "owner";
  const allowed = owner || session.user.role === "platform_admin";
  const canAssign = session.user.permissions?.includes('staff.roles.manage');
  const [roleTarget,setRoleTarget]=useState(null);
  const [nextRole,setNextRole]=useState('editor');
  const [approval,setApproval]=useState('');
  const load = useCallback(
    () =>
      api
        .get("/api/agent/administration/staff", { responseMode: "data" })
        .then((data) => setStaff(data.items)),
    [api],
  );
  useEffect(() => {
    let active = true;
    if (allowed) {
      setLoading(true);
      load()
        .catch(() =>
          setMessage("Staff information is unavailable. Check your session."),
        )
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [load, allowed]);
  if (!allowed) return null;
  async function mutate(path, json) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api.post(`/api/agent/administration/${path}`, {
        json,
        responseMode: "data",
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      await load();
      setMessage(
        session.demo ? 'Demo updated in this tab only. No real account, session or invitation was changed.' : `Action recorded${path === "support-grants" ? `; support grant ${result.id} expires within 15 minutes` : ""}.`,
      );
      return true;
    } catch (error) {
      setMessage(
        error.message || "Action was not completed. Your permission or session may have changed; refresh before retrying.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="staff-workspace" aria-labelledby="staff-access-heading">
      <div className="workspace-intro">
        <h2 id="staff-access-heading">Your team, with the right access</h2>
        <p>
          Provision verified identities and review who can use this workspace.
        </p>
      </div>
      {loading ? (
        <AnimatedLoadingState
          compact
          title="Loading staff access"
          message="Retrieving this workspace’s authorised team."
        />
      ) : (
        <div className="workspace-kpis">
          <KpiCard
            label="Staff accounts"
            value={staff.length}
            detail="Accounts returned for this workspace"
          />
          <KpiCard
            label="Active"
            value={staff.filter((user) => user.active).length}
            detail="Currently enabled"
          />
          <KpiCard
            label="Editors"
            value={staff.filter((user) => user.role === "editor").length}
            detail="Business content role"
          />
        </div>
      )}
      <p>
        Use the independently verified Cloudflare subject—not an email address.
        New accounts are Editors. Owners and Superadmins can provision them.
        Superadmins can assign Owner or Editor. Superadmin assignment requires
        a reviewed administrative procedure. At least one active Owner must remain.
      </p>
      {message && (
        <InlineNotice title="Staff access result" message={message} />
      )}
      {allowed && <Invitations api={api} session={session} />}
      {!owner && (
        <form
          className="staff-provision"
          onSubmit={(event) => {
            event.preventDefault();
            mutate("staff", { subject });
          }}
        >
          <TextField
            label="Verified Access subject"
            hint="Use the verified stable identity, not an email address."
            required
            maxLength={255}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <Button icon="plus" variant="primary" type="submit" disabled={busy}>
            Provision Editor
          </Button>
        </form>
      )}
      {owner && (
        <TextField
          label="Approved support ticket reference"
          maxLength={120}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="SUP-123"
        />
      )}
      <ul className="staff-list">
        {staff.map((user) => (
          <li key={user.id}>
            <div className="staff-identity">
              <strong>{user.role === "platform_admin" ? "Superadmin" : user.role.replaceAll("_", " ")}</strong>
              <code>{user.id}</code>
            </div>
            <StatusPill tone={user.active ? "success" : "neutral"}>
              {user.active ? "Active" : "Inactive"}
            </StatusPill>
            {['editor','owner'].includes(user.role) && (user.role === 'editor' || canAssign) && (
              <Button
                variant={user.active ? "danger" : "primary"}
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `${user.active ? "Revoke" : "Activate"} this ${user.role}? Existing sessions will be revoked.`,
                    )
                  )
                    mutate(`staff/${user.id}/status`, { active: !user.active });
                }}
              >
                {user.active ? "Revoke access" : "Activate"}
              </Button>
            )}
            {canAssign && ['owner','editor'].includes(user.role) && (
              <Button icon="staff" type="button" disabled={busy} onClick={()=>{setRoleTarget(user);setNextRole(user.role==='owner'?'editor':'owner');setApproval('');}}>Change role</Button>
            )}
            {(!owner || user.role === "editor") && (
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Revoke this staff member’s local sessions and support grants?",
                    )
                  )
                    mutate(`staff/${user.id}/revoke-sessions`, {});
                }}
              >
                Revoke sessions
              </Button>
            )}
            {owner && user.role === "platform_admin" && user.active && (
              <Button
                type="button"
                disabled={
                  busy || !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(reason)
                }
                onClick={() => {
                  if (
                    window.confirm(
                      "Approve read-only enquiry support for 15 minutes? This permits private client-record access and will be audited.",
                    )
                  )
                    mutate("support-grants", {
                      userId: user.id,
                      reasonReference: reason,
                      minutes: 15,
                    });
                }}
              >
                Approve 15-minute support
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ERPConfirmDialog open={Boolean(roleTarget)} title="Change staff role" confirmTone="primary" confirmLabel="Confirm role change" loading={busy}
        disabled={!/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(approval)||nextRole===roleTarget?.role}
        onCancel={()=>setRoleTarget(null)} onClose={()=>{if(!busy)setRoleTarget(null);}}
        onConfirm={async()=>{if(await mutate(`staff/${roleTarget.id}/role`,{role:nextRole,expectedRole:roleTarget.role,approvalReference:approval}))setRoleTarget(null);}}>
        <p>Account {roleTarget?.id}. Current role: {roleTarget?.role}. This account will need to sign in again.</p>
        <SelectField label="New role" value={nextRole} onChange={event=>setNextRole(event.target.value)} options={[{value:'editor',label:'Editor'},{value:'owner',label:'Owner'}]} />
        <p>{nextRole==='owner'?'Owners can publish and manage Editors. They do not gain Faako system administration.':'Editors can draft content and manage permitted media/enquiries, but cannot publish or manage staff.'}</p>
        <TextField label="Role change approval reference" value={approval} maxLength={120} onChange={event=>setApproval(event.target.value)} />
        <p>Changing the last active Owner is blocked. Existing sessions and affected approvals are revoked.</p>
      </ERPConfirmDialog>
    </section>
  );
}
