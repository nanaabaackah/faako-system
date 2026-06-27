import React from "react";
import { ERPFormNotice } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import { faUserPlus, faXmark } from "/src/icons/iconSet";

export default function CustomerCreateModal({
  isOpen,
  createForm,
  createError,
  onCreateErrorClear,
  createSaving,
  onClose,
  onSubmit,
  onFormChange,
}) {
  if (!isOpen) return null;

  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal-panel crm-modal-panel">
        <header className="crm-modal-header">
          <div>
            <p className="admin-eyebrow">CRM</p>
            <h2>New customer</h2>
          </div>
          <button type="button" className="admin-close" onClick={onClose} aria-label="Close">
            <AppIcon icon={faXmark} />
          </button>
        </header>

        <form className="crm-form" onSubmit={onSubmit}>
          <div className="crm-field-grid">
            <label className="crm-field">
              <span>Name</span>
              <input
                type="text"
                value={createForm.name}
                onChange={(event) => onFormChange("name", event.target.value)}
                placeholder="Customer name"
                required
              />
            </label>

            <label className="crm-field">
              <span>Phone</span>
              <input
                type="tel"
                value={createForm.phone}
                onChange={(event) => onFormChange("phone", event.target.value)}
                placeholder="+233 ..."
              />
            </label>

            <label className="crm-field crm-field-full">
              <span>Email</span>
              <input
                type="email"
                value={createForm.email}
                onChange={(event) => onFormChange("email", event.target.value)}
                placeholder="email@example.com"
              />
            </label>
          </div>

          {createError ? (
            <ERPFormNotice tone="danger" title="Customer not created" onDismiss={onCreateErrorClear}>
              {createError}
            </ERPFormNotice>
          ) : null}

          <div className="crm-modal-actions">
            <button type="button" className="admin-secondary crm-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-primary crm-button" disabled={createSaving}>
              <AppIcon icon={faUserPlus} />
              {createSaving ? "Saving..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
