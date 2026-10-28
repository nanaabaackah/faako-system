import Button from "./ActionButton.jsx";
import NavigationIcon from "./NavigationIcon.jsx";
import { useEffect, useState } from "react";
import { KpiCard, InlineNotice } from "@faako/ui";

export default function Dashboard({ api, session, onNavigate, isDemo }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const permissions = session.user.permissions || [];
  const canEnquire = permissions.includes("enquiries.read");
  const canEdit = permissions.includes("content.read");
  useEffect(() => {
    let active = true;
    Promise.all([
      canEnquire ? api.get("/api/agent/inquiries", { responseMode: "data" }) : null,
      canEdit ? api.get("/api/agent/content", { responseMode: "data" }) : null,
      canEdit ? api.get("/api/agent/content/publication-jobs", { responseMode: "data" }) : null,
    ]).then(([enquiries, content, jobs]) => { if (active) setData({ enquiries, content, jobs }); })
      .catch(() => { if (active) setError("Dashboard information could not load. Open the relevant workspace or refresh your connection."); });
    return () => { active = false; };
  }, [api, canEnquire, canEdit]);
  if (error) return <InlineNotice tone="danger" title="Dashboard unavailable" message={error} />;
  if (!data) return <p role="status">Loading your workspace…</p>;
  const enquiries = data.enquiries?.items || [];
  const drafts = (data.content?.items || []).filter(item => item.draft_revision_id && item.draft_revision_id !== item.published_revision_id);
  const latest = data.jobs?.items?.[0];
  return <div className="dashboard">
    <section className="dashboard-welcome">
      <div><h2>Make room for the next journey.</h2><p>Your enquiries, website and publishing tasks, in one place.</p></div>
      {canEnquire && <Button icon="enquiries" onClick={() => onNavigate("enquiries")}>View enquiry inbox</Button>}
    </section>
    <div className="dashboard-metrics" aria-label="Workspace indicators">
      {canEnquire && <><KpiCard label="New enquiries" value={enquiries.filter(item => item.status === "new").length} detail={`In the latest ${enquiries.length} enquiries`} tone="warning" />
      <KpiCard label="Contacted" value={enquiries.filter(item => item.status === "contacted").length} detail="In the same recent enquiry list" tone="info" /></>}
      {canEdit && <><KpiCard label="Pages with drafts" value={drafts.length} detail="Saved revisions not yet published" />
      <KpiCard className="metric-word" label="Latest publication" value={latest?.status || "No requests"} detail={isDemo ? "Live publishing is disabled in demo" : "A request is not proof of deployment"} /></>}
    </div>
    <div className="dashboard-columns">
      {canEnquire && <section className="dashboard-panel">
        <div className="dashboard-section-heading"><h2>Recent enquiries</h2><Button variant="ghost" onClick={() => onNavigate("enquiries")}>View all</Button></div>
        {enquiries.length ? <ul className="dashboard-enquiries">{enquiries.slice(0, 5).map(item => <li key={item.id}>
          <div><strong>{item.contact.name || "Traveller"}</strong><span>{item.kind === "package" ? "Package enquiry" : item.kind === "personalised" ? "Personalised trip" : "Estimator enquiry"}</span></div>
          <span className={`status-label status-${item.status}`}>{item.status}</span>
        </li>)}</ul> : <p>No enquiries yet. New website enquiries will appear here.</p>}
        <p className="dashboard-footnote">Contact travellers and update their status in the enquiry inbox.</p>
      </section>}
      <section className="dashboard-panel dashboard-actions">
        <h2>Your workspace</h2>
        {canEdit && <button onClick={() => onNavigate("content")}><strong>Website content</strong><span>Edit copy, review drafts and request publication.</span><NavigationIcon name="content" /></button>}
        {permissions.includes("media.read") && <button onClick={() => onNavigate("media")}><strong>Media library</strong><span>Manage approved images and their usage rights.</span><NavigationIcon name="media" /></button>}
        {session.user.role === "owner" && <button onClick={() => onNavigate("staff")}><strong>Staff access</strong><span>Manage your team's access to this workspace.</span><NavigationIcon name="staff" /></button>}
        {permissions.includes("system.read") && <button onClick={() => onNavigate("system")}><strong>System administration</strong><span>Review technical health and security events.</span><NavigationIcon name="system" /></button>}
        {isDemo && <a href="http://127.0.0.1:4328/demo" target="_blank" rel="noreferrer"><strong>Preview the website demo</strong><span>Explore the public-facing travel experience.</span><NavigationIcon name="preview" /></a>}
      </section>
    </div>
    {canEdit && <section className="dashboard-panel">
      <div className="dashboard-section-heading"><h2>Content to review</h2><Button icon="content" variant="ghost" onClick={() => onNavigate("content")}>Open editor</Button></div>
      {drafts.length ? <ul className="dashboard-drafts">{drafts.map(item => <li key={item.id || item.slug}><strong>{item.slug}</strong><span>Draft version {item.version}</span><span className="status-label">Awaiting publication</span></li>)}</ul> : <p>No unpublished page revisions in this workspace.</p>}
    </section>}
  </div>;
}
