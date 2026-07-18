import React from "react";
import { createPortal } from "react-dom";
import { DateField, SelectField } from "@faako/ui";
import {
  PROJECT_TASK_PRIORITY_OPTIONS,
  PROJECT_TASK_STATUS_OPTIONS,
} from "./projectTaskForm";

export default function ProjectTaskFormModal({
  assignees,
  editingTaskId,
  form,
  error,
  saving,
  onChange,
  onClose,
  onSubmit,
}) {
  return createPortal(
    <div className="modal-backdrop" role="presentation">
      <button className="modal-dismiss" type="button" aria-label="Close task form" onClick={onClose} />
      <article className="modal-card project-task-modal" role="dialog" aria-modal="true" aria-labelledby="project-task-form-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Project task</p>
            <h3 id="project-task-form-title">{editingTaskId ? "Edit task" : "New task"}</h3>
            <p className="muted">Keep the next piece of work clear and assigned.</p>
          </div>
          <button className="button button-ghost" type="button" onClick={onClose}>Close</button>
        </div>

        {error ? <div className="notice is-error" role="alert">{error}</div> : null}

        <form className="stack" onSubmit={onSubmit}>
          <div className="project-task-form-grid">
            <label className="form-field project-task-title-field">
              <span>Title</span>
              <input className="input" type="text" value={form.title} onChange={(event) => onChange("title", event.target.value)} required />
            </label>
            <SelectField fieldClassName="form-field" label="Status" value={form.status} onChange={(event) => onChange("status", event.target.value)}>
              {PROJECT_TASK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <SelectField fieldClassName="form-field" label="Priority" value={form.priority} onChange={(event) => onChange("priority", event.target.value)}>
              {PROJECT_TASK_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <SelectField fieldClassName="form-field" label="Assignee" value={form.assigneeUserId} onChange={(event) => onChange("assigneeUserId", event.target.value)}>
              <option value="">Unassigned</option>
              {assignees.map((assignee) => <option key={assignee.id} value={String(assignee.id)}>{assignee.fullName || assignee.email}</option>)}
            </SelectField>
            <DateField fieldClassName="form-field" label="Start date" value={form.startDate} onChange={(event) => onChange("startDate", event.target.value)} />
            <DateField fieldClassName="form-field" label="Due date" value={form.dueDate} onChange={(event) => onChange("dueDate", event.target.value)} />
          </div>
          <label className="form-field">
            <span>Description</span>
            <textarea className="input" value={form.description} onChange={(event) => onChange("description", event.target.value)} />
          </label>
          <div className="header-actions">
            <button className="button button-ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : editingTaskId ? "Save task" : "Create task"}
            </button>
          </div>
        </form>
      </article>
    </div>,
    document.body
  );
}
