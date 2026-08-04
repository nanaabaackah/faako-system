import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import { InlineNotice } from "../../components/InlineNotice/InlineNotice";
import { reebsApiResponse } from "../../api/client.js";
import "./AdminInventorySettings.css";

const inventoryTemplateSection = "inventory-templates";
const contentUrl = "/api/websiteContent";

const templateSlots = [
  {
    key: "email-template",
    title: "Email template",
    description: "Inventory messages used for customer and internal updates.",
  },
  {
    key: "terms-and-conditions",
    title: "Terms and conditions",
    description: "Rental, sale, and inventory condition notes.",
  },
  {
    key: "inventory-notes",
    title: "Inventory notes",
    description: "Shared wording for stock handoff, pickup, and return notes.",
  },
];

const readApiError = async (response, fallback) => {
  const text = await response.text().catch(() => "");
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    return parsed?.error || parsed?.message || fallback;
  } catch {
    return text || fallback;
  }
};

const normalizeTemplateForm = (items) => {
  const byKey = new Map((Array.isArray(items) ? items : []).map((item) => [item.key, item]));
  return templateSlots.reduce((acc, slot) => {
    const saved = byKey.get(slot.key);
    const payload = saved?.payload && typeof saved.payload === "object" ? saved.payload : {};
    acc[slot.key] = {
      id: saved?.id || null,
      title: payload.title || slot.title,
      subject: payload.subject || "",
      body: payload.body || "",
      updatedAt: saved?.updatedAt || null,
    };
    return acc;
  }, {});
};

function AdminInventoryTemplates() {
  const [forms, setForms] = useState(() => normalizeTemplateForm([]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const slotByKey = useMemo(() => new Map(templateSlots.map((slot) => [slot.key, slot])), []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await reebsApiResponse(`${contentUrl}?section=${inventoryTemplateSection}`);
      if (!response.ok) {
        throw new Error(await readApiError(response, "Inventory templates could not be loaded."));
      }
      const data = await response.json();
      setForms(normalizeTemplateForm(data?.items));
    } catch (err) {
      setError(err.message || "Inventory templates could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  const updateForm = (key, field, value) => {
    setForms((current) => ({
      ...current,
      [key]: {
        ...(current[key] || {}),
        [field]: value,
      },
    }));
  };

  const saveTemplate = async (key) => {
    const slot = slotByKey.get(key);
    const form = forms[key] || {};
    setSaving(key);
    setError("");
    setSuccess("");
    try {
      const response = await reebsApiResponse(contentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: inventoryTemplateSection,
          key,
          sortOrder: templateSlots.findIndex((item) => item.key === key),
          payload: {
            title: form.title || slot?.title || key,
            subject: form.subject || "",
            body: form.body || "",
          },
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Inventory template could not be saved."));
      }
      await loadTemplates();
      setSuccess(`${slot?.title || "Template"} saved.`);
    } catch (err) {
      setError(err.message || "Inventory template could not be saved.");
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="admin-page inventory-admin-settings-page">
      <div className="admin-shell">
        <AdminBreadcrumb items={[{ label: "Inventory", to: "/admin/inventory" }, { label: "Templates" }]} />
        <AdminPageHeader
          title="Inventory templates"
          subtitle="Edit the database-backed notes used by the inventory module."
          actionsClassName="inventory-admin-settings-actions"
          actions={
            <Link to="/admin/inventory" className="admin-secondary inventory-admin-settings-back">
              Back to stock
            </Link>
          }
        />

        {loading && <InlineNotice tone="loading" message="Loading inventory templates." />}
        {error && <InlineNotice tone="error" message={error} />}
        {success && <InlineNotice tone="success" message={success} />}

        <section className="inventory-admin-template-list" aria-label="Inventory template editors">
          {templateSlots.map((slot) => {
            const form = forms[slot.key] || {};
            return (
              <article key={slot.key} className="inventory-admin-template-card">
                <div>
                  <h2>{slot.title}</h2>
                  <p>{slot.description}</p>
                </div>
                <label>
                  Template title
                  <input
                    value={form.title || ""}
                    onChange={(event) => updateForm(slot.key, "title", event.target.value)}
                    placeholder={slot.title}
                  />
                </label>
                <label>
                  Subject
                  <input
                    value={form.subject || ""}
                    onChange={(event) => updateForm(slot.key, "subject", event.target.value)}
                    placeholder="Subject"
                  />
                </label>
                <label>
                  Body
                  <textarea
                    value={form.body || ""}
                    onChange={(event) => updateForm(slot.key, "body", event.target.value)}
                    placeholder="Write the template text here."
                  />
                </label>
                <div className="admin-form-actions">
                  <button
                    type="button"
                    className="admin-primary"
                    onClick={() => saveTemplate(slot.key)}
                    disabled={saving === slot.key}
                  >
                    {saving === slot.key ? "Saving..." : "Save"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}

export default AdminInventoryTemplates;
