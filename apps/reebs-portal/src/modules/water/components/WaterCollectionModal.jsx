import { useState } from "react";
import { DateField, InlineNotice, SelectField, useERPDialog } from "@faako/ui";
import PortalAction from "../../../components/PortalAction/PortalAction";
import { faFloppyDisk, faXmark } from "../../../icons/iconSet";

export default function WaterCollectionModal({ sale, collections, onClose, onSubmit, saving, error, formatCurrency }) {
  const [form, setForm] = useState({ amount: "", method: "cash", transactionReference: "", paidAt: new Date().toISOString().slice(0, 10), notes: "" });
  const dialogRef = useERPDialog({ open: true, onClose: saving ? undefined : onClose });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const electronic = form.method !== "cash";
  return (
    <div ref={dialogRef} className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="water-collection-title" tabIndex={-1}>
      <div className="admin-modal-panel water-order-modal bubble-card">
        <header><h2 id="water-collection-title">Record collection · Sale #{sale.id}</h2>
          <PortalAction icon={faXmark} action="close" label="Close collection" onClick={onClose} disabled={saving} />
        </header>
        <div className="water-order-modal-summary">
          <div><span>Total</span><strong>{formatCurrency(sale.totalAmount)}</strong></div>
          <div><span>Collected</span><strong>{formatCurrency(sale.collectedCents)}</strong></div>
          <div><span>Balance</span><strong>{formatCurrency(sale.balanceDueCents)}</strong></div>
        </div>
        {sale.legacyPaymentCompatibility ? <InlineNotice tone="info" title="Legacy paid record" message="This sale has no verified collection history. An owner must reconcile it before another collection can be recorded." /> : (
          <form className="water-module-form water-order-modal-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, saleId: sale.id }); }}>
            <div className="water-order-modal-grid">
              <label>Amount (GHS)<input type="number" min="0.01" max={sale.balanceDueCents / 100} step="0.01" inputMode="decimal" required value={form.amount} onChange={(event) => update("amount", event.target.value)} /></label>
              <label>Method<SelectField ariaLabel="Collection method" value={form.method} onChangeValue={(value) => update("method", String(value))}>
                <option value="cash">Cash</option><option value="momo">Manual Mobile Money</option><option value="bank transfer">Bank transfer</option><option value="card">Card</option>
              </SelectField></label>
              <label>Collected on<DateField ariaLabel="Collection date" required value={form.paidAt} onChangeValue={(value) => update("paidAt", value)} /></label>
              <label>Transaction reference<input value={form.transactionReference} required={electronic} maxLength={160} onChange={(event) => update("transactionReference", event.target.value)} /></label>
              <label className="water-order-modal-field--wide">Notes<textarea rows={2} maxLength={500} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
            </div>
            <p className="admin-modal-meta">Record only money already received. This does not initiate a Mobile Money charge.</p>
            {error ? <InlineNotice tone="error" title="Collection not saved" message={error} /> : null}
            <div className="water-order-modal-actions">
              <PortalAction icon={faXmark} label="Cancel" onClick={onClose} disabled={saving} />
              <PortalAction type="submit" className="admin-primary" icon={faFloppyDisk} label={saving ? "Recording…" : "Record collection"} disabled={saving || sale.balanceDueCents <= 0} />
            </div>
          </form>
        )}
        <section aria-label="Collection history">
          <h3>Collection history</h3>
          {collections.length ? <ul>{collections.map((entry) => <li key={entry.applicationId}>
            {String(entry.paidAt).slice(0, 10)} · {entry.method} · {formatCurrency(entry.amountCents)} · {entry.providerReference || entry.reference}
          </li>)}</ul> : <p>No verified collections recorded.</p>}
        </section>
      </div>
    </div>
  );
}
