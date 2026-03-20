import React, { useEffect, useMemo, useState } from "react";
import "./WebsiteTemplateEditor.css";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faCircleCheck,
  faExternalLinkAlt,
  faFloppyDisk,
  faPenToSquare,
} from "/src/icons/iconSet";

import { useTemplateConfig } from "../../context/TemplateConfigContext";
import { WEBSITE_URL } from "../../utils/website";

const FIELD_META = [
  {
    name: "heroKicker",
    label: "Hero kicker",
    type: "text",
    helper: "Short snapshot above the main title.",
  },
  {
    name: "heroHeading",
    label: "Hero heading",
    type: "text",
    helper: "The large brand name or headline.",
  },
  {
    name: "heroTagline",
    label: "Hero tagline",
    type: "text",
    helper: "One line that types inside the hero (used by the typing effect).",
  },
  {
    name: "heroSub",
    label: "Hero subheading",
    type: "textarea",
    helper: "Supporting copy under the headline.",
  },
  {
    name: "accentColor",
    label: "Accent color",
    type: "color",
    helper: "Controls the primary buttons/borders across the site.",
  },
  {
    name: "heroPrimaryCta",
    label: "Primary CTA text",
    type: "text",
    helper: "Text for the main hero button.",
  },
  {
    name: "heroSecondaryCta",
    label: "Secondary CTA text",
    type: "text",
    helper: "Text for the secondary button.",
  },
  {
    name: "heroTertiaryCta",
    label: "Tertiary CTA text",
    type: "text",
    helper: "Text for the ghost link.",
  },
];

function WebsiteTemplateEditor() {
  const { config, updateTemplateConfig, resetTemplateConfig, storePreviewConfig } = useTemplateConfig();
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(config);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const previewAccent = useMemo(() => draft.accentColor || config.accentColor, [draft.accentColor, config.accentColor]);

  const handleFieldChange = (field) => (event) => {
    const value = event.target.value;
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = (event) => {
    event.preventDefault();
    setSaving(true);
    updateTemplateConfig(draft);
    setStatus("Changes saved. The live site will reflect them immediately.");
    setSaving(false);
    setEditMode(false);
  };

  const handlePreview = () => {
    storePreviewConfig(draft);
    if (typeof window !== "undefined") {
      window.open(`${WEBSITE_URL}?templatePreview=1`, "_blank");
    }
    setStatus("Preview opened in a new tab.");
  };

  const handleExitEditMode = () => {
    setEditMode(false);
    setDraft(config);
    setStatus("");
  };

  const handleReset = () => {
    if (!editMode) return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Restore template defaults and overwrite current customizations?");
      if (!confirmed) return;
    }
    resetTemplateConfig();
    setStatus("Defaults restored. Save to apply them.");
  };

  return (
    <div className="template-editor-page admin-shell">
      <div className="template-editor-header">
        <div>
          <p className="kicker">Template mode</p>
          <h1 className="admin-section-title">Edit the public website</h1>
          <p className="template-editor-sub">
            Toggle edit mode to change hero copy and accent colors. Your edits are saved locally and applied across the
            front-end instantly, then appear on the live website.
          </p>
        </div>
        <div className="template-editor-header-actions">
          {!editMode ? (
            <button
              type="button"
              className="hero-btn hero-btn-primary"
              onClick={() => {
                setStatus("");
                setEditMode(true);
              }}
            >
              <AppIcon icon={faPenToSquare} />
              Enter edit mode
            </button>
          ) : (
            <>
              <button type="button" className="hero-btn hero-btn-ghost" onClick={handlePreview}>
                <AppIcon icon={faExternalLinkAlt} />
                Preview edits
              </button>
              <button type="button" className="hero-btn hero-btn-ghost" onClick={handleExitEditMode}>
                <AppIcon icon={faPenToSquare} />
                Exit edit mode
              </button>
            </>
          )}
          <a href={WEBSITE_URL} target="_blank" rel="noreferrer" className="hero-btn hero-btn-link">
            <AppIcon icon={faExternalLinkAlt} />
            View public site
          </a>
        </div>
      </div>

      <div className="template-editor-grid">
        <form className="template-editor-form" onSubmit={handleSave}>
          {FIELD_META.map((field) => (
            <label key={field.name} className="template-editor-field">
              <span className="template-editor-field-label">{field.label}</span>
              {field.type === "textarea" ? (
                <textarea
                  value={draft[field.name]}
                  onChange={handleFieldChange(field.name)}
                  disabled={!editMode}
                  rows={3}
                />
              ) : (
                <input
                  type={field.type}
                  value={draft[field.name]}
                  onChange={handleFieldChange(field.name)}
                  disabled={!editMode}
                />
              )}
              <small>{field.helper}</small>
            </label>
          ))}
          <div className="template-editor-actions">
            <button type="submit" className="hero-btn hero-btn-primary" disabled={!editMode || saving}>
              <AppIcon icon={faFloppyDisk} />
              Save &amp; apply
            </button>
            <button type="button" className="hero-btn hero-btn-ghost" onClick={handleReset} disabled={!editMode}>
              <AppIcon icon={faCircleCheck} />
              Restore defaults
            </button>
          </div>
          {status && <p className="template-editor-status">{status}</p>}
        </form>

        <div className="template-editor-preview">
          <div className="template-editor-preview-card" style={{ borderColor: previewAccent }}>
            <p className="hero-kicker">{draft.heroKicker}</p>
            <h2>{draft.heroHeading}</h2>
            <p className="template-editor-preview-tagline">{draft.heroTagline}</p>
            <p>{draft.heroSub}</p>
            <div className="template-editor-preview-hero-ctas">
              <span style={{ background: previewAccent }}>{draft.heroPrimaryCta}</span>
              <span style={{ borderColor: previewAccent }}>{draft.heroSecondaryCta}</span>
            </div>
            <p className="template-editor-preview-tertiary">{draft.heroTertiaryCta}</p>
            <p className="template-editor-preview-note">
              Live accent color: <strong>{previewAccent}</strong>
            </p>
          </div>
          <p className="template-editor-preview-hint">
            When you save, the hero copy above and the accent color propagate across the website automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

export default WebsiteTemplateEditor;
