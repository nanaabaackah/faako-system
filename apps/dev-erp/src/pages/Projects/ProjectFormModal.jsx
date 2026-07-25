import React from "react";
import { DateField, SelectField } from "@faako/ui";

const PROJECT_TYPE_OPTIONS = [
  { value: "PERSONAL", label: "Personal" },
  { value: "EXTERNAL", label: "External" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const HEALTH_OPTIONS = [
  { value: "ON_TRACK", label: "On track" },
  { value: "AT_RISK", label: "At risk" },
  { value: "BLOCKED", label: "Blocked" },
];

const CURRENCY_OPTIONS = ["CAD", "GHS"];

export default function ProjectFormModal({
  isAdmin,
  organizations,
  formState,
  editingProjectId,
  formError,
  isSaving,
  onFieldChange,
  onSubmit,
  onClose,
  projectStages,
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <button className="modal-dismiss" type="button" aria-label="Close project form" onClick={onClose} />
      <article className="modal-card projects-modal" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Projects</p>
            <h3 id="project-form-title">{editingProjectId ? "Edit project" : "New project"}</h3>
            <p className="muted">Set the stage and delivery details.</p>
          </div>
          <button className="button button-ghost" type="button" onClick={onClose}>Close</button>
        </div>

        {formError ? <div className="notice is-error" role="alert">{formError}</div> : null}

        <form className="stack" onSubmit={onSubmit}>
          <div className="project-form-grid">
            {isAdmin && organizations.length ? (
              <SelectField
                fieldClassName="form-field"
                label="Organization"
                value={formState.organizationId}
                onChange={(event) => onFieldChange("organizationId", event.target.value)}
                required
              >
                <option value="">Select organization</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={String(organization.id)}>{organization.name}</option>
                ))}
              </SelectField>
            ) : null}
            <label className="form-field">
              <span>Title</span>
              <input className="input" type="text" value={formState.title} onChange={(event) => onFieldChange("title", event.target.value)} required />
            </label>
            <label className="form-field">
              <span>Client name</span>
              <input className="input" type="text" value={formState.clientName} onChange={(event) => onFieldChange("clientName", event.target.value)} />
            </label>
            <SelectField fieldClassName="form-field" label="Type" value={formState.projectType} onChange={(event) => onFieldChange("projectType", event.target.value)}>
              {PROJECT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <SelectField fieldClassName="form-field" label="Stage" value={formState.stage} onChange={(event) => onFieldChange("stage", event.target.value)}>
              {projectStages.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
            </SelectField>
            <SelectField fieldClassName="form-field" label="Priority" value={formState.priority} onChange={(event) => onFieldChange("priority", event.target.value)}>
              {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <DateField fieldClassName="form-field" label="Start date" value={formState.startDate} onChange={(event) => onFieldChange("startDate", event.target.value)} />
            <DateField fieldClassName="form-field" label="Due date" value={formState.dueDate} onChange={(event) => onFieldChange("dueDate", event.target.value)} />
            <label className="form-field">
              <span>Progress</span>
              <input className="input" type="number" min="0" max="100" step="1" value={formState.progressPercent} onChange={(event) => onFieldChange("progressPercent", event.target.value)} aria-describedby="project-progress-help" />
              <small className="muted" id="project-progress-help">0–100 percent</small>
            </label>
            <SelectField fieldClassName="form-field" label="Health" value={formState.health} onChange={(event) => onFieldChange("health", event.target.value)}>
              {HEALTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <SelectField fieldClassName="form-field" label="Currency" value={formState.currency} onChange={(event) => onFieldChange("currency", event.target.value)}>
              {CURRENCY_OPTIONS.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </SelectField>
            <label className="form-field">
              <span>Budget</span>
              <input className="input" type="number" min="0" step="0.01" value={formState.budgetAmount} onChange={(event) => onFieldChange("budgetAmount", event.target.value)} />
            </label>
            <label className="form-field">
              <span>External reference</span>
              <input className="input" type="text" value={formState.externalRef} onChange={(event) => onFieldChange("externalRef", event.target.value)} />
            </label>
          </div>
          <label className="form-field">
            <span>Description</span>
            <textarea className="input" value={formState.description} onChange={(event) => onFieldChange("description", event.target.value)} />
          </label>
          <div className="header-actions">
            <button className="button button-ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="button button-primary" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : editingProjectId ? "Save project" : "Create project"}
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}
