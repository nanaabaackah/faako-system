import { useEffect, useState } from "react";
import { CloseCircle, DocumentDownload, Refresh } from "iconsax-react";
import { InlineNotice, useERPDialog } from "@faako/ui";
import PortalAction from "../../../components/PortalAction.jsx";
import { getWaterCustomer, updateWaterCustomer } from "../../../api/waterCustomers.js";

const fieldsFor = (customer) => ({ name: customer.name || "", phone: customer.phone || "", email: customer.email || "" });

export default function WaterCustomerDrawer({ customerId, onClose, onSaved, formatCurrency }) {
  const [detail, setDetail] = useState(null);
  const [fields, setFields] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const dirty = detail && fields && JSON.stringify(fields) !== JSON.stringify(fieldsFor(detail.customer));
  const close = () => {
    if (!saving && (!dirty || window.confirm("Discard unsaved customer changes?"))) onClose();
  };
  const dialogRef = useERPDialog({ open: true, onClose: close });
  useEffect(() => {
    const controller = new AbortController();
    getWaterCustomer(customerId, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setDetail(data); setFields(fieldsFor(data.customer)); setError("");
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [customerId, revision]);
  const canEdit = detail?.permissions?.canEditCustomer === true;
  const totals = detail?.waterTotals;
  return <div ref={dialogRef} className="admin-modal ui-erp-dialog-backdrop water-customer-drawer" role="dialog" aria-modal="true" aria-labelledby="water-customer-title" tabIndex={-1}>
    <div className="admin-modal-panel ui-erp-modal ui-erp-modal--lg water-order-modal bubble-card">
      <header className="ui-erp-dialog__header"><h2 id="water-customer-title">{detail?.customer.name || "Customer details"}</h2>
        <PortalAction icon={CloseCircle} label="Close customer" action="close" onClick={close} disabled={saving} />
      </header>
      <div className="ui-erp-dialog__body">
        {error && <InlineNotice tone="error" title="Customer details" message={error} />}
        {!detail ? error ? <PortalAction icon={Refresh} label="Retry customer details" onClick={() => { setError(""); setRevision((value) => value + 1); }} /> : <p role="status">Loading customer details…</p> : <>
          <p className="admin-modal-meta">All Water products · all time · active orders only. No REEBS rental/event totals.</p>
          <dl className="water-order-modal-summary water-customer-stats">
            <div><dt>Orders</dt><dd>{totals.sales}</dd></div>
            <div><dt>Order value</dt><dd>{formatCurrency(totals.revenue)}</dd></div>
            <div><dt>Outstanding</dt><dd>{formatCurrency(totals.outstandingCents)}</dd></div>
            <div><dt>Available Water credit</dt><dd>{formatCurrency(detail.waterCredit?.availableCents || 0)}</dd></div>
          </dl>
          {totals.legacyPaidCents > 0 && <p className="admin-modal-meta">{formatCurrency(totals.legacyPaidCents)} marked paid on legacy orders still requires collection reconciliation.</p>}
          <form className="water-module-form water-order-modal-form" onSubmit={async (event) => {
            event.preventDefault();
            if (saving || !canEdit || !dirty) return;
            setSaving(true); setError(""); setStatus("");
            try {
              const saved = await updateWaterCustomer(customerId, fields);
              setFields(fieldsFor(saved));
              setDetail((previous) => ({ ...previous, customer: saved }));
              setStatus("Customer details saved."); onSaved();
            } catch (err) { setError(err.message); }
            finally { setSaving(false); }
          }}>
            <p className="admin-modal-meta">Contact details are shared with the REEBS customer directory. Editing them does not alter recorded order snapshots.</p>
            <div className="water-order-modal-grid">
              <label>Customer name<input required maxLength={160} value={fields.name} disabled={!canEdit || saving} onChange={(event) => setFields({ ...fields, name: event.target.value })} /></label>
              <label>Phone<input type="tel" maxLength={32} value={fields.phone} disabled={!canEdit || saving} onChange={(event) => setFields({ ...fields, phone: event.target.value })} /></label>
              <label className="water-order-modal-field--wide">Email<input type="email" maxLength={254} value={fields.email} disabled={!canEdit || saving} onChange={(event) => setFields({ ...fields, email: event.target.value })} /></label>
            </div>
            {status && <p role="status">{status}</p>}
            {canEdit ? <PortalAction type="submit" icon={DocumentDownload} label={saving ? "Saving…" : "Save customer"} disabled={saving || !dirty} /> : <p className="admin-modal-meta">You have read-only access to customer contact details.</p>}
          </form>
          <section aria-label="Recent customer orders"><h3>Recent Water orders</h3>
            {detail.waterSales.length ? <ul className="water-customer-orders">{detail.waterSales.map((sale) => <li key={sale.id}>
              <strong>#{sale.id} · {sale.productName}</strong><span>{String(sale.date).slice(0, 10)} · {sale.quantity} packs</span>
              <span>{formatCurrency(sale.totalAmount)} · {formatCurrency(sale.balanceDueCents)} outstanding</span>
            </li>)}</ul> : <p>No Water orders yet.</p>}
            <p className="admin-modal-meta">Up to 10 recent orders; summary includes all active Water orders.</p>
          </section>
        </>}
      </div>
    </div>
  </div>;
}
