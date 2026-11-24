import { useEffect, useRef, useState } from "react";
import { createDraftAutosave } from "../lib/draft-autosave.js";
import {
  AnimatedLoadingState,
  InlineNotice,
  TextField,
  TextareaField,
  SelectField,
  ERPConfirmDialog,
  useToast,
} from "@faako/ui";
import Button from "./ActionButton.jsx";
import logo from "../../../travel-with-ease-web/public/brand/Primary gold.png";
import instagram from "../../../travel-with-ease-web/public/brand/social/instagram.png";
import tiktok from "../../../travel-with-ease-web/public/brand/social/tiktok.png";
import "../styles/email-templates.css";
import { emailTemplateOptions } from "../../../travel-with-ease-api/src/notifications/template-catalogue.js";

export default function EmailTemplates({ api, session, onDirtyChange, onRefreshBlockedChange }) {
  const { pushToast } = useToast();
  const [slug, setSlug] = useState("enquiry-acknowledgement");
  const definition = emailTemplateOptions.find(
    (option) => option.slug === slug,
  );
  const [record, setRecord] = useState(null);
  const [copy, setCopy] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [saveState, setSaveState] = useState({ status: "saved", error: "" });
  const writer = useRef(null);
  const copyRef = useRef(null);
  const saving = saveState.status === "saving";
  useEffect(() => {
    onRefreshBlockedChange?.(dirty || busy || saving || !record || Boolean(confirmation));
    return () => onRefreshBlockedChange?.(false);
  }, [dirty, busy, saving, record, confirmation, onRefreshBlockedChange]);
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
  }, [api, slug, session.csrfToken, onDirtyChange]);
  function changeTemplate(event) {
    if (busy || saving || event.target.value === slug) return;
    if (dirty) { setConfirmation({ kind: "switch", slug: event.target.value }); return; }
    switchTemplate(event.target.value);
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
  async function action(kind) {
    if (busy || (kind === "activate" && (dirty || saving))) return;
    if (kind === "draft") { await writer.current?.flush(); return; }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.post(`/api/agent/templates/${slug}/${kind}`, {
        headers,
        responseMode: "data",
        json:
          kind === "preview"
            ? copy
            : { expectedVersion: record.version },
      });
      if (kind === "preview") {
        setPreview(result);
        setNotice("Preview only. No email was sent.");
      } else {
        setRecord(result);
        copyRef.current = result.draft;
        setCopy(result.draft);
        writer.current?.reset(result.draft, result.version);
        setNotice(
          kind === "draft"
              ? "Draft saved. Outgoing emails have not changed."
              : definition.automated
                ? "Template activated for newly prepared enquiry emails. Existing queued email payloads are unchanged."
                : "Invitation template approved and saved. No invitations were created or sent. Use Staff access for email invitations when enabled, or for manually shared codes.",
        );
        pushToast({ tone: "success", title: kind === "draft" ? "Template draft saved" : definition.automated ? "Template activated" : "Template approved", message: kind === "draft" ? "Outgoing emails have not changed." : "No email was sent by this action." });
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="email-templates">
      <section className="template-intro">
        <SelectField
          label="Email type"
          value={slug}
          disabled={busy || saving || Boolean(confirmation)}
          onChange={changeTemplate}
        >
          {emailTemplateOptions.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <h2>{definition.label}</h2>
        <p>
          {definition.description}
        </p>
      </section>
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
          <p>Reload this module to try again.</p>
        ) : (
          <AnimatedLoadingState compact title="Loading templates" />
        )
      ) : (
        <div className="template-workspace">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              action("draft");
            }}
            aria-label="Email template copy"
          >
            <p>
              Draft revision {record.version} ·{" "}
              {record.active_version == null
                ? definition.automated
                  ? "Default template active"
                  : "Default invitation copy"
                : `${definition.automated ? "Active" : "Approved"} revision ${record.active_version}`}
            </p>
            <p role="status">{saving ? "Saving draft…" : dirty ? "Unsaved changes" : "Draft saved"}</p>
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
            <TextareaField
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
            <div className="template-actions">
              <Button
                type="button"
                icon="preview"
                disabled={busy}
                onClick={() => action("preview")}
              >
                Preview email
              </Button>
              <Button type="submit" icon="save" disabled={busy || saving || !dirty}>
                Save draft
              </Button>
              <Button
                type="button"
                icon="check"
                disabled={busy || saving || dirty || record.version === 0}
                onClick={() => setConfirmation({ kind: "activate" })}
              >
                {definition.automated
                  ? "Activate saved template"
                  : "Approve saved template"}
              </Button>
            </div>
          </form>
          <section
            className="template-preview"
            aria-labelledby="template-preview-heading"
          >
            <h2 id="template-preview-heading">Email preview</h2>
            {preview ? (
              <>
                <p>Subject: {preview.subject}</p>
                <iframe
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
      )}
      <ERPConfirmDialog open={Boolean(confirmation)} title={confirmation?.kind === "switch" ? "Discard unsaved template changes?" : definition.automated ? "Activate saved template?" : "Approve saved template?"}
        message={confirmation?.kind === "switch" ? "The current unsaved template edits will be lost." : definition.automated ? "Newly prepared enquiry emails will use this saved version. No email will be sent now." : "The invitation copy will be approved without creating or sending an invitation."}
        confirmLabel={confirmation?.kind === "switch" ? "Discard and switch" : definition.automated ? "Activate template" : "Approve template"} confirmTone="primary" loading={busy}
        onCancel={() => setConfirmation(null)} onConfirm={async () => { const pending = confirmation; setConfirmation(null); if (pending?.kind === "switch") switchTemplate(pending.slug); else await action("activate"); }} />
    </div>
  );
}
