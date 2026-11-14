import React, { useEffect, useState } from "react";
import { FiExternalLink, FiRefreshCw } from "react-icons/fi";
import { apiGet } from "../../api/client";
import { getSafeExternalUrl } from "../../utils/safeUrl";

const validUrl = (url) => {
  const safe = getSafeExternalUrl(url);
  if (!safe) return null;
  try {
    const parsed = new URL(safe);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
};

const PublishedAppsPanel = () => {
  const [apps, setApps] = useState([]);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const refresh = async () => {
    setState("loading");
    setError("");
    try {
      const data = await apiGet("/api/monitoring/published-apps", { fallbackMessage: "Unable to load published apps." });
      const listed = (Array.isArray(data?.apps) ? data.apps : [])
        .map((app) => ({
          id: app.id,
          name: app.name,
          category: app.category,
          href: validUrl(app.url),
          status: app.status || "unknown",
          checkedAt: app.checkedAt || null,
        }))
        .filter((app) => app.href);
      setApps(listed);
      setState("ready");
    } catch (requestError) {
      setState("error");
      setError(requestError.message);
    }
  };
  useEffect(() => { void refresh(); }, []);
  return (
    <section className="panel health-published-apps" aria-labelledby="published-apps-title">
      <div className="panel-header">
        <div><h3 id="published-apps-title">Published Faako applications</h3>
          <p className="muted">Deployment links from the configured app registry and latest monitored status.</p>
        </div>
        <button type="button" className="button button-ghost" onClick={refresh} disabled={state === "loading"}><FiRefreshCw size={15} aria-hidden="true" /> Refresh</button>
      </div>
      {error && <p className="notice is-error" role="alert">{error}</p>}
      {state === "loading" && !apps.length && <p className="muted">Loading application status…</p>}
      {apps.length ? (
        <div className="health-published-apps__list">
          {apps.map((app) => (
            <div className="health-published-apps__row" key={app.id}>
              <div className="health-published-apps__name">
                <strong>{app.name}</strong><span>{app.category}</span>
              </div>
              <span className={`health-published-apps__status is-${app.status}`}>{app.status === "not_configured" ? "Not configured" : app.status}</span>
              <a className="button button-ghost" href={app.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${app.name} in a new tab`}>Open application <FiExternalLink size={15} aria-hidden="true" /></a>
            </div>
          ))}
        </div>
      ) : state === "ready" && <p className="muted">No configured published application URLs were found.</p>}
    </section>
  );
};

export default PublishedAppsPanel;
