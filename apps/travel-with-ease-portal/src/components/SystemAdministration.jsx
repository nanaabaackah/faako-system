import Button from "./ActionButton.jsx";
import { useEffect, useState } from "react";
import { DataTable,InlineNotice, AnimatedLoadingState } from "@faako/ui";
import StaffAccess from "./StaffAccess.jsx";
import ActivityView from './ActivityView.jsx';

export default function SystemAdministration({ api, session }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refresh,setRefresh]=useState(0);
  const allowed =
    session.user.role === "platform_admin" &&
    session.user.permissions?.includes("system.read");
  useEffect(() => {
    if (!allowed) return;
    let current = true;
    setError('');setData(null);
      api.get("/api/agent/administration/diagnostics", {
        responseMode: "data",
      })
      .then(diagnostics => {
        if (current) setData({ diagnostics });
      })
      .catch(() => {
        if (current)
          setError(
            "System information is unavailable or your access has expired. Check your session.",
          );
      });
    return () => {
      current = false;
    };
  }, [api, allowed,refresh]);
  if (!allowed)
    return (
      <p role="alert">System Administration requires platform permission.</p>
    );
  return (
    <section className="system-workspace" aria-labelledby="system-heading">
      <h2 id="system-heading">System Administration</h2>
      <StaffAccess api={api} session={session} />
      <p>Superadmin application access is tenant-scoped and audited. It does not grant provider-account ownership or infrastructure credentials.</p>
      <Button icon="refresh" type="button" disabled={!data&&!error} onClick={()=>setRefresh(value=>value+1)}>Refresh diagnostics</Button>
      {error && (
        <InlineNotice
          tone="danger"
          title="Request unsuccessful"
          message={error}
        />
      )}
      {!data && !error && (
        <AnimatedLoadingState
          compact
          title="Loading system diagnostics"
          message="Retrieving permitted technical information."
        />
      )}
      {data && (
        <>
          <div className="workspace-panel">
            <h3>Environment health</h3>
            <dl className="system-health">
              <dt>Environment</dt>
              <dd>{data.diagnostics.environment}</dd>
              <dt>Database</dt>
              <dd>{data.diagnostics.database}</dd>
              <dt>Authentication</dt>
              <dd>{data.diagnostics.authentication}</dd>
              <dt>Hosted security acceptance</dt>
              <dd>{data.diagnostics.hostedAcceptance}</dd>
            </dl>
          </div>
          <div className="system-job-grid">
            <section className="workspace-panel">
              <h3>Publication jobs</h3>
              <DataTable caption="Publication jobs by stored status" rows={data.diagnostics.publication} rowKey="status" state={data.diagnostics.publication.length?'ready':'empty'} emptyTitle="No publication jobs" emptyMessage="No stored jobs were returned for this environment." columns={[{id:'status',header:'Status',accessor:'status'},{id:'count',header:'Jobs',accessor:'count'}]}/>
            </section>
            <section className="workspace-panel">
              <h3>Notification jobs</h3>
              <DataTable caption="Notification jobs by stored status" rows={data.diagnostics.notifications} rowKey="status" state={data.diagnostics.notifications.length?'ready':'empty'} emptyTitle="No notification jobs" emptyMessage="No stored notification jobs were returned." columns={[{id:'status',header:'Status',accessor:'status'},{id:'count',header:'Jobs',accessor:'count'}]}/>
            </section>
          </div>
          <ActivityView api={api} security />
          <Button
            type="button"
            onClick={() => {
              setData(null);
              setError(
                "Use Check connection again to verify the current session before reopening this section.",
              );
            }}
          >
            Clear displayed information
          </Button>
        </>
      )}
    </section>
  );
}
