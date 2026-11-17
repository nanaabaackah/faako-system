import { useEffect, useState } from "react";
import { getWaterCustomer } from "../../../api/waterCustomers.js";
import { DateField, InlineNotice, SelectField, useERPDialog } from "@faako/ui";
import PortalAction from "../../../components/PortalAction.jsx";
import { faFloppyDisk, faMoneyCheckDollar, faXmark } from "../../../icons/iconSet.js";

export default function WaterCollectionModal({ sale, collections, onClose, onSubmit, onApplyCredit, onCorrect, onReconcileLegacy, canReconcilePayments = false, saving, error, formatCurrency }) {
  const [form, setForm] = useState({ amount: "", method: "cash", transactionReference: "", paidAt: new Date().toISOString().slice(0, 10), notes: "" });
  const [retainCustomerCredit, setRetainCustomerCredit] = useState(false);
  const [applyExistingCredit, setApplyExistingCredit] = useState(false);
  const [correction, setCorrection] = useState(null);
  const [correctionCredit, setCorrectionCredit] = useState(false);
  const [legacy, setLegacy] = useState({
    mode: "confirm", amount: (Number(sale.totalAmount) / 100).toFixed(2),
    method: "cash", transactionReference: "", paidAt: new Date().toISOString().slice(0, 10),
    reason: "", notes: "",
  });
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
  const updateCorrection = (key, value) => setCorrection((current) => current ? { ...current, [key]: value } : null);
  const openCorrection = (entry) => {
    setCorrection({
      paymentId: entry.id, mode: "replace",
      amount: ((Number(entry.cashReceivedCents) || Number(entry.amountCents)) / 100).toFixed(2),
      method: String(entry.method || "cash").toLowerCase().replace("mobile money", "momo"),
      transactionReference: entry.providerReference || "",
      paidAt: String(entry.paidAt || "").slice(0, 10),
      notes: entry.notes || "", reason: "",
    });
    setCorrectionCredit(false);
  };
  const correctedPayment = collections.find((entry) => correction && Number(entry.id) === Number(correction.paymentId));
  const correctionAvailableCents = Number(sale.balanceDueCents || 0) + Number(correctedPayment?.amountCents || 0);
  const replacementExcess = correction
    ? Math.max(0, Math.round(Number(correction.amount || 0) * 100) - correctionAvailableCents)
    : 0;
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
        {sale.legacyPaymentCompatibility ? <>
          <InlineNotice tone="info" title="Legacy paid record" message="This older order is marked paid without a verified collection record. An owner or admin must verify the actual amount received before it can accept further collections." />
          {canReconcilePayments && <form className="water-module-form water-order-modal-form" onSubmit={(event) => { event.preventDefault(); if (!saving) onReconcileLegacy({ ...legacy, saleId: sale.id }); }}>
            <h3>Reconcile legacy payment</h3>
            <div className="water-order-modal-grid">
              <label>Reconciliation outcome<SelectField ariaLabel="Legacy reconciliation outcome" value={legacy.mode} onChangeValue={(value) => setLegacy((prev) => ({ ...prev, mode: String(value) }))}>
                <option value="confirm">Confirm money received</option><option value="unpaid">Correct to unpaid (no receipt)</option>
              </SelectField></label>
              {legacy.mode === "confirm" && <>
                <label>Amount received (GHS)<input type="number" required min="0.01" step="0.01" value={legacy.amount} onChange={(event) => setLegacy((prev) => ({ ...prev, amount: event.target.value }))} /></label>
                <label>Method<SelectField ariaLabel="Legacy collection method" value={legacy.method} onChangeValue={(value) => setLegacy((prev) => ({ ...prev, method: String(value) }))}>
                  <option value="cash">Cash</option><option value="momo">Manual Mobile Money</option><option value="bank transfer">Bank transfer</option><option value="card">Card</option>
                </SelectField></label>
                <label>Collected on<DateField ariaLabel="Legacy collection date" value={legacy.paidAt} onChangeValue={(value) => setLegacy((prev) => ({ ...prev, paidAt: value }))} required /></label>
                <label>Transaction reference<input required={legacy.method !== "cash"} value={legacy.transactionReference} onChange={(event) => setLegacy((prev) => ({ ...prev, transactionReference: event.target.value }))} /></label>
              </>}
              <label className="water-order-modal-field--wide">Reason for reconciliation<textarea rows={2} required minLength={5} maxLength={500} value={legacy.reason} onChange={(event) => setLegacy((prev) => ({ ...prev, reason: event.target.value }))} /></label>
            </div>
            {error ? <InlineNotice tone="error" title="Reconciliation not saved" message={error} /> : null}
            <PortalAction type="submit" icon={faFloppyDisk} className="admin-primary" label={saving ? "Saving…" : "Save reconciliation"} disabled={saving} />
          </form>}
        </> : (
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
        {sale.customerId && !sale.legacyPaymentCompatibility && <section className="water-apply-credit-section" aria-label="Apply customer credit">
          <h3>Customer Water credit</h3>
          {creditError ? <p role="alert">{creditError}</p> : availableCredit === null ? <p role="status">Loading customer credit…</p> : <>
            <p>{formatCurrency(availableCredit)} available across Water products. Applying it records no new money received.</p>
            {availableCredit > 0 && sale.balanceDueCents > 0 && <form className="water-module-form water-apply-credit-form" onSubmit={(event) => {
              event.preventDefault();
              if (!saving && applyExistingCredit && creditAmountCents > 0) {
                onApplyCredit({ saleId: sale.id, amount: (creditAmountCents / 100).toFixed(2) });
              }
            }}>
              <label className="water-credit-checkbox">
                <input type="checkbox" checked={applyExistingCredit} disabled={saving || creditAmountCents <= 0} onChange={(event) => setApplyExistingCredit(event.target.checked)} />
                Apply {formatCurrency(creditAmountCents)} of this customer's available credit to Sale #{sale.id}
              </label>
              <p>{formatCurrency(creditAmountCents)} will be applied to this order only if selected. Any remaining credit stays available for future orders.</p>
              <PortalAction type="submit" className="admin-primary water-credit-apply-action" icon={faMoneyCheckDollar} label={saving ? "Applying credit…" : "Apply customer credit"} disabled={saving || creditAmountCents <= 0 || !applyExistingCredit} />
            </form>}
          </>}
        </section>}
        <section aria-label="Collection history">
          <h3>Collection history</h3>
          {collections.length ? <ul>{collections.map((entry) => <li key={entry.applicationId}>
            {String(entry.isCreditApplication ? entry.appliedAt : entry.paidAt).slice(0, 10)} · {entry.isCreditApplication ? "Customer credit" : entry.method} · {formatCurrency(entry.amountCents)} · {entry.applicationStatus} · {entry.providerReference || entry.reference}
            {!entry.isCreditApplication && entry.cashReceivedCents > entry.amountCents ? ` · ${formatCurrency(entry.cashReceivedCents)} received; excess retained as Water credit` : ""}
            {entry.correctionReason ? ` · Corrected: ${entry.correctionReason}` : ""}
            {canReconcilePayments && !entry.isCreditApplication && entry.applicationStatus === "APPLIED"
              && !entry.supersededAt && entry.source === "MANUAL" && entry.verificationStatus === "MANUAL"
              && <PortalAction label="Correct payment" onClick={() => openCorrection(entry)} disabled={saving} />}
          </li>)}</ul> : <p>No verified collections recorded.</p>}
        </section>
        {canReconcilePayments && correction && <form className="water-module-form water-order-modal-form" aria-label="Correct recorded payment" onSubmit={(event) => {
          event.preventDefault();
          if (!saving) onCorrect({ ...correction, saleId: sale.id, retainCustomerCredit: correctionCredit });
        }}>
          <h3>Correct recorded payment</h3>
          <p className="admin-modal-meta">The original receipt will remain in the history. Reversing a recorded entry does not initiate a refund.</p>
          <div className="water-order-modal-grid">
            <label>Correction<SelectField ariaLabel="Payment correction type" value={correction.mode} onChangeValue={(value) => updateCorrection("mode", String(value))}>
              <option value="replace">Replace with corrected details</option><option value="reverse">Reverse incorrect entry</option>
            </SelectField></label>
            {correction.mode === "replace" && <>
              <label>Corrected amount (GHS)<input type="number" min="0.01" step="0.01" required value={correction.amount} onChange={(event) => { updateCorrection("amount", event.target.value); setCorrectionCredit(false); }} /></label>
              <label>Method<SelectField ariaLabel="Corrected collection method" value={correction.method} onChangeValue={(value) => updateCorrection("method", String(value))}>
                <option value="cash">Cash</option><option value="momo">Manual Mobile Money</option><option value="bank transfer">Bank transfer</option><option value="card">Card</option>
              </SelectField></label>
              <label>Collected on<DateField ariaLabel="Corrected collection date" value={correction.paidAt} onChangeValue={(value) => updateCorrection("paidAt", value)} required /></label>
              <label>Transaction reference<input value={correction.transactionReference} required={correction.method !== "cash"} onChange={(event) => updateCorrection("transactionReference", event.target.value)} maxLength={160} /></label>
              <label>Notes<textarea rows={2} maxLength={500} value={correction.notes} onChange={(event) => updateCorrection("notes", event.target.value)} /></label>
            </>}
            <label className="water-order-modal-field--wide">Reason for correction<textarea rows={2} minLength={5} maxLength={500} required value={correction.reason} onChange={(event) => updateCorrection("reason", event.target.value)} /></label>
          </div>
          {correction.mode === "replace" && replacementExcess > 0 && <label className="water-credit-checkbox">
            <input type="checkbox" checked={correctionCredit} disabled={!sale.customerId || saving} onChange={(event) => setCorrectionCredit(event.target.checked)} />
            Retain {formatCurrency(replacementExcess)} as Water customer credit. Existing collections will be checked before posting.
          </label>}
          {error ? <InlineNotice tone="error" title="Correction not saved" message={error} /> : null}
          <div className="water-order-modal-actions">
            <PortalAction label="Cancel correction" icon={faXmark} disabled={saving} onClick={() => setCorrection(null)} />
            <PortalAction type="submit" icon={faFloppyDisk} className="admin-primary" label={saving ? "Saving…" : "Save correction"} disabled={saving || (correction.mode === "replace" && replacementExcess > 0 && !correctionCredit)} />
          </div>
        </form>}
        </div>
      </div>
    </div>
  );
}
