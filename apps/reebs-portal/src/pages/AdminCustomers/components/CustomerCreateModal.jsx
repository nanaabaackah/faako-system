import React from "react";
import { ERPFormNotice } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import { faUserPlus, faXmark } from "/src/icons/iconSet";
import CustomerFormFields from "./CustomerFormFields";
import { useCustomerDialog } from "./useCustomerDialog";

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
  const panelRef = useCustomerDialog({ isOpen, onClose });
  if (!isOpen) return null;

  return (
    <div className="admin-modal">
      <div
        className="admin-modal-panel crm-modal-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-customer-title"
      >
        <header className="crm-modal-header">
          <div>
            <h2 id="create-customer-title">New customer</h2>
          </div>
          <button type="button" className="admin-close" onClick={onClose} aria-label="Close">
            <AppIcon icon={faXmark} />
          </button>
        </header>

        <form className="crm-form" onSubmit={onSubmit}>
          <CustomerFormFields
            form={createForm}
            onChange={onFormChange}
            idPrefix="create-customer"
          />

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
