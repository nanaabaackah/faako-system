import { useEffect, useRef, useState } from "react";
import { createDraftAutosave } from "../lib/draft-autosave.js";
import {
  AnimatedLoadingState,
  InlineNotice,
  TextField,
  SelectField,
  ERPConfirmDialog,
  useToast,
} from "@faako/ui";
import Button from "./ActionButton.jsx";
import NavigationIcon from "./NavigationIcon.jsx";
import RichTextField from "./RichTextField.jsx";
import HistoryDisclosure from "./HistoryDisclosure.jsx";
import logo from "../../../travel-with-ease-web/public/brand/Primary gold.png";
import instagram from "../../../travel-with-ease-web/public/brand/social/instagram.png";
import tiktok from "../../../travel-with-ease-web/public/brand/social/tiktok.png";
import "../styles/email-templates.css";
import { emailTemplateOptions } from "../../../travel-with-ease-api/src/notifications/template-catalogue.js";

export default function EmailTemplates({ api, session, onDirtyChange, onRefreshBlockedChange }) {
  const { pushToast } = useToast();
  const [slug, setSlug] = useState("enquiry-acknowledgement");
  const [catalogue, setCatalogue] = useState(emailTemplateOptions);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueReload, setCatalogueReload] = useState(0);
  const [previewWidth, setPreviewWidth] = useState("desktop");
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  useEffect(() => {
    let current = true;
    setCatalogueError("");
    api.get("/api/agent/templates/catalogue", { responseMode: "data" }).then(result => {
      if (!current) return;
      if (!Array.isArray(result.items)) throw new Error("Template catalogue unavailable.");
      setCatalogue(result.items);
    }).catch(error => { if (current) setCatalogueError(error.message); });
    return () => { current = false; };
  }, [api, catalogueReload]);
  const canActivate = session.user.permissions?.includes("templates.manage") === true;
  const definition = catalogue.find(option => option.slug === slug) || emailTemplateOptions.find(option => option.slug === slug) || { slug, label: "Package enquiry", automated: true, context: "package" };
  const [reload, setReload] = useState(0);
  const [record, setRecord] = useState(null);
  const [copy, setCopy] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saveState, setSaveState] = useState({ status: "saved", error: "" });
  const historyRequest = useRef(0);
  const writer = useRef(null);
  const copyRef = useRef(null);
  const saving = saveState.status === "saving";
  useEffect(() => {
    onRefreshBlockedChange?.(dirty || busy || saving || historyLoading || (!record && !error) || Boolean(confirmation));
    return () => onRefreshBlockedChange?.(false);
  }, [dirty, busy, saving, historyLoading, record, error, confirmation, onRefreshBlockedChange]);
  // Preview branding is bundled locally; the actual outgoing email retains
  // absolute public asset URLs for email-client compatibility.
  const previewHtml = preview?.html
    .replaceAll("https://travelwitheasegh.com/brand/Primary%20gold.png", logo)
    .replaceAll(
      "https://travelwitheasegh.com/brand/social/instagram.png",
      instagram,
    )
    .replaceAll("https://travelwitheasegh.com/brand/social/tiktok.png", tiktok);
  const headers = { "X-CSRF-Token": session.csrfToken };
  useEffect(() => {
    let current = true;
    setRecord(null);
    setCopy(null);
    copyRef.current = null;
    const read = async () => {
      const result = await api.get(`/api/agent/templates/${slug}`, { responseMode: "data" });
      return { ...result, body: result.draft };
    };
    const autosave = createDraftAutosave({
      read,
      save: async (body, expectedVersion) => {
        const result = await api.post(`/api/agent/templates/${slug}/draft`, {
          headers: { "X-CSRF-Token": session.csrfToken },
          responseMode: "data", json: { copy: body, expectedVersion },
        });
        return { ...result, body: result.draft };
      },
      onState: result => {
        if (!current) return;
        setSaveState(result);
        setDirty(result.dirty);
        onDirtyChange(result.dirty);
      },
      onSaved: (result, replace) => {
        if (!current) return;
        setRecord(result);
        if (replace) { copyRef.current = result.draft; setCopy(result.draft); }
      },
    });
    writer.current = autosave;
    read().then(result => {
      if (!current) return;
      setRecord(result);
      copyRef.current = result.draft;
      setCopy(result.draft);
      autosave.reset(result.draft, result.version);
    }).catch(error => { if (current) setError(error.message); });
    return () => {
      current = false;
      autosave.dispose();
      if (writer.current === autosave) writer.current = null;
    };
  }, [api, slug, session.csrfToken, onDirtyChange, reload]);
  useEffect(() => {
    historyRequest.current++;
    setHistory([]);
    setHistoryError("");
    setHistoryLoading(false);
    return () => { historyRequest.current++; };
  }, [slug, record?.version]);
  async function loadHistory() {
    const request = ++historyRequest.current;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const result = await api.get(`/api/agent/templates/${slug}/history`, { responseMode: "data" });
      if (historyRequest.current === request) setHistory(Array.isArray(result.items) ? result.items : []);
    } catch (error) { if (historyRequest.current === request) setHistoryError(error.message); }
    finally { if (historyRequest.current === request) setHistoryLoading(false); }
  }
  function changeTemplate(event) {
    chooseTemplate(event.target.value);
  }
  function chooseTemplate(nextSlug) {
    if (busy || saving || historyLoading || confirmation || nextSlug === slug) return;
    if (!catalogue.some(option => option.slug === nextSlug && (option.automated || canActivate))) return;
    if (dirty) { setConfirmation({ kind: "switch", slug: nextSlug }); return; }
    switchTemplate(nextSlug);
  }
  function switchTemplate(nextSlug) {
    setDirty(false);
    onDirtyChange(false);
    setPreview(null);
    setError("");
    setNotice("");
    // Hide the previous template before the selected type changes. A delayed
    // response must never leave its copy editable under another template name.
    setRecord(null);
    setCopy(null);
    setSlug(nextSlug);
    setCatalogueOpen(false);
  }
  function edit(field, value) {
    if (busy || !copyRef.current) return;
    const next = { ...copyRef.current, [field]: value };
    copyRef.current = next;
    setCopy(next);
    writer.current?.edit(next);
    setPreview(null);
    setNotice("");
  }
  async function action(kind, revision) {
    if (busy || (kind === "activate" && !canActivate) || (["activate", "restore", "test"].includes(kind) && (dirty || saving))) return;
    if (kind === "draft") { await writer.current?.flush(); return; }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.post(`/api/agent/templates/${slug}/${kind}`, {
        headers,
        responseMode: "data",
        json:
          ["preview", "test"].includes(kind)
            ? copy
            : { expectedVersion: record.version, ...(kind === "restore" ? { revision } : {}) },
      });
      if (kind === "preview") {
        setPreview(result);
        setNotice("Preview only. No email was sent.");
      } else if (kind === "test") {
        if (result.status !== "provider_accepted") throw new Error("Test email delivery was not confirmed.");
        setNotice(`Test email accepted by provider for ${result.recipient}.`);
      } else {
        setRecord(result);
        copyRef.current = result.draft;
        setCopy(result.draft);
        writer.current?.reset(result.draft, result.version);
        setNotice(
          kind === "restore"
              ? "Revision restored as a draft. Outgoing emails have not changed."
              : definition.automated
                ? "Template activated."
                : "Invitation template approved.",
        );
        pushToast({ tone: "success", title: kind === "restore" ? "Template draft restored" : definition.automated ? "Template activated" : "Template approved", message: kind === "restore" ? "Outgoing emails have not changed." : "No email was sent by this action." });
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  const available = catalogue.filter(option => option.automated || canActivate);
  const categories = [
    ["General acknowledgements", option => option.automated && !["service", "package"].includes(option.context)],
    ["Service templates", option => option.context === "service"],
    ["Package templates", option => option.context === "package"],
    ["Staff invitations", option => !option.automated],
  ];
  const matches = available.filter(option => option.label.toLowerCase().includes(catalogueSearch.trim().toLowerCase()));
  return (
    <div className="email-templates twe-communications-workspace">
      <section className="template-intro">
        <SelectField
          label="Email type"
          value={slug}
          disabled={busy || saving || historyLoading || Boolean(confirmation)}
          onChange={changeTemplate}
        >
          {catalogue.filter(option => option.automated || canActivate).map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.context === "package" ? `Package — ${option.label}` : option.label}
            </option>
          ))}
        </SelectField>
        <Button type="button" icon={catalogueOpen ? "up" : "down"} aria-expanded={catalogueOpen}
          onClick={() => setCatalogueOpen(value => !value)}>{catalogueOpen ? "Close template catalogue" : "Browse templates"}</Button>
      </section>
      {catalogueOpen && <section className="twe-template-catalogue" aria-label="Template catalogue">
        <TextField label="Search templates" value={catalogueSearch} onChange={event => setCatalogueSearch(event.target.value)}/>
        {categories.map(([label, predicate]) => {
          const items = matches.filter(predicate);
          if (!items.length) return null;
          return <section key={label}><h3>{label}</h3><div className="twe-template-card-grid">
            {items.map(option => <button type="button" key={option.slug} className="twe-template-card"
              aria-current={slug === option.slug ? "true" : undefined}
              disabled={busy || saving || historyLoading || Boolean(confirmation)}
              onClick={() => { if (slug === option.slug) setCatalogueOpen(false); else chooseTemplate(option.slug); }}>
              <NavigationIcon name="templates"/><span>{option.label}</span><NavigationIcon name={slug === option.slug ? "check" : "arrow"}/>
            </button>)}
          </div></section>;
        })}
        {!matches.length && <p>No matching templates.</p>}
      </section>
      {catalogueError && <><InlineNotice tone="danger" title="Package templates unavailable" message={catalogueError}/><Button type="button" icon="refresh" onClick={() => setCatalogueReload(value => value + 1)}>Retry catalogue</Button></>}
      {error && (
        <InlineNotice
          tone="danger"
          title="Template action unsuccessful"
          message={error}
        />
      )}
      {notice && <p role="status">{notice}</p>}
      {!copy ? (
        error ? (
          <Button type="button" icon="refresh" onClick={() => { setError(""); setReload(value => value + 1); }}>Retry</Button>
        ) : (
          <AnimatedLoadingState compact title="Loading templates" />
        )
      ) : (
        <>
        <div className="twe-communication-command-bar">
          <div><p className="twe-communication-version">
              Draft revision {record.version} ·{" "}
              {record.active_version == null
                ? definition.automated
                  ? definition.context === "package" ? "Using shared package template" : "Default template active"
                  : "Default invitation copy"
                : `${definition.automated ? "Active" : "Approved"} revision ${record.active_version}`}
            </p>
            <p role="status">{saving ? "Saving draft…" : dirty ? "Unsaved changes" : "Draft saved"}</p></div>
          <div className="template-actions">
            <Button type="button" icon="preview" disabled={busy || Boolean(confirmation)} onClick={() => action("preview")}>Preview email</Button>
            <Button type="submit" form="twe-email-copy-form" icon="save" disabled={busy || saving || !dirty || Boolean(confirmation)}>Save draft</Button>
            {canActivate && <Button type="button" icon="check" disabled={busy || saving || dirty || record.version === 0 || Boolean(confirmation)}
              onClick={() => setConfirmation({ kind: "activate" })}>{definition.automated ? "Activate saved template" : "Approve saved template"}</Button>}
          </div>
        </div>
        <div className="template-workspace">
          <form id="twe-email-copy-form"
            onSubmit={(event) => {
              event.preventDefault();
              action("draft");
            }}
            aria-label="Email template copy"
          >
            {saveState.error && <InlineNotice tone="danger" title="Draft not saved" message={saveState.error} />}
            <TextField
              disabled={busy || Boolean(confirmation)}
              label="Subject"
              value={copy.subject}
              maxLength={160}
              required
              onChange={(event) => edit("subject", event.target.value)}
            />
            <TextField
              disabled={busy || Boolean(confirmation)}
              label="Heading"
              value={copy.heading}
              maxLength={160}
              required
              onChange={(event) => edit("heading", event.target.value)}
            />
            {definition.automated && <p className="template-variables">Personalisation: <code>{"{{customer}}"}</code> <code>{"{{service}}"}</code> <code>{"{{package}}"}</code></p>}
            <RichTextField
              disabled={busy || Boolean(confirmation)}
              label="Message"
              value={copy.message}
              maxLength={3000}
              required
              rows={7}
              onChange={(event) => edit("message", event.target.value)}
            />
            <TextField
              disabled={busy || Boolean(confirmation)}
              label="Button label"
              value={copy.ctaLabel}
              maxLength={60}
              required
              onChange={(event) => edit("ctaLabel", event.target.value)}
            />
            {definition.automated && <TextField
              disabled={busy || Boolean(confirmation)}
              label="Questionnaire button label"
              value={copy.continuationCtaLabel ?? "Complete your trip details"}
              maxLength={60}
              required
              onChange={event => edit("continuationCtaLabel", event.target.value)}
            />}
            <details className="twe-builder-disclosure twe-template-test">
              <summary><span>Test email</span><NavigationIcon name="arrow"/></summary>
              <div className="twe-builder-body"><Button type="button" disabled={busy || saving || dirty || Boolean(confirmation)} onClick={() => setConfirmation({ kind: "test" })}>Send test email</Button></div>
            </details>
          </form>
          <section
            className="template-preview"
            aria-labelledby="template-preview-heading"
          >
            <h2 id="template-preview-heading">Email preview</h2>
            {preview ? (
              <>
                <p>Subject: {preview.subject}</p>
                <div className="template-actions" role="group" aria-label="Preview size">
                  <Button type="button" aria-pressed={previewWidth === "desktop"} onClick={() => setPreviewWidth("desktop")}>Desktop</Button>
                  <Button type="button" aria-pressed={previewWidth === "mobile"} onClick={() => setPreviewWidth("mobile")}>Mobile</Button>
                </div>
                <iframe
                  className={previewWidth === "mobile" ? "template-preview-mobile" : "template-preview-desktop"}
                  title={`${definition.label} preview`}
                  sandbox=""
                  referrerPolicy="no-referrer"
                  srcDoc={previewHtml}
                />
              </>
            ) : (
              <p>No preview yet.</p>
            )}
          </section>
        </div>
        </>
      )}
      {record && <HistoryDisclosure title="Version history" count={history.length}>
        <Button type="button" icon="refresh" disabled={busy || saving || historyLoading} onClick={loadHistory}>{historyLoading ? "Loading…" : "Load history"}</Button>
        {historyError && <InlineNotice tone="danger" title="History unavailable" message={historyError}/>}
        {history.map(item => <div key={item.version} className="editor-actions">
          <span>Revision {item.version} · {item.kind} · {new Date(item.created_at).toLocaleString()}</span>
          <Button type="button" disabled={busy || saving || dirty || historyLoading} onClick={() => setConfirmation({ kind: "restore", revision: item.version })}>Restore draft</Button>
        </div>)}
      </HistoryDisclosure>}
      <ERPConfirmDialog open={Boolean(confirmation)} title={confirmation?.kind === "switch" ? "Discard unsaved template changes?" : confirmation?.kind === "restore" ? "Restore this revision?" : confirmation?.kind === "test" ? "Send a test email?" : definition.automated ? "Activate saved template?" : "Approve saved template?"}
        message={confirmation?.kind === "switch" ? "The current unsaved template edits will be lost." : confirmation?.kind === "restore" ? "Restore as a new draft without changing outgoing emails." : confirmation?.kind === "test" ? "Send this template with sample data to testing@travelwitheasegh.com. No enquiry or invitation will be created." : definition.automated ? "Newly prepared enquiry emails will use this saved version. No email will be sent now." : "The invitation copy will be approved without creating or sending an invitation."}
        confirmLabel={confirmation?.kind === "switch" ? "Discard and switch" : confirmation?.kind === "restore" ? "Restore draft" : confirmation?.kind === "test" ? "Send test email" : definition.automated ? "Activate template" : "Approve template"} confirmTone="primary" loading={busy}
        onCancel={() => setConfirmation(null)} onConfirm={async () => { const pending = confirmation; setConfirmation(null); if (pending?.kind === "switch") switchTemplate(pending.slug); else if (pending?.kind === "restore") await action("restore", pending.revision); else if (pending?.kind === "test") await action("test"); else await action("activate"); }} />
    </div>
  );
}
