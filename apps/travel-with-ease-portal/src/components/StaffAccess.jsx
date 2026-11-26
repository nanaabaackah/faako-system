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
import NavigationIcon from "./NavigationIcon.jsx";
import "../styles/activity.css";
import "../styles/activation.css";

export default function StaffAccess({ api, session }) {
  const [staff, setStaff] = useState([]),
    [subject, setSubject] = useState(""),
    [reason, setReason] = useState(""),
    [handoverClient, setHandoverClient] = useState(""),
    [handoverReference, setHandoverReference] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const owner = session.user.role === "owner";
  const allowed = owner || session.user.role === "platform_admin";
  const canAssign = session.user.permissions?.includes('staff.roles.manage');
  const [search,setSearch]=useState("");
  const [staffStatus,setStaffStatus]=useState("all");
  const [expandedStaff,setExpandedStaff]=useState(null);
  const [roleTarget,setRoleTarget]=useState(null);
  const [nextRole,setNextRole]=useState('editor');
  const [approval,setApproval]=useState('');
  const [accessConfirmation,setAccessConfirmation]=useState(null);
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
  useEffect(() => {
    if (!handoverClient) {
      const client = staff.find((user) => user.active && user.role === "editor");
      if (client) setHandoverClient(client.id);
    }
  }, [staff, handoverClient]);
  if (!allowed) return null;
  async function mutate(path, json) {
    setBusy(true);
    setMessage("");
    try {
      await api.post(`/api/agent/administration/${path}`, {
        json,
        responseMode: "data",
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      // A successful mutation must not be mistaken for a failed write when
      // refreshing the roster fails.
      try { await load(); }
      catch { setMessage("Action recorded. Refresh staff before making another change."); return true; }
      setMessage(
        path === "support-grants" ? "Support access approved for 15 minutes." : "Action recorded.",
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
        <h2 id="staff-access-heading">Staff accounts</h2>
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
           />
          <KpiCard
            label="Active"
            value={staff.filter((user) => user.active).length}
           />
          <KpiCard
            label="Editors"
            value={staff.filter((user) => user.role === "editor").length}
           />
        </div>
      )}
      {message && (
        <InlineNotice title="Staff access result" message={message} />
      )}
      <div className="twe-admin-toolbar">
        <TextField label="Search staff" value={search} onChange={event => setSearch(event.target.value)}/>
        <SelectField label="Account status" value={staffStatus} onChangeValue={setStaffStatus} options={[{value:"all",label:"All accounts"},{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/>
        <Button type="button" icon="refresh" disabled={busy || loading} onClick={async () => { setLoading(true); setMessage(""); try { await load(); } catch { setMessage("Staff information is unavailable. Check your session."); } finally { setLoading(false); } }}>Refresh staff</Button>
      </div>
      {!loading && <ul className="staff-list twe-admin-staff-list">
        {staff.filter(user => (staffStatus === "all" || (staffStatus === "active") === user.active) &&
          [user.id, user.role === "platform_admin" ? "Superadmin" : user.role].some(value => String(value).toLowerCase().includes(search.trim().toLowerCase()))).map((user) => (
          <li key={user.id}>
            <button type="button" className="twe-admin-staff-row" aria-expanded={expandedStaff === user.id}
              onClick={() => setExpandedStaff(current => current === user.id ? null : user.id)}>
              <NavigationIcon name="staff"/>
              <span className="staff-identity">
                <strong>{user.role === "platform_admin" ? "Superadmin" : user.role.replaceAll("_", " ")}</strong>
                <small>{user.id === session.user.id ? "Your account" : user.id}</small>
              </span>
              <StatusPill tone={user.active ? "success" : "neutral"}>{user.active ? "Active" : "Inactive"}</StatusPill>
              <NavigationIcon name={expandedStaff === user.id ? "down" : "arrow"}/>
            </button>
            {expandedStaff === user.id && <div className="twe-admin-staff-detail">
              <dl><dt>Account reference</dt><dd><code>{user.id}</code></dd></dl>
              {owner && user.role === "platform_admin" && user.active && <TextField label="Approved support ticket reference" maxLength={120} value={reason} onChange={event => setReason(event.target.value)} placeholder="SUP-123"/>}
              <div className="editor-actions">
            {['editor','owner'].includes(user.role) && (user.role === 'editor' || canAssign) && (
              <Button
                variant={user.active ? "danger" : "primary"}
                type="button"
                disabled={busy}
                onClick={() => setAccessConfirmation({ title: `${user.active ? "Revoke" : "Activate"} ${user.role} access?`, message: "Existing sessions will be revoked.", label: user.active ? "Revoke access" : "Activate", run: () => mutate(`staff/${user.id}/status`, { active: !user.active }) })}
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
                onClick={() => setAccessConfirmation({ title: "Revoke staff sessions?", message: "This ends the staff member’s local sessions and support grants.", label: "Revoke sessions", run: () => mutate(`staff/${user.id}/revoke-sessions`, {}) })}
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
                onClick={() => setAccessConfirmation({ title: "Approve temporary support access?", message: "This permits read-only private client-record access for 15 minutes and will be audited.", label: "Approve support access", run: () => mutate("support-grants", {
                      userId: user.id,
                      reasonReference: reason,
                      minutes: 15,
                    }) })}
              >
                Approve 15-minute support
              </Button>
            )}
              </div>
            </div>}
          </li>
        ))}
        {!staff.some(user => (staffStatus === "all" || (staffStatus === "active") === user.active) &&
          [user.id, user.role === "platform_admin" ? "Superadmin" : user.role].some(value => String(value).toLowerCase().includes(search.trim().toLowerCase()))) && <li className="twe-admin-empty">No matching staff accounts.</li>}
      </ul>}
      <details className="twe-admin-disclosure">
        <summary><span>Invitations and access setup</span><NavigationIcon name="arrow"/></summary>
        <div className="twe-admin-disclosure-body">
      <Invitations api={api} session={session} />
      {owner && !staff.some((user) => user.active && user.role === "platform_admin") && (
        <form
          className="staff-provision"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await mutate("handover", { clientId: handoverClient, approvalReference: handoverReference })) {
              setHandoverReference("");
              setMessage("Handover requested. The selected client must approve it in Account settings within 10 minutes.");
            }
          }}
        >
          <div>
            <h3>Request staging handover</h3>
            <p>The selected client becomes Owner; the developer becomes Superadmin. Both sessions will end.</p>
          </div>
          <SelectField
            label="Client approver"
            value={handoverClient}
            onChange={(event) => setHandoverClient(event.target.value)}
            options={staff.filter((user) => user.active && user.role === "editor").map((user) => ({ value: user.id, label: user.id }))}
          />
          <TextField
            label="Handover approval reference"
            value={handoverReference}
            maxLength={120}
            placeholder="TWE-STAGING-HANDOVER"
            onChange={(event) => setHandoverReference(event.target.value)}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !handoverClient || !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(handoverReference)}
          >
            Request client approval
          </Button>
        </form>
      )}
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
 
        </div>
      </details>
      <ERPConfirmDialog open={Boolean(roleTarget)} title="Change staff role" confirmTone="primary" confirmLabel="Confirm role change" loading={busy}
        disabled={!/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(approval)||nextRole===roleTarget?.role}
        onCancel={()=>setRoleTarget(null)} onClose={()=>{if(!busy)setRoleTarget(null);}}
        onConfirm={async()=>{if(await mutate(`staff/${roleTarget.id}/role`,{role:nextRole,expectedRole:roleTarget.role,approvalReference:approval}))setRoleTarget(null);}}>
        <p>Changing {roleTarget?.id} from {roleTarget?.role} ends their active sessions.</p>
        <SelectField label="New role" value={nextRole} onChange={event=>setNextRole(event.target.value)} options={[{value:'editor',label:'Editor'},{value:'owner',label:'Owner'}]} />
        <p>{nextRole==='owner'?'Owners can publish and manage staff.':'Editors can draft content but cannot publish or manage staff.'}</p>
        <TextField label="Role change approval reference" value={approval} maxLength={120} onChange={event=>setApproval(event.target.value)} />
        <p>The last active Owner cannot be changed. Affected sessions and approvals will end.</p>
      </ERPConfirmDialog>
      <ERPConfirmDialog open={Boolean(accessConfirmation)} title={accessConfirmation?.title} message={accessConfirmation?.message} confirmLabel={accessConfirmation?.label} loading={busy}
        onCancel={() => setAccessConfirmation(null)} onConfirm={async () => { const action = accessConfirmation; if (await action?.run()) setAccessConfirmation(null); }} />
    </section>
  );
}
