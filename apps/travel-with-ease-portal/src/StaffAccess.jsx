import { useCallback, useEffect, useState } from "react";
import { Button, InlineNotice } from "@faako/ui";

export default function StaffAccess({api,session}) {
  const [staff,setStaff]=useState([]),[subject,setSubject]=useState(""),[reason,setReason]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const owner=session.user.role==="owner";
  const allowed=owner || session.user.role==="platform_admin";
  const load=useCallback(()=>api.get("/api/agent/administration/staff",{responseMode:"data"}).then(data=>setStaff(data.items)),[api]);
  useEffect(()=>{if(allowed)load().catch(()=>setMessage("Staff information is unavailable. Check your session."));},[load,allowed]);
  if (!allowed) return null;
  async function mutate(path,json) {
    setBusy(true);setMessage("");
    try { const result=await api.post(`/api/agent/administration/${path}`,{json,responseMode:"data",headers:{"X-CSRF-Token":session.csrfToken}});await load();setMessage(`Action recorded${path==="support-grants"?`; support grant ${result.id} expires within 15 minutes`:""}.`); }
    catch {setMessage("Action was not completed. Your permission or session may have changed; refresh before retrying.");}
    finally {setBusy(false);}
  }
  return <section aria-labelledby="staff-access-heading"><h2 id="staff-access-heading">Staff access</h2>
    <p>Use the independently verified Cloudflare subject—not an email address. New accounts are Editors. Platform operators stage inactive accounts; an Owner activates them. Owner and platform role assignment requires a reviewed administrative procedure.</p>
    {message && <InlineNotice title="Staff access result" message={message}/>}
    <form onSubmit={event=>{event.preventDefault();mutate("staff",{subject});}}>
      <label>Verified Access subject<input required maxLength={255} value={subject} onChange={event=>setSubject(event.target.value)}/></label>
      <Button type="submit" disabled={busy}>{owner?"Provision Editor":"Stage Editor for Owner approval"}</Button>
    </form>
    {owner && <label>Approved support ticket reference<input maxLength={120} value={reason} onChange={event=>setReason(event.target.value)} placeholder="SUP-123"/></label>}
    <ul>{staff.map(user=><li key={user.id}><code>{user.id}</code> — {user.role}, {user.active?"active":"inactive"}
      {user.role==="editor" && (user.active || owner) && <Button type="button" disabled={busy} onClick={()=>{if(window.confirm(`${user.active?"Revoke":"Activate"} this Editor? Existing sessions will be revoked.`))mutate(`staff/${user.id}/status`,{active:!user.active});}}>{user.active?"Revoke access":"Activate"}</Button>}
      {!owner && <Button type="button" disabled={busy} onClick={()=>{if(window.confirm("Revoke this staff member’s local sessions and support grants?"))mutate(`staff/${user.id}/revoke-sessions`,{});}}>Revoke sessions</Button>}
      {owner && user.role==="platform_admin" && user.active && <Button type="button" disabled={busy || !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(reason)} onClick={()=>{if(window.confirm("Approve read-only enquiry support for 15 minutes? This permits private client-record access and will be audited."))mutate("support-grants",{userId:user.id,reasonReference:reason,minutes:15});}}>Approve 15-minute support</Button>}
    </li>)}</ul>
  </section>;
}
