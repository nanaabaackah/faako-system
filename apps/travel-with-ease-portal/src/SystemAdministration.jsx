import { useEffect, useState } from "react";
import { Button, InlineNotice } from "@faako/ui";
import StaffAccess from "./StaffAccess.jsx";

export default function SystemAdministration({ api, session }) {
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const allowed=session.user.role==="platform_admin" && session.user.permissions?.includes("system.read");
  useEffect(()=> {
    if (!allowed) return;
    let current=true;
    Promise.all([api.get("/api/agent/administration/diagnostics",{responseMode:"data"}),api.get("/api/agent/administration/security-events",{responseMode:"data"})])
      .then(([diagnostics,events])=>{if(current)setData({diagnostics,events});})
      .catch(()=>{if(current)setError("System information is unavailable or your access has expired. Check your session.");});
    return()=>{current=false;};
  },[api,allowed]);
  if (!allowed) return <p role="alert">System Administration requires platform permission.</p>;
  return <section aria-labelledby="system-heading"><h2 id="system-heading">System Administration</h2>
    <StaffAccess api={api} session={session}/>
    <p>Technical access only. Client records require a separate, Owner-approved support grant lasting at most 30 minutes.</p>
    {error && <InlineNotice tone="danger" title="Request unsuccessful" message={error}/>}
    {!data && !error && <p role="status">Loading system diagnostics…</p>}
    {data && <><dl><dt>Environment</dt><dd>{data.diagnostics.environment}</dd><dt>Database</dt><dd>{data.diagnostics.database}</dd><dt>Authentication</dt><dd>{data.diagnostics.authentication}</dd><dt>Hosted security acceptance</dt><dd>{data.diagnostics.hostedAcceptance}</dd></dl>
      <h3>Publication jobs</h3><ul>{data.diagnostics.publication.map(item=><li key={item.status}>{item.status}: {item.count}</li>)}</ul>
      <h3>Notification jobs</h3><ul>{data.diagnostics.notifications.map(item=><li key={item.status}>{item.status}: {item.count}</li>)}</ul>
      <h3>Recent security events</h3><ul>{data.events.items.map(event=><li key={event.id}>{event.action} — {new Date(event.created_at).toLocaleString()}</li>)}</ul>
      <Button type="button" onClick={()=>{setData(null);setError("Use Check connection again to verify the current session before reopening this section.");}}>Clear displayed information</Button>
    </>}
  </section>;
}
