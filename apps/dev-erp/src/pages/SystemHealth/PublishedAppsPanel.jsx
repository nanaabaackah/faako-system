import React, { useEffect, useState } from "react";
import { apiGet } from "../../api/client";
import { getAggregateSiteStatus } from "../../utils/siteStatus";
import { getSafeExternalUrl } from "../../utils/safeUrl";

const PUBLIC_APP_CATEGORIES = new Set(["portal", "erp", "marketing", "commerce", "client", "portfolio"]);
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
      const data = await apiGet("/api/dashboard", { fallbackMessage: "Unable to load published apps." });
      const sites = Array.isArray(data?.siteStatus?.sites) ? data.siteStatus.sites : [];
      const listed = sites.filter((site) => PUBLIC_APP_CATEGORIES.has(String(site.category).toLowerCase()))
        .map((site) => ({
          id: site.id,
          name: site.title,
          category: site.category,
          href: validUrl(site.baseUrl),
          status: getAggregateSiteStatus(site.pages || []),
          checkedAt: site.pages?.find((page) => page.checkedAt)?.checkedAt || null,
        }))
        .filter((item) => item.href);
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
        <button type="button" className="button button-ghost" onClick={refresh} disabled={state === "loading"}>Refresh</button>
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
              <a className="button button-ghost" href={app.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${app.name} in a new tab`}>Open application ↗</a>
            </div>
          ))}
        </div>
      ) : state === "ready" && <p className="muted">No configured published application URLs were found.</p>}
    </section>
  );
};

export default PublishedAppsPanel;
