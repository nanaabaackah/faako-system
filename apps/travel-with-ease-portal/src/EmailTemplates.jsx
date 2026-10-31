import { useEffect, useState } from "react";
import {
  AnimatedLoadingState,
  InlineNotice,
  TextField,
  TextareaField,
} from "@faako/ui";
import Button from "./ActionButton.jsx";
import logo from "../../travel-with-ease-web/public/brand/Primary gold.png";
import instagram from "../../travel-with-ease-web/public/brand/social/instagram.png";
import tiktok from "../../travel-with-ease-web/public/brand/social/tiktok.png";
import "./email-templates.css";

export default function EmailTemplates({ api, session, onDirtyChange }) {
  const [record, setRecord] = useState(null);
  const [copy, setCopy] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  // Preview branding is bundled locally; the actual outgoing email retains
  // absolute public asset URLs for email-client compatibility.
  const previewHtml = preview?.html
    .replaceAll("https://travelwitheasegh.com/brand/Primary%20gold.png", logo)
    .replaceAll("https://travelwitheasegh.com/brand/social/instagram.png", instagram)
    .replaceAll("https://travelwitheasegh.com/brand/social/tiktok.png", tiktok);
  const headers = { "X-CSRF-Token": session.csrfToken };
  useEffect(() => {
    let current = true;
    api
      .get("/api/agent/templates", { responseMode: "data" })
      .then((result) => {
        if (current) {
          setRecord(result);
          setCopy(result.draft);
        }
      })
      .catch((error) => {
        if (current) setError(error.message);
      });
    return () => {
      current = false;
    };
  }, [api]);
  function edit(field, value) {
    setCopy((previous) => ({ ...previous, [field]: value }));
    setDirty(true);
    onDirtyChange(true);
    setPreview(null);
    setNotice("");
  }
  async function action(kind) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.post(`/api/agent/templates/${kind}`, {
        headers,
        responseMode: "data",
        json:
          kind === "preview"
            ? copy
            : kind === "draft"
              ? { copy, expectedVersion: record.version }
              : { expectedVersion: record.version },
      });
      if (kind === "preview") {
        setPreview(result);
        setNotice("Preview only. No email was sent.");
      } else {
        setRecord(result);
        setCopy(result.draft);
        setDirty(false);
        onDirtyChange(false);
        setNotice(
          session.demo
            ? "Demo template updated in this tab only. Nothing was sent or activated on the server."
            : kind === "draft"
              ? "Draft saved. Outgoing emails have not changed."
              : "Template activated for newly prepared enquiry emails. Existing queued email payloads are unchanged.",
        );
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
        <h2>Enquiry acknowledgement</h2>
        <p>
          Edit the message travellers receive after submitting an enquiry.
          Preview and save a draft before making it active.
        </p>
        <p>
          Company details, logo, social links, automatic-send notice and
          delivery recipients remain protected. This module does not send test
          emails.
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
                ? "Default template active"
                : `Active revision ${record.active_version}`}
            </p>
            <TextField
              label="Subject"
              value={copy.subject}
              maxLength={160}
              required
              onChange={(event) => edit("subject", event.target.value)}
            />
            <TextField
              label="Heading"
              value={copy.heading}
              maxLength={160}
              required
              onChange={(event) => edit("heading", event.target.value)}
            />
            <TextareaField
              label="Message"
              value={copy.message}
              maxLength={3000}
              required
              rows={7}
              onChange={(event) => edit("message", event.target.value)}
            />
            <TextField
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
              <Button type="submit" icon="save" disabled={busy || !dirty}>
                Save draft
              </Button>
              <Button
                type="button"
                icon="check"
                disabled={busy || dirty || record.version === 0}
                onClick={() => {
                  if (
                    window.confirm(
                      "Activate this saved template for new enquiry emails? No email will be sent now.",
                    )
                  )
                    action("activate");
                }}
              >
                Activate saved template
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
                  title="Enquiry acknowledgement preview"
                  sandbox=""
                  referrerPolicy="no-referrer"
                srcDoc={previewHtml}
                />
              </>
            ) : (
              <p>
                Choose Preview email to see your current copy with the company
                branding.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
