import { useEffect, useState } from "react";
import { SelectField, InlineNotice, AnimatedLoadingState } from "@faako/ui";
import "./visual-preview.css";

export default function VisualPreview({ job, api, body }) {
  const [current, setCurrent] = useState(job);
  const [width, setWidth] = useState("desktop");
  const [route, setRoute] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true, timer;
    async function refresh() {
      try {
        const next = await api.get(`/api/agent/content/previews/${job.id}`, { responseMode: "data" });
        if (!active) return;
        setCurrent(next);
        if (next.status === "building") timer = setTimeout(refresh, 2000);
      } catch (failure) { if (active) setError(failure.message); }
    }
    if (job.status === "building") timer = setTimeout(refresh, 2000);
    return () => { active = false; clearTimeout(timer); };
  }, [api, job]);
  const records = [
    ...(body.packages || []).map(item => ({ path: `packages/${item.slug}/index.html`, title: item.title })),
    ...(body.articles || []).map(item => ({ path: `journal/${item.slug}/index.html`, title: item.title })),
    ...(body.tips || []).map(item => ({ path: `travel-tips/${item.slug}/index.html`, title: item.title })),
  ];
  const prefix = `/api/agent/content/previews/${job.id}/files/`;
  return <section className="visual-preview workspace-panel" aria-label="Website layout preview">
    <h3>Website layout preview</h3>
    <p>Saved version {job.version}. Private, read-only Astro rendering; nothing is published. Expires in ten minutes.</p>
    {error && <InlineNotice tone="danger" title="Preview unavailable" message={error} />}
    {current.status === "building" && !error && <AnimatedLoadingState compact title="Building your website preview" message="This runs once for the saved version, not while you type." />}
    {current.status === "failed" && <InlineNotice tone="danger" title="Preview build failed" message={current.message} />}
    {current.status === "ready" && !error && <>
      <div className="visual-preview__controls">
        <SelectField label="Preview viewport" value={width} onChange={event => setWidth(event.target.value)}>
          <option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option>
        </SelectField>
        {!!records.length && <SelectField label="Preview page" value={route} onChange={event => setRoute(event.target.value)}>
          <option value="">Collection listing</option>{records.map(item => <option value={item.path} key={item.path}>{item.title}</option>)}
        </SelectField>}
      </div>
      <div className="visual-preview__canvas" tabIndex={0} aria-label="Scrollable website preview">
        <iframe className={`visual-preview__frame visual-preview__frame--${width}`}
          title={`Private ${job.page} draft preview, ${width}`} sandbox="allow-same-origin"
          referrerPolicy="no-referrer" src={route ? prefix + route : current.url} />
      </div>
    </>}
  </section>;
}
