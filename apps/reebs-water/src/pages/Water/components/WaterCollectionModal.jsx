import { useEffect, useState } from "react";
import { getWaterCustomer } from "../../../api/waterCustomers.js";
import { DateField, InlineNotice, SelectField, useERPDialog } from "@faako/ui";
import PortalAction from "../../../components/PortalAction.jsx";
import { faFloppyDisk, faXmark } from "../../../icons/iconSet.js";

export default function WaterCollectionModal({ sale, collections, onClose, onSubmit, onApplyCredit, saving, error, formatCurrency }) {
  const [form, setForm] = useState({ amount: "", method: "cash", transactionReference: "", paidAt: new Date().toISOString().slice(0, 10), notes: "" });
  const [retainCustomerCredit, setRetainCustomerCredit] = useState(false);
  const [availableCredit, setAvailableCredit] = useState(null);
  const [creditError, setCreditError] = useState("");
  const creditAmountCents = Math.min(availableCredit || 0, Number(sale.balanceDueCents));
  const excessCents = Math.max(0, Math.round(Number(form.amount || 0) * 100) - Number(sale.balanceDueCents));
  useEffect(() => {
    if (!sale.customerId) return;
    const controller = new AbortController();
    getWaterCustomer(sale.customerId, controller.signal).then((data) => {
      if (!controller.signal.aborted) setAvailableCredit(Number(data.waterCredit?.availableCents || 0));
    }).catch(() => { if (!controller.signal.aborted) setCreditError("Customer credit could not be loaded. Reopen this dialog to retry; recording a received payment is still available."); });
    return () => controller.abort();
  }, [sale.customerId]);
  const dialogRef = useERPDialog({ open: true, onClose: saving ? undefined : onClose });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const electronic = form.method !== "cash";
  return (
    <div ref={dialogRef} className="admin-modal ui-erp-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="water-collection-title" tabIndex={-1}>
      <div className="admin-modal-panel ui-erp-modal ui-erp-modal--lg water-order-modal bubble-card">
        <header className="ui-erp-dialog__header"><h2 id="water-collection-title">Record collection · Sale #{sale.id}</h2>
          <PortalAction icon={faXmark} action="close" label="Close collection" onClick={onClose} disabled={saving} />
        </header>
        <div className="ui-erp-dialog__body">
        <div className="water-order-modal-summary">
          <div><span>Total</span><strong>{formatCurrency(sale.totalAmount)}</strong></div>
          <div><span>Collected</span><strong>{formatCurrency(sale.collectedCents)}</strong></div>
          <div><span>Balance</span><strong>{formatCurrency(sale.balanceDueCents)}</strong></div>
        </div>
        {sale.legacyPaymentCompatibility ? <InlineNotice tone="info" title="Legacy paid record" message="This sale has no verified collection history. An owner must reconcile it before another collection can be recorded." /> : (
          <form className="water-module-form water-order-modal-form" onSubmit={(event) => {
            event.preventDefault();
            if (!saving && (!excessCents || (retainCustomerCredit && sale.customerId))) onSubmit({ ...form, retainCustomerCredit, saleId: sale.id });
          }}>
            <div className="water-order-modal-grid">
              <label>Amount received (GHS)<input type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" required value={form.amount} disabled={saving} onChange={(event) => { update("amount", event.target.value); setRetainCustomerCredit(false); }} /></label>
              <label>Method<SelectField ariaLabel="Collection method" value={form.method} onChangeValue={(value) => update("method", String(value))}>
                <option value="cash">Cash</option><option value="momo">Manual Mobile Money</option><option value="bank transfer">Bank transfer</option><option value="card">Card</option>
              </SelectField></label>
              <label>Collected on<DateField ariaLabel="Collection date" required value={form.paidAt} onChangeValue={(value) => update("paidAt", value)} /></label>
              <label>Transaction reference<input value={form.transactionReference} required={electronic} maxLength={160} onChange={(event) => update("transactionReference", event.target.value)} /></label>
              <label className="water-order-modal-field--wide">Notes<textarea rows={2} maxLength={500} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
            </div>
            <p className="admin-modal-meta">Record only money already received. This does not initiate a Mobile Money charge.</p>
            {excessCents > 0 && (sale.customerId ? <div className="water-credit-confirmation">
              <p>{formatCurrency(sale.balanceDueCents)} will settle this order. {formatCurrency(excessCents)} will remain as this customer's Water credit, not extra order revenue.</p>
              <label className="water-credit-checkbox"><input type="checkbox" checked={retainCustomerCredit} disabled={saving} onChange={(event) => setRetainCustomerCredit(event.target.checked)} />Keep the excess as customer credit for future Water orders</label>
            </div> : <InlineNotice tone="error" title="Customer required" message="Select a customer on the order before recording an overpayment." />)}
            {error ? <InlineNotice tone="error" title="Collection not saved" message={error} /> : null}
            <div className="water-order-modal-actions">
              <PortalAction icon={faXmark} label="Cancel" onClick={onClose} disabled={saving} />
              <PortalAction type="submit" className="admin-primary" icon={faFloppyDisk} label={saving ? "Recording…" : "Record collection"} disabled={saving || sale.balanceDueCents <= 0 || (excessCents > 0 && (!retainCustomerCredit || !sale.customerId))} />
            </div>
          </form>
        )}
        {sale.customerId && !sale.legacyPaymentCompatibility && <section aria-label="Apply customer credit">
          <h3>Customer Water credit</h3>
          {creditError ? <p role="alert">{creditError}</p> : availableCredit === null ? <p role="status">Loading customer credit…</p> : <>
            <p>{formatCurrency(availableCredit)} available across Water products. Applying it records no new money received.</p>
            {availableCredit > 0 && sale.balanceDueCents > 0 && <form className="water-module-form" onSubmit={(event) => {
              event.preventDefault(); if (!saving) onApplyCredit({ saleId: sale.id, amount: (creditAmountCents / 100).toFixed(2) });
            }}>
              <p>{formatCurrency(creditAmountCents)} will be applied to this order. Any remaining credit stays available for future orders.</p>
              <PortalAction type="submit" icon={faFloppyDisk} label="Apply customer credit" disabled={saving || creditAmountCents <= 0} />
            </form>}
          </>}
        </section>}
        <section aria-label="Collection history">
          <h3>Collection history</h3>
          {collections.length ? <ul>{collections.map((entry) => <li key={entry.applicationId}>
            {String(entry.isCreditApplication ? entry.appliedAt : entry.paidAt).slice(0, 10)} · {entry.isCreditApplication ? "Customer credit" : entry.method} · {formatCurrency(entry.amountCents)} applied · {entry.applicationStatus} · {entry.providerReference || entry.reference}
            {!entry.isCreditApplication && entry.cashReceivedCents > entry.amountCents ? ` · ${formatCurrency(entry.cashReceivedCents)} received; excess retained as Water credit` : ""}
          </li>)}</ul> : <p>No verified collections recorded.</p>}
        </section>
        </div>
      </div>
    </div>
  );
}
