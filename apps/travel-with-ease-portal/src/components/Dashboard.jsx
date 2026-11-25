import Button from "./ActionButton.jsx";
import NavigationIcon from "./NavigationIcon.jsx";
import "../styles/dashboard-navigation.css";
import { useEffect, useState } from "react";
import { KpiCard, InlineNotice, AnimatedLoadingState } from "@faako/ui";

export default function Dashboard({
  api,
  session,
  onNavigate,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const permissions = session.user.permissions || [];
  const canEnquire = permissions.includes("enquiries.read");
  const canEdit = permissions.includes("content.read");
  useEffect(() => {
    let active = true;
    Promise.all([
      canEnquire
        ? api.get("/api/agent/inquiries", { responseMode: "data" })
        : null,
      canEnquire ? api.get("/api/agent/inquiries/summary", { responseMode: "data" }) : null,
      canEdit ? api.get("/api/agent/content", { responseMode: "data" }) : null,
      canEdit
        ? api.get("/api/agent/content/publication-jobs", {
            responseMode: "data",
          })
        : null,
    ])
      .then(([enquiries, summary, content, jobs]) => {
        if (active) setData({ enquiries, summary, content, jobs });
      })
      .catch(() => {
        if (active)
          setError(
            "Dashboard information could not load. Open the relevant workspace or refresh your connection.",
          );
      });
    return () => {
      active = false;
    };
  }, [api, canEnquire, canEdit]);
  if (error)
    return (
      <InlineNotice
        tone="danger"
        title="Dashboard unavailable"
        message={error}
      />
    );
  if (!data)
    return (
      <AnimatedLoadingState
        title="Loading dashboard"
      />
    );
  const enquiries = data.enquiries?.items || [];
  const drafts = (data.content?.items || []).filter(
    (item) =>
      item.draft_revision_id &&
      item.draft_revision_id !== item.published_revision_id,
  );
  const latest = data.jobs?.items?.[0];
  return (
    <div className="dashboard">
      <div className="dashboard-metrics" aria-label="Workspace indicators">
        {canEnquire && (
          <>
            <button type="button" className="twe-kpi-link" onClick={() => onNavigate("enquiries", { status: "new" })} aria-label="Open new enquiries">
            <KpiCard
              label="New enquiries"
              value={data.summary?.counts?.new ?? 0}
              tone="warning"
            />
            </button>
            <button type="button" className="twe-kpi-link" onClick={() => onNavigate("enquiries", { status: "contacted" })} aria-label="Open contacted enquiries">
            <KpiCard
              label="Contacted"
              value={data.summary?.counts?.contacted ?? 0}
              
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
              value={drafts.length}
              detail="Saved revisions not yet published"
            />
            </button>
            <button type="button" className="twe-kpi-link metric-word" onClick={() => onNavigate("content", { view: "publication" })} aria-label="Open publication history">
            <KpiCard
              className="metric-word"
              label="Latest publication"
              value={latest?.status || "No requests"}
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
            {enquiries.length ? (
              <ul className="dashboard-enquiries">
                {enquiries.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <button className="dashboard-enquiry-link" type="button" onClick={() => onNavigate("enquiries", { enquiryId: item.id })} aria-label={`Open enquiry from ${item.contact.name || "Traveller"}`}>
                      <strong>{item.contact.name || "Traveller"}</strong>
                      <span>
                        {item.kind === "package"
                          ? "Package enquiry"
                          : item.kind === "personalised"
                            ? "Personalised trip"
                            : "Estimator enquiry"}
                      </span>
                    </button>
                    <span className={`status-label status-${item.status}`}>
                      {item.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No enquiries yet.</p>
            )}
          </section>
        )}
        <section className="dashboard-panel dashboard-actions">
          <h2>Your workspace</h2>
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
          {session.user.role === "owner" && (
            <button onClick={() => onNavigate("staff")}>
              <strong>Staff access</strong>
              <NavigationIcon name="staff" />
            </button>
          )}
          {permissions.includes("system.read") && (
            <button onClick={() => onNavigate("system")}>
              <strong>System administration</strong>
              <NavigationIcon name="system" />
            </button>
          )}
        </section>
      </div>
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
          {drafts.length ? (
            <ul className="dashboard-drafts">
              {drafts.map((item) => (
                <li key={item.id || item.slug}>
                  <button className="dashboard-enquiry-link" type="button" onClick={() => onNavigate("content", { page: item.slug })}>{item.slug}</button>
                  <span>Draft version {item.version}</span>
                  <span className="status-label">Awaiting publication</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No drafts to review.</p>
          )}
        </section>
      )}
    </div>
  );
}
