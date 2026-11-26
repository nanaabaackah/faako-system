import Button from "./ActionButton.jsx";
import { useEffect, useState } from "react";
import { InlineNotice, AnimatedLoadingState, StatusPill } from "@faako/ui";
import NavigationIcon from "./NavigationIcon.jsx";
import "../styles/activity.css";
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
      <div className="twe-admin-toolbar">
      <h2 id="system-heading">System diagnostics</h2>
      <Button icon="refresh" type="button" disabled={!data&&!error} onClick={()=>setRefresh(value=>value+1)}>Refresh diagnostics</Button>
      </div>
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
          message="Loading diagnostics…"
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
            <details className="twe-admin-disclosure twe-system-jobs">
              <summary><span><strong>Publication jobs</strong><small>{data.diagnostics.publication.length ? data.diagnostics.publication.reduce((sum, row) => sum + Number(row.count), 0) + " stored jobs" : "No jobs"}</small></span><NavigationIcon name="arrow"/></summary>
              <div className="twe-admin-disclosure-body">
                <dl className="twe-job-counts">{data.diagnostics.publication.map(row => <div key={row.status}><dt><StatusPill tone={row.status === "failed" ? "danger" : "neutral"}>{row.status}</StatusPill></dt><dd>{row.count}</dd></div>)}</dl>
                {!data.diagnostics.publication.length && <p>No publication jobs.</p>}
              </div>
            </details>
            <details className="twe-admin-disclosure twe-system-jobs">
              <summary><span><strong>Notification jobs</strong><small>{data.diagnostics.notifications.length ? data.diagnostics.notifications.reduce((sum, row) => sum + Number(row.count), 0) + " stored jobs" : "No jobs"}</small></span><NavigationIcon name="arrow"/></summary>
              <div className="twe-admin-disclosure-body">
                <dl className="twe-job-counts">{data.diagnostics.notifications.map(row => <div key={row.status}><dt><StatusPill tone={row.status === "failed" ? "danger" : "neutral"}>{row.status}</StatusPill></dt><dd>{row.count}</dd></div>)}</dl>
                {!data.diagnostics.notifications.length && <p>No notification jobs.</p>}
              </div>
            </details>
          </div>
          <ActivityView api={api} security />
        </>
      )}
    </section>
  );
}
