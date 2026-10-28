import { useEffect, useRef, useState } from "react";
import { Button, InlineNotice } from "@faako/ui";
import MediaLibrary from "./MediaLibrary.jsx";

const pages = ["home", "about", "services", "faqs", "testimonials", "contact"];
const emptyBody = () => ({ heading: "", body: "", ctaLabel: "", ctaPath: "/#plan", seoTitle: "", seoDescription: "", imageId: null, entries: [], contactEmail: "", contactPhone: "" });

export default function WebsiteContent({ api, session, onDirtyChange }) {
  const canPublish = session.user.permissions?.includes("content.publish") === true;
  const [page, setPage] = useState("home");
  const [body, setBody] = useState(emptyBody);
  const [version, setVersion] = useState(0);
  const [history, setHistory] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(null);
  const [chooseImage, setChooseImage] = useState(false);
  const [state, setState] = useState({ loading: true, error: "", message: "" });
  const heading = useRef(null);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    let active = true;
    async function load() {
      setState({ loading: true, error: "", message: "" });
      setPreview(null);
      try {
        let item;
        try { item = await api.get(`/api/agent/content/${page}`, { responseMode: "data" }); }
        catch (error) { if (error.status !== 404) throw error; }
        const revisions = await api.get(`/api/agent/content/${page}/revisions`, { responseMode: "data" });
        const publications = await api.get("/api/agent/content/publication-jobs", { responseMode: "data" });
        if (!active) return;
        setBody(item?.body || emptyBody()); setVersion(item?.version || 0); setHistory(revisions.items);
        setJobs(publications.items);
        setDirty(false); setState({ loading: false, error: "", message: "" });
        heading.current?.focus();
      } catch (error) { if (active) setState({ loading: false, error: error.message, message: "" }); }
    }
    load();
    return () => { active = false; };
  }, [api, page]);
  const change = (key, value) => { setBody((current) => ({ ...current, [key]: value })); setDirty(true); setPreview(null); };
  async function save(event) {
    event.preventDefault(); setState({ loading: true, error: "", message: "Saving draft…" });
    try {
      const result = await api.post(`/api/agent/content/${page}/draft`, { responseMode: "data", json: { body, expectedVersion: version }, headers: { "X-CSRF-Token": session.csrfToken } });
      setBody(result.body); setVersion(result.version); setDirty(false);
      const revisions = await api.get(`/api/agent/content/${page}/revisions`, { responseMode: "data" }); setHistory(revisions.items);
      setState({ loading: false, error: "", message: "Draft saved. The public website has not changed." });
    } catch (error) { setState({ loading: false, error: error.message, message: "" }); }
  }
  async function showPreview() {
    setState({ loading: true, error: "", message: "" });
    try {
      const item = await api.get(`/api/agent/content/${page}/preview`, { responseMode: "data" });
      setPreview(item.body); setState({ loading: false, error: "", message: "Showing the saved draft, not the public website." });
    } catch (error) { setState({ loading: false, error: error.message, message: "" }); }
  }
  async function revert(id) {
    if (dirty && !window.confirm("Discard unsaved changes and restore this revision as a new draft?")) return;
    setState({ loading: true, error: "", message: "" });
    try {
      const result = await api.post(`/api/agent/content/${page}/revert/${id}`, { responseMode: "data", json: { expectedVersion: version }, headers: { "X-CSRF-Token": session.csrfToken } });
      setBody(result.body); setVersion(result.version); setDirty(false); setPreview(null);
      setHistory((current) => [{ id: result.revisionId, version: result.version, created_at: new Date().toISOString() }, ...current]);
      setState({ loading: false, error: "", message: "Revision restored as a new draft. Nothing has been published." });
    } catch (error) { setState({ loading: false, error: error.message, message: "" }); }
  }
  async function publication(action, id) {
    if (action !== "refresh" && !window.confirm(action === "unpublish" ? "Request removal of this page from the next public build?" : "Request a website build using the saved content?")) return;
    setState({ loading: true, error: "", message: "" });
    try {
      if (action !== "refresh") await api.post(id ? `/api/agent/content/publication-jobs/${id}/retry` : `/api/agent/content/${page}/${action}`, { responseMode: "data", ...(id ? {} : { json: { expectedVersion: version } }), headers: { "X-CSRF-Token": session.csrfToken } });
      const result = await api.get("/api/agent/content/publication-jobs", { responseMode: "data" });
      setJobs(result.items);
      setState({ loading: false, error: "", message: action === "refresh" ? "Publication status refreshed." : "Request queued. The site changes only after a successful deployment is verified." });
    } catch (error) { setState({ loading: false, error: error.message, message: "" }); }
  }

  return <section className="content-editor" aria-labelledby="content-heading">
    <h2 id="content-heading" tabIndex={-1} ref={heading}>Website content</h2>
    <label>Section<select value={page} disabled={state.loading} onChange={(event) => {
      if (!dirty || window.confirm("Discard unsaved changes?")) setPage(event.target.value);
    }}>{pages.map((name) => <option key={name}>{name}</option>)}</select></label>
    {state.error && <InlineNotice tone="danger" title="Content unavailable" message={state.error} />}
    <p role="status">{state.loading ? "Working…" : state.message || (dirty ? "Unsaved changes" : `Draft version ${version}`)}</p>
    <form onSubmit={save}>
      <fieldset disabled={state.loading}>
        <legend>Selected website fields</legend>
        <label>Heading<input value={body.heading} maxLength={120} required onChange={(e) => change("heading", e.target.value)} /></label>
        <label>Body text<textarea value={body.body} maxLength={6000} rows={6} onChange={(e) => change("body", e.target.value)} /></label>
        {page === "home" && <><label>CTA text<input value={body.ctaLabel} maxLength={60} onChange={(e) => change("ctaLabel", e.target.value)} /></label><label>CTA destination<select value={body.ctaPath} onChange={(e) => change("ctaPath", e.target.value)}><option value="/#plan">Plan a trip</option><option value="/about">About</option><option value="/services">Services</option><option value="/destinations">Destinations</option></select></label></>}
        {page === "contact" && <><label>Official email<input type="email" value={body.contactEmail} onChange={(e) => change("contactEmail", e.target.value)} /></label><label>Official phone<input type="tel" value={body.contactPhone} maxLength={40} onChange={(e) => change("contactPhone", e.target.value)} /></label></>}
        {body.entries.map((entry, index) => <fieldset key={index}><legend>Entry {index + 1}</legend>
          {[["heading", "Title / question", 160], ["text", "Text / answer", 2000], ["attribution", "Attribution (where applicable)", 160]].map(([key, label, max]) => <label key={key}>{label}<textarea value={entry[key]} maxLength={max} required={key !== "attribution"} onChange={(event) => change("entries", body.entries.map((value, i) => i === index ? { ...value, [key]: event.target.value } : value))} /></label>)}
          <Button type="button" onClick={() => change("entries", body.entries.filter((_, i) => i !== index))}>Remove entry {index + 1}</Button>
        </fieldset>)}
        <Button type="button" disabled={body.entries.length >= 30} onClick={() => change("entries", [...body.entries, { heading: "", text: "", attribution: "" }])}>Add entry</Button>
        <p>Use approved facts, client permissions and licensed imagery only. Do not add unverified testimonials.</p>
        <label>SEO title<input value={body.seoTitle} maxLength={70} required onChange={(e) => change("seoTitle", e.target.value)} /></label>
        <label>SEO description<textarea value={body.seoDescription} maxLength={180} required onChange={(e) => change("seoDescription", e.target.value)} /></label>
        <div className="editor-actions"><Button type="submit">Save draft</Button><Button type="button" disabled={!version || dirty} onClick={showPreview}>Preview saved content</Button></div>
      </fieldset>
    </form>
    <p>{body.imageId ? `Selected image: ${body.imageId}` : "No image selected."} Image selection is saved with the draft.</p>
    <Button type="button" disabled={state.loading} onClick={() => setChooseImage((current) => !current)}>{chooseImage ? "Close image library" : "Choose image"}</Button>
    {body.imageId && <Button type="button" disabled={state.loading} onClick={() => change("imageId", null)}>Remove image from draft</Button>}
    {chooseImage && <MediaLibrary api={api} session={session} onSelect={(item) => { change("imageId", item.id); setChooseImage(false); heading.current?.focus(); }} />}
    <h3>Publication</h3>
    <p>Builds use saved revisions and require Baaba's reviewed deployment workflow. A pending or building request is not live.</p>
    {!canPublish && <p>Only an Owner can request publication, unpublishing or retries.</p>}
    <div className="editor-actions"><Button type="button" disabled={!canPublish || state.loading || dirty || !version} onClick={() => publication("publish")}>Request publication</Button><Button type="button" disabled={!canPublish || state.loading || dirty || !version} onClick={() => publication("unpublish")}>Request unpublish</Button><Button type="button" disabled={state.loading} onClick={() => publication("refresh")}>Refresh publication status</Button></div>
    <ul>{jobs.map((job, index) => <li key={job.id}>{job.status} — {new Date(job.created_at).toLocaleString("en-GH", { timeZone: "Africa/Accra" })}{job.status === "failed" && index === 0 && <Button type="button" disabled={!canPublish || state.loading} onClick={() => publication("retry", job.id)}>Retry failed publication</Button>}</li>)}</ul>
    {preview && <section aria-label="Saved content preview"><h3>{preview.heading}</h3><p className="preserve-lines">{preview.body}</p>{preview.entries.map((entry, index) => <div key={index}><h4>{entry.heading}</h4><p>{entry.text}</p>{entry.attribution && <p>{entry.attribution}</p>}</div>)}<p>This content preview does not reproduce the final page layout.</p></section>}
    <h3>Revision history</h3>
    {history.length ? <ol>{history.map((revision) => <li key={revision.id}>Version {revision.version} — {new Date(revision.created_at).toLocaleString("en-GH", { timeZone: "Africa/Accra" })} <Button type="button" disabled={state.loading} onClick={() => revert(revision.id)}>Restore version {revision.version}</Button></li>)}</ol> : <p>No saved revisions.</p>}
  </section>;
}
