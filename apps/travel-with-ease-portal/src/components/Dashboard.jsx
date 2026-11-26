import Button from "./ActionButton.jsx";
import NavigationIcon from "./NavigationIcon.jsx";
import "../styles/dashboard-navigation.css";
import { useEffect, useState } from "react";
import { KpiCard, InlineNotice, AnimatedLoadingState, StatusPill } from "@faako/ui";

function useDashboardResource(api, path, enabled, revision) {
  const [result, setResult] = useState({ data: null, state: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setResult({ data: null, state: "loading" });
    Promise.resolve().then(() => api.get(path, { responseMode: "data" }))
      .then(data => { if (active) setResult({ data, state: "ready" }); })
      .catch(() => { if (active) setResult({ data: null, state: "error" }); });
    return () => { active = false; };
  }, [api, path, enabled, revision]);
  return enabled ? result : { data: null, state: "disabled" };
}
function ResourceState({ resource, children }) {
  if (resource.state === "loading") return <AnimatedLoadingState compact title="Loading…"/>;
  if (resource.state === "error") return <InlineNotice tone="danger" title="Could not load" message="Use Refresh to try again." />;
  return children;
}
const metricValue = (resource, value) => resource.state === "ready" ? value : "—";
const metricDetail = resource => resource.state === "error" ? "Unavailable" : resource.state === "loading" ? "Loading" : undefined;

export default function Dashboard({
  api,
  session,
  onNavigate,
}) {
  const [revision, setRevision] = useState(0);
  const permissions = session.user.permissions || [];
  const canEnquire = permissions.includes("enquiries.read");
  const canEdit = permissions.includes("content.read");
  const enquiriesResource = useDashboardResource(api, "/api/agent/inquiries", canEnquire, revision);
  const summaryResource = useDashboardResource(api, "/api/agent/inquiries/summary", canEnquire, revision);
  const contentResource = useDashboardResource(api, "/api/agent/content", canEdit, revision);
  const publicationResource = useDashboardResource(api, "/api/agent/content/publication-jobs", canEdit, revision);
  const enquiries = enquiriesResource.data?.items || [];
  const drafts = (contentResource.data?.items || []).filter(item => item.draft_revision_id && item.draft_revision_id !== item.published_revision_id);
  const jobs = publicationResource.data?.items || [];
  const latest = jobs[0];
  const canUseQuickActions = canEdit || permissions.includes("media.read") || permissions.includes("staff.manage") || (session.user.role === "platform_admin" && permissions.includes("system.read"));
  return (
    <div className="dashboard twe-operations-dashboard">
      {(canEnquire || canEdit) && <div className="dashboard-toolbar">
        <Button variant="ghost" icon="refresh" onClick={() => setRevision(value => value + 1)}>Refresh</Button>
      </div>}
      <div className="dashboard-metrics" aria-label="Workspace indicators">
        {canEnquire && (
          <>
            <button type="button" className="twe-kpi-link" onClick={() => onNavigate("enquiries", { status: "new" })} aria-label="Open new enquiries">
            <KpiCard
              label="New enquiries"
              value={metricValue(summaryResource, summaryResource.data?.counts?.new ?? "—")}
              detail={metricDetail(summaryResource)}
              tone="warning"
            />
            </button>
            <button type="button" className="twe-kpi-link" onClick={() => onNavigate("enquiries", { status: "contacted" })} aria-label="Open contacted enquiries">
            <KpiCard
              label="Contacted"
              value={metricValue(summaryResource, summaryResource.data?.counts?.contacted ?? "—")}
              detail={metricDetail(summaryResource)}
              
              tone="info"
            />
            </button>
          </>
        )}
        {canEdit && (
          <>
            <button type="button" className="twe-kpi-link" onClick={() => onNavigate("content", { view: "drafts" })} aria-label="Open website drafts">
            <KpiCard
              label="Pages with drafts"
              value={metricValue(contentResource, drafts.length)}
              detail={metricDetail(contentResource)}
            />
            </button>
            <button type="button" className="twe-kpi-link metric-word" onClick={() => onNavigate("content", { view: "publication" })} aria-label="Open publication history">
            <KpiCard
              className="metric-word"
              label="Latest publication"
              value={metricValue(publicationResource, latest?.status || "No requests")}
              detail={metricDetail(publicationResource)}
            />
            </button>
          </>
        )}
      </div>
      <div className="dashboard-columns">
        {canEnquire && (
          <section className="dashboard-panel">
            <div className="dashboard-section-heading">
              <h2>Recent enquiries</h2>
              <Button variant="ghost" onClick={() => onNavigate("enquiries")}>
                View all
              </Button>
            </div>
            <ResourceState resource={enquiriesResource}>
            {enquiries.length ? (
              <ul className="dashboard-enquiries">
                {enquiries.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <button className="dashboard-enquiry-link" type="button" onClick={() => onNavigate("enquiries", { enquiryId: item.id })} aria-label={`Open enquiry from ${item.contact.name || "Traveller"}`}>
                      <span className="dashboard-enquiry-copy"><strong>{item.contact.name || "Traveller"}</strong>
                      <span>
                        {item.kind === "package"
                          ? "Package enquiry"
                          : item.kind === "personalised"
                            ? "Personalised trip"
                            : "Estimator enquiry"}
                      </span></span>
                      <StatusPill tone={item.status === "new" ? "warning" : item.status === "contacted" ? "info" : "neutral"}>{item.status}</StatusPill>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No enquiries yet.</p>
            )}
            </ResourceState>
          </section>
        )}
        {canEdit && <section className="dashboard-panel dashboard-publications">
          <div className="dashboard-section-heading"><h2>Publication activity</h2>
            <Button variant="ghost" onClick={() => onNavigate("content", { view: "publication" })}>View history</Button>
          </div>
          <ResourceState resource={publicationResource}>
            {jobs.length ? <ul className="dashboard-publication-list">
              {jobs.slice(0, 4).map((job, index) => <li key={job.id || index}>
                <NavigationIcon name="content"/>
                <span>{index === 0 ? "Latest publication" : "Previous publication"}
                  {job.created_at && <small><time dateTime={job.created_at}>{new Date(job.created_at).toLocaleString("en-GH", { timeZone: "Africa/Accra" })}</time></small>}
                </span>
                <StatusPill tone={["succeeded","success","completed","published"].includes(job.status) ? "success" : ["failed","error"].includes(job.status) ? "danger" : "neutral"}>{job.status}</StatusPill>
              </li>)}
            </ul> : <p>No publication requests yet.</p>}
          </ResourceState>
        </section>}
      </div>
      {canUseQuickActions && <section className="dashboard-panel dashboard-actions twe-quick-actions">
          <h2>Quick actions</h2>
          {canEdit && (
            <button onClick={() => onNavigate("content")}>
              <strong>Website content</strong>
              <NavigationIcon name="content" />
            </button>
          )}
          {permissions.includes("media.read") && (
            <button onClick={() => onNavigate("media")}>
              <strong>Media library</strong>
              <NavigationIcon name="media" />
            </button>
          )}
          {permissions.includes("staff.manage") && (
            <button onClick={() => onNavigate("staff")}>
              <strong>Staff access</strong>
              <NavigationIcon name="staff" />
            </button>
          )}
          {session.user.role === "platform_admin" && permissions.includes("system.read") && (
            <button onClick={() => onNavigate("system")}>
              <strong>System administration</strong>
              <NavigationIcon name="system" />
            </button>
          )}
        </section>}
      {canEdit && (
        <section className="dashboard-panel">
          <div className="dashboard-section-heading">
            <h2>Content to review</h2>
            <Button
              icon="content"
              variant="ghost"
              onClick={() => onNavigate("content")}
            >
              Open editor
            </Button>
          </div>
          <ResourceState resource={contentResource}>
          {drafts.length ? (
            <ul className="dashboard-drafts">
              {drafts.map((item) => (
                <li key={item.id || item.slug}>
                  <button className="dashboard-draft-link" type="button" onClick={() => onNavigate("content", { page: item.slug === "testimonials" ? "home" : item.slug })}><span><strong>{item.slug.replaceAll("-", " ").replace(/^./, letter => letter.toUpperCase())}</strong><small>Draft version {item.version}</small></span>
                  <StatusPill tone="neutral">Awaiting publication</StatusPill><NavigationIcon name="arrow"/></button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No drafts to review.</p>
          )}
          </ResourceState>
        </section>
      )}
    </div>
  );
}
