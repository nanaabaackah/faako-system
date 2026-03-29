import { AppIcon } from "/src/components/Icon/Icon";
import { faRotateRight, faTrash, faXmark } from "/src/icons/iconSet";

export default function WaterLedgerEditorModal({
  activeLedgerItem,
  activeLedgerRecord,
  ledgerForm,
  setLedgerForm,
  ledgerError,
  orderedVendorOptions,
  selectedLedgerVendor,
  ledgerSelectedVendorName,
  ledgerRestockQuantity,
  ledgerRestockCost,
  ledgerAdjustmentReasonOptions,
  ledgerAdjustmentHasCustomReason,
  ledgerAdjustmentQuantity,
  ledgerAdjustmentSummaryLabel,
  resolvedLedgerExpenseCategory,
  ledgerExpenseSummaryAmount,
  customAdjustmentReason,
  customExpenseCategory,
  expenseCategoryOptions,
  adjustmentReasonOptionsByMode,
  formatDateTime,
  formatCurrency,
  closeLedgerEditor,
  handleLedgerSubmit,
  handleStockEntryUndo,
  handleExpenseDelete,
  saving,
  loading,
}) {
  if (!activeLedgerItem || !ledgerForm) return null;

  const titleLabel =
    activeLedgerItem.type === "restock"
      ? "Restock"
      : activeLedgerItem.type === "adjustment"
        ? "Correction"
        : "Expense";
  const eyebrowLabel =
    activeLedgerItem.type === "restock"
      ? "Edit restock"
      : activeLedgerItem.type === "adjustment"
        ? "Edit correction"
        : "Edit expense";

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="water-ledger-modal-title">
      <div className="admin-modal-panel water-order-modal bubble-card">
        <header>
          <div>
            <p className="water-module-eyebrow">{eyebrowLabel}</p>
            <h2 id="water-ledger-modal-title">
              {titleLabel} #{activeLedgerItem.id}
            </h2>
            {activeLedgerRecord?.createdAt ? (
              <div className="water-order-modal-meta">
                <span className="admin-modal-meta">Created {formatDateTime(activeLedgerRecord.createdAt)}</span>
              </div>
            ) : null}
          </div>
          <button type="button" className="admin-close" onClick={closeLedgerEditor} aria-label="Close">
            <AppIcon icon={faXmark} />
          </button>
        </header>

        <form className="water-module-form water-order-modal-form" onSubmit={handleLedgerSubmit}>
          {ledgerForm.type === "restock" ? (
            <>
              <div className="water-order-modal-grid">
                <label>
                  Link vendor
                  <select
                    value={ledgerForm.vendorId}
                    onChange={(event) => {
                      const nextVendorId = event.target.value;
                      const nextVendor =
                        orderedVendorOptions.find((vendor) => String(vendor.id) === String(nextVendorId)) || null;
                      setLedgerForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              vendorId: nextVendorId,
                              vendorName: nextVendor?.name || prev.vendorName,
                            }
                          : prev
                      );
                    }}
                  >
                    <option value="">No link</option>
                    {orderedVendorOptions.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Vendor
                  <input
                    type="text"
                    value={ledgerForm.vendorName}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, vendorName: event.target.value } : prev))
                    }
                    placeholder="Vendor name"
                    disabled={Boolean(selectedLedgerVendor)}
                  />
                </label>
                <label>
                  Qty
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={ledgerForm.quantity}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, quantity: event.target.value } : prev))
                    }
                    required
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={ledgerForm.date}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                    }
                    required
                  />
                </label>
                <label className="water-order-modal-field--wide">
                  Notes
                  <textarea
                    rows="3"
                    value={ledgerForm.notes}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                    }
                    placeholder="Optional"
                  />
                </label>
              </div>

              <div className="water-order-modal-summary bubble-card">
                <div>
                  <span>Qty</span>
                  <strong>{ledgerRestockQuantity}</strong>
                </div>
                <div>
                  <span>Cost</span>
                  <strong>{formatCurrency(ledgerRestockCost)}</strong>
                </div>
                <div>
                  <span>Vendor</span>
                  <strong>{ledgerSelectedVendorName || ledgerForm.vendorName || "Unassigned"}</strong>
                </div>
              </div>
            </>
          ) : null}

          {ledgerForm.type === "adjustment" ? (
            <>
              <div className="water-order-modal-grid">
                <label>
                  Type
                  <select
                    value={ledgerForm.mode}
                    onChange={(event) =>
                      setLedgerForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              mode: event.target.value,
                              reason:
                                prev.reason === customAdjustmentReason ||
                                (adjustmentReasonOptionsByMode[event.target.value] || []).includes(prev.reason)
                                  ? prev.reason
                                  : "",
                            }
                          : prev
                      )
                    }
                  >
                    <option value="remove">Remove</option>
                    <option value="add">Add back</option>
                  </select>
                </label>
                <label>
                  Qty
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={ledgerForm.quantityDelta}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, quantityDelta: event.target.value } : prev))
                    }
                    required
                  />
                </label>
                <label>
                  Reason
                  <select
                    value={ledgerForm.reason}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, reason: event.target.value } : prev))
                    }
                  >
                    <option value="">Choose reason</option>
                    {ledgerAdjustmentReasonOptions.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                    <option value={customAdjustmentReason}>Custom</option>
                  </select>
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={ledgerForm.date}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                    }
                    required
                  />
                </label>
                {ledgerAdjustmentHasCustomReason ? (
                  <label className="water-order-modal-field--wide">
                    Custom reason
                    <input
                      type="text"
                      value={ledgerForm.customReason}
                      onChange={(event) =>
                        setLedgerForm((prev) => (prev ? { ...prev, customReason: event.target.value } : prev))
                      }
                      placeholder="Breakage, count fix..."
                      required
                    />
                  </label>
                ) : null}
                <label className="water-order-modal-field--wide">
                  Notes
                  <textarea
                    rows="3"
                    value={ledgerForm.notes}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                    }
                    placeholder="Optional"
                  />
                </label>
              </div>

              <div className="water-order-modal-summary bubble-card">
                <div>
                  <span>Effect</span>
                  <strong>{ledgerForm.mode === "add" ? "Stock in" : "Stock out"}</strong>
                </div>
                <div>
                  <span>Qty</span>
                  <strong>{ledgerAdjustmentQuantity}</strong>
                </div>
                <div>
                  <span>Summary</span>
                  <strong>{ledgerAdjustmentSummaryLabel || "Set correction"}</strong>
                </div>
              </div>
            </>
          ) : null}

          {ledgerForm.type === "expense" ? (
            <>
              <div className="water-order-modal-grid">
                <label>
                  Category
                  <select
                    value={ledgerForm.category}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, category: event.target.value } : prev))
                    }
                  >
                    <option value="">Choose category</option>
                    {expenseCategoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    <option value={customExpenseCategory}>Other</option>
                  </select>
                </label>
                <label>
                  Amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={ledgerForm.amount}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, amount: event.target.value } : prev))
                    }
                    required
                  />
                </label>
                {ledgerForm.category === customExpenseCategory ? (
                  <label className="water-order-modal-field--wide">
                    Custom category
                    <input
                      type="text"
                      value={ledgerForm.customCategory}
                      onChange={(event) =>
                        setLedgerForm((prev) => (prev ? { ...prev, customCategory: event.target.value } : prev))
                      }
                      placeholder="Transport, labour..."
                      required
                    />
                  </label>
                ) : null}
                <label className="water-order-modal-field--wide">
                  Description
                  <input
                    type="text"
                    value={ledgerForm.description}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                    }
                    placeholder="Expense detail"
                    required
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={ledgerForm.date}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                    }
                    required
                  />
                </label>
                <label className="water-order-modal-field--wide">
                  Notes
                  <textarea
                    rows="3"
                    value={ledgerForm.notes}
                    onChange={(event) =>
                      setLedgerForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                    }
                    placeholder="Optional"
                  />
                </label>
              </div>

              <div className="water-order-modal-summary bubble-card">
                <div>
                  <span>Category</span>
                  <strong>{resolvedLedgerExpenseCategory || "Expense"}</strong>
                </div>
                <div>
                  <span>Amount</span>
                  <strong>{formatCurrency(ledgerExpenseSummaryAmount)}</strong>
                </div>
              </div>
            </>
          ) : null}

          {ledgerError ? <p className="water-module-feedback water-module-feedback--error">{ledgerError}</p> : null}

          <div className="water-order-modal-actions">
            {ledgerForm.type === "restock" || ledgerForm.type === "adjustment" ? (
              <button
                type="button"
                className="admin-secondary water-order-undo-btn"
                onClick={(event) =>
                  handleStockEntryUndo(
                    {
                      type: ledgerForm.type,
                      sourceId: activeLedgerRecord?.id ?? activeLedgerItem?.id,
                      label: ledgerForm.type === "restock" ? "Restock" : "Correction",
                      detail:
                        ledgerForm.type === "restock"
                          ? ledgerSelectedVendorName || ledgerForm.vendorName
                          : ledgerAdjustmentSummaryLabel || ledgerForm.reason,
                    },
                    event
                  )
                }
                disabled={saving || loading}
              >
                <AppIcon icon={faRotateRight} /> Undo
              </button>
            ) : null}
            {ledgerForm.type === "expense" ? (
              <button
                type="button"
                className="admin-secondary water-order-delete-btn"
                onClick={(event) => handleExpenseDelete(activeLedgerRecord, event)}
                disabled={saving || loading}
              >
                <AppIcon icon={faTrash} /> Archive
              </button>
            ) : null}
            <button type="button" className="admin-secondary" onClick={closeLedgerEditor}>
              Cancel
            </button>
            <button type="submit" className="admin-primary" disabled={saving || loading}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
