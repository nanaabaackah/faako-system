import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiCopy, FiCreditCard, FiMail, FiPlus, FiRefreshCw } from "react-icons/fi";
import { apiGet, apiPost } from "../../api/client";
import { buildApiUrl } from "../../api-url";
import "./payments.css";

const initialForm = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerReference: "",
  description: "",
  amount: "",
  dueDate: "",
  internalNotes: "",
};

const key = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
const money = (minor, currency = "GHS") =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency }).format(Number(minor || 0) / 100);
const date = (value) => value ? new Date(value).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" }) : "—";

const Payments = () => {
  const [payload, setPayload] = useState({ standalonePayments: [], invoicePayments: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [link, setLink] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [exceptions, setExceptions] = useState([]);

  const load = useCallback(async () => {
    setBusy("load");
    setError("");
    try {
      const [result, exceptionResult] = await Promise.all([
        apiGet("/api/payments/requests", { fallbackMessage: "Unable to load payment requests" }),
        apiGet("/api/payments/reconciliation-exceptions", { fallbackMessage: "Unable to load reconciliation exceptions" }),
      ]);
      setPayload({
        standalonePayments: Array.isArray(result?.standalonePayments) ? result.standalonePayments : [],
        invoicePayments: Array.isArray(result?.invoicePayments) ? result.invoicePayments : [],
      });
      setExceptions(Array.isArray(exceptionResult?.exceptions) ? exceptionResult.exceptions : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load payment requests.");
    } finally {
      setBusy("");
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const selected = useMemo(
    () => payload.standalonePayments.find((payment) => payment.id === selectedId) || payload.standalonePayments[0] || null,
    [payload.standalonePayments, selectedId],
  );

  const run = async (name, action, success) => {
    setBusy(name); setError(""); setNotice("");
    try { const result = await action(); setNotice(success); await load(); return result; }
    catch (actionError) { setError(actionError.message || "The payment action could not be completed."); return null; }
    finally { setBusy(""); }
  };

  const createRequest = async (event) => {
    event.preventDefault();
    const result = await run("create", () => apiPost("/api/payments/standalone", form, {
      headers: { "Idempotency-Key": key("standalone-create") },
    }), "Payment request created.");
    if (result?.payment) { setSelectedId(result.payment.id); setForm(initialForm); setShowCreate(false); }
  };

  const generateLink = async () => {
    if (!selected) return;
    const result = await run("generate", () => apiPost(
      `/api/payments/standalone/${selected.id}/intents`,
      { expiresInDays: 7 },
      { headers: { "Idempotency-Key": key("standalone-payment") } },
    ), "Secure Paystack link generated.");
    if (result?.intent?.checkoutUrl) setLink(result.intent.checkoutUrl);
  };

  const activeIntent = selected?.attempts?.find((attempt) => attempt.status === "PENDING") || selected?.attempts?.[0];
  const sendLink = async () => {
    if (!activeIntent) return;
    await run("send", () => apiPost(`/api/payments/intents/${activeIntent.id}/send`, {
      recipient: selected.customerEmail,
      message: emailMessage,
    }, { headers: { "Idempotency-Key": key("payment-link-email") } }), `Payment link sent to ${selected.customerEmail}.`);
  };

  const reconcile = async () => {
    if (!selected || !invoiceId) return;
    await run("reconcile", () => apiPost(
      `/api/payments/requests/${selected.id}/reconcile-invoice`,
      { invoiceId: Number(invoiceId) },
      { headers: { "Idempotency-Key": key("payment-reconcile") } },
    ), "Payment reconciled to the invoice ledger.");
    setInvoiceId("");
  };

  const cancelRequest = async () => {
    if (!selected || !globalThis.confirm?.("Cancel this unpaid payment request? Existing attempts will remain in its history.")) return;
    await run("cancel", () => apiPost(`/api/payments/requests/${selected.id}/cancel`, {}), "Payment request canceled.");
  };

  const retryAttempt = async (attempt) => {
    const result = await run("retry", () => apiPost(
      `/api/payments/intents/${attempt.id}/retry`,
      { expiresInDays: 7 },
      { headers: { "Idempotency-Key": key("payment-retry") } },
    ), "Payment attempt retried safely.");
    if (result?.intent?.checkoutUrl) setLink(result.intent.checkoutUrl);
  };

  const sendReceipt = async (receipt) => {
    await run("receipt", () => apiPost(`/api/payments/receipts/${receipt.id}/send`, {
      recipient: selected?.customerEmail,
    }), `Receipt sent to ${selected?.customerEmail}.`);
  };

  return (
    <section className="page payments-page">
      <header className="page-header">
        <div><p className="eyebrow">Finance</p><h1>Payments</h1><p className="muted">Create secure Paystack requests, monitor settlement, and reconcile receipts.</p></div>
        <div className="header-actions">
          <button className="button button-ghost" type="button" onClick={load} disabled={busy === "load"}><FiRefreshCw aria-hidden="true" /> Refresh</button>
          <button className="button button-primary" type="button" onClick={() => setShowCreate((value) => !value)}><FiPlus aria-hidden="true" /> New payment request</button>
        </div>
      </header>
      {error ? <div className="notice is-error" role="alert">{error}</div> : null}
      {notice ? <div className="notice is-success" role="status">{notice}</div> : null}

      {showCreate ? <form className="card payment-create" onSubmit={createRequest}>
        <div><p className="eyebrow">Standalone collection</p><h2>Create payment request</h2></div>
        <div className="payment-form-grid">
          <label className="form-field"><span>Customer name</span><input className="input" required maxLength="160" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></label>
          <label className="form-field"><span>Email</span><input className="input" type="email" required value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} /></label>
          <label className="form-field"><span>Phone</span><input className="input" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} /></label>
          <label className="form-field"><span>Customer reference</span><input className="input" value={form.customerReference} onChange={(e) => setForm({ ...form, customerReference: e.target.value })} /></label>
          <label className="form-field"><span>Amount (GHS)</span><input className="input" type="number" min="1" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label className="form-field"><span>Currency</span><input className="input" value="GHS" readOnly /></label>
          <label className="form-field"><span>Due date</span><input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
        </div>
        <label className="form-field"><span>Payment purpose</span><textarea className="input" required maxLength="500" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label className="form-field"><span>Internal notes</span><textarea className="input" maxLength="1000" value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} /><small className="muted">Never shown to the customer.</small></label>
        <div className="header-actions"><button className="button button-ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary" disabled={busy === "create"}>{busy === "create" ? "Creating…" : "Create request"}</button></div>
      </form> : null}

      <div className="payments-layout">
        <section className="card payment-list" aria-label="Payment requests">
          <div className="payment-section-heading"><div><p className="eyebrow">Requests</p><h2>Standalone payments</h2></div><span className="status-pill">{payload.standalonePayments.length}</span></div>
          {busy === "load" && !payload.standalonePayments.length ? <p className="muted">Loading payment requests…</p> : null}
          {!busy && !payload.standalonePayments.length ? <div className="empty-state"><FiCreditCard size={28} aria-hidden="true" /><h3>No payment requests yet</h3><p className="muted">Create a request for a payment that is not yet tied to an invoice.</p></div> : null}
          {payload.standalonePayments.map((payment) => <button key={payment.id} className={`payment-list-item${selected?.id === payment.id ? " is-selected" : ""}`} type="button" onClick={() => { setSelectedId(payment.id); setLink(""); }}>
            <span><strong>{payment.customerName}</strong><small>{payment.description}</small></span><span><strong>{money(payment.outstandingMinor, payment.currency)}</strong><small>{payment.status.replaceAll("_", " ")}</small></span>
          </button>)}
        </section>

        <aside className="card payment-detail">
          {selected ? <>
            <div className="payment-section-heading"><div><p className="eyebrow">Payment request</p><h2>{selected.customerName}</h2><p className="muted">{selected.customerEmail}</p></div><span className={`status-pill is-${selected.status.toLowerCase()}`}>{selected.status.replaceAll("_", " ")}</span></div>
            <div className="payment-metrics"><div><span>Expected</span><strong>{money(selected.expectedMinor, selected.currency)}</strong></div><div><span>Received</span><strong>{money(selected.receivedMinor, selected.currency)}</strong></div><div><span>Outstanding</span><strong>{money(selected.outstandingMinor, selected.currency)}</strong></div></div>
            <p>{selected.description}</p><p className="muted">Due {date(selected.dueAt)}</p>
            {!["PAID", "CANCELED", "EXPIRED"].includes(selected.status) && selected.receivedMinor === 0 ? <button className="button button-ghost" type="button" onClick={cancelRequest} disabled={busy === "cancel"}>{busy === "cancel" ? "Canceling…" : "Cancel unpaid request"}</button> : null}
            {!selected.reconciledInvoiceId && !["PAID", "CANCELED", "EXPIRED"].includes(selected.status) ? <div className="payment-actions-panel"><h3>Secure payment link</h3><button className="button button-primary" type="button" onClick={generateLink} disabled={busy === "generate"}>{busy === "generate" ? "Generating…" : "Generate Paystack link"}</button>
              {(link || activeIntent?.checkoutUrl) ? <div className="payment-link"><input className="input" readOnly value={link || activeIntent.checkoutUrl} aria-label="Paystack checkout link" /><button className="button button-ghost" type="button" onClick={() => navigator.clipboard.writeText(link || activeIntent.checkoutUrl)}><FiCopy aria-hidden="true" /> Copy</button></div> : null}
              {activeIntent?.status === "PENDING" ? <><label className="form-field"><span>Optional email note</span><textarea className="input" maxLength="500" value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} /></label><button className="button button-ghost" type="button" onClick={sendLink} disabled={busy === "send"}><FiMail aria-hidden="true" /> {busy === "send" ? "Sending…" : "Send link"}</button></> : null}
            </div> : null}
            {selected.receivedMinor > 0 && !selected.reconciledInvoiceId ? <div className="payment-actions-panel"><h3>Reconcile to invoice</h3><p className="muted">This explicit action posts provider-verified settlements to the selected invoice ledger.</p><div className="payment-link"><input className="input" inputMode="numeric" placeholder="Invoice ID" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} /><button className="button button-primary" type="button" disabled={!invoiceId || busy === "reconcile"} onClick={reconcile}>Reconcile</button></div></div> : null}
            {selected.attempts?.length ? <div className="payment-timeline"><h3>Attempts</h3>{selected.attempts.map((attempt) => <div key={attempt.id} className="payment-timeline-row"><span><strong>{attempt.providerReference}</strong><small>{date(attempt.createdAt)}{attempt.providerChannel ? ` · ${attempt.providerChannel}` : ""}{attempt.linkSentAt ? ` · sent ${date(attempt.linkSentAt)}` : attempt.linkDeliveryStatus === "FAILED" ? " · email failed" : ""}</small></span><span>{money(attempt.amountMinor, attempt.currency)} · {attempt.status}{attempt.status === "FAILED" ? <button className="button button-plain" type="button" onClick={() => retryAttempt(attempt)}>Retry</button> : null}{attempt.receipt ? <span className="payment-inline-actions"><a className="button button-plain" href={buildApiUrl(`/api/payments/receipts/${attempt.receipt.id}`)}>Receipt PDF</a><button className="button button-plain" type="button" onClick={() => sendReceipt(attempt.receipt)}>Email receipt</button></span> : null}</span></div>)}</div> : null}
          </> : <div className="empty-state"><h3>Select a request</h3><p className="muted">Request details and settlement attempts appear here.</p></div>}
        </aside>
      </div>

      <section className="card invoice-attempts"><div className="payment-section-heading"><div><p className="eyebrow">Invoices</p><h2>Paystack attempts</h2></div><span className="status-pill">{payload.invoicePayments.length}</span></div>
        {payload.invoicePayments.length ? payload.invoicePayments.map((attempt) => <div className="payment-timeline-row" key={attempt.id}><span><strong>{attempt.invoice?.invoiceNumber || `Invoice ${attempt.invoiceId}`}</strong><small>{attempt.providerReference}</small></span><span>{money(attempt.amountMinor, attempt.currency)} · {attempt.status}{attempt.receipt ? <a className="button button-plain" href={buildApiUrl(`/api/payments/receipts/${attempt.receipt.id}`)}>Receipt</a> : null}</span></div>) : <p className="muted">No invoice Paystack attempts yet.</p>}
      </section>
      <section className="card invoice-attempts"><div className="payment-section-heading"><div><p className="eyebrow">Reconciliation</p><h2>Exceptions</h2></div><span className="status-pill">{exceptions.length}</span></div>
        {exceptions.length ? exceptions.map((item) => <div className="payment-timeline-row" key={item.id}><span><strong>{item.failureCategory || "Review required"}</strong><small>{item.paymentIntent?.providerReference}</small></span><span>{date(item.receivedAt)}</span></div>) : <p className="muted">No reconciliation exceptions.</p>}
      </section>
    </section>
  );
};

export default Payments;
