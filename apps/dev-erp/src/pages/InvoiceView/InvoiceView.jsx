import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { buildApiUrl } from "../../api-url";
import { DISPLAY_CURRENCY_CODE, formatAmountAsGhs } from "../../utils/displayCurrency";
import "./InvoiceView.css";

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatAmount = (amount, currency) => formatAmountAsGhs(amount, currency);

const STATUS_LABELS = {
  QUOTATION: "Awaiting your response",
  SENT: "Awaiting your response",
  ACCEPTED: "Accepted — thank you!",
  DECLINED: "Declined",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
  DRAFT: "Draft",
};

const publicFetch = async (path, options = {}) => {
  const url = buildApiUrl(path);
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await res.json();
  if (!res.ok) throw { status: res.status, message: body?.error || "Request failed", expired: body?.expired };
  return body;
};

const InvoiceView = () => {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | expired | error | responded
  const [errorMsg, setErrorMsg] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Invalid invoice link.");
      return;
    }

    publicFetch(`/api/invoices/view/${token}`)
      .then((payload) => {
        setInvoice(payload.invoice);
        setStatus("ready");
      })
      .catch((err) => {
        if (err.expired) {
          setStatus("expired");
        } else {
          setStatus("error");
          setErrorMsg(err.message || "Unable to load invoice.");
        }
      });
  }, [token]);

  const handleRespond = async (action) => {
    if (isActing || !token) return;
    setIsActing(true);
    setErrorMsg("");
    try {
      await publicFetch(`/api/invoices/view/${token}/${action}`, { method: "POST" });
      setInvoice((prev) => prev ? { ...prev, status: action === "accept" ? "ACCEPTED" : "DECLINED" } : prev);
      setActionMsg(
        action === "accept"
          ? "Thank you! Your quotation has been accepted. We will be in touch shortly."
          : "Noted — your quotation has been declined. Please reach out if you change your mind."
      );
      setStatus("responded");
    } catch (err) {
      if (err.expired) {
        setStatus("expired");
      } else {
        setErrorMsg(err.message || "Unable to process your response. Please try again.");
      }
    } finally {
      setIsActing(false);
    }
  };

  const canRespond = invoice && ["QUOTATION", "SENT"].includes(invoice.status);
  const orgName = invoice?.organizationName || "By Nana";
  const paidAmount = Number(invoice?.paidAmount || 0);
  const balanceDue =
    invoice?.balanceDue !== undefined
      ? Number(invoice.balanceDue)
      : Math.max(Number(invoice?.total || 0) - paidAmount, 0);

  return (
    <div className="invoice-view-page">
      <header className="invoice-view-header">
        <span className="invoice-view-brand">{orgName}</span>
      </header>

      <main className="invoice-view-main">
        {status === "loading" ? (
          <div className="invoice-view-state">
            <p className="muted">Loading your invoice…</p>
          </div>
        ) : status === "expired" ? (
          <div className="invoice-view-state">
            <h2>Link expired</h2>
            <p className="muted">
              This invoice link was valid for 72 hours and has now expired. Please contact us
              to receive a new link.
            </p>
          </div>
        ) : status === "error" ? (
          <div className="invoice-view-state">
            <h2>Invoice not found</h2>
            <p className="muted">{errorMsg || "This invoice link is invalid or has been removed."}</p>
          </div>
        ) : invoice ? (
          <div className="invoice-view-body">
            <div className="invoice-view-card">
              <div className="invoice-view-card__header">
                <div>
                  <p className="eyebrow">{invoice.status === "QUOTATION" ? "Quotation" : "Invoice"}</p>
                  <h1>{invoice.invoiceNumber}</h1>
                  <p className="muted">{STATUS_LABELS[invoice.status] || invoice.status}</p>
                </div>
                <div className="invoice-view-card__total">
                  <span className="muted">Balance due</span>
                  <strong>{formatAmount(balanceDue, invoice.currency)}</strong>
                </div>
              </div>

              {status === "responded" && actionMsg ? (
                <div className="notice is-success">{actionMsg}</div>
              ) : null}

              {errorMsg ? <div className="notice is-error">{errorMsg}</div> : null}

              <div className="invoice-view-meta">
                <div className="invoice-view-meta__col">
                  <p className="eyebrow">Bill to</p>
                  <p className="table-strong">{invoice.clientName}</p>
                  {invoice.clientAddress ? <p className="muted">{invoice.clientAddress}</p> : null}
                </div>
                <div className="invoice-view-meta__col">
                  <p className="eyebrow">Details</p>
                  <p className="muted">Issue date: {formatDate(invoice.issueDate)}</p>
                  {invoice.dueDate ? <p className="muted">Due date: {formatDate(invoice.dueDate)}</p> : null}
                  <p className="muted">Display currency: {DISPLAY_CURRENCY_CODE}</p>
                </div>
              </div>

              {invoice.lineItems?.length ? (
                <div className="invoice-view-items">
                  <p className="eyebrow">Line items</p>
                  {invoice.lineItems.map((li) => (
                    <div className="invoice-view-item" key={li.id}>
                      <div className="invoice-view-item__desc">
                        <span>{li.description}</span>
                        <span className="muted">
                          {li.quantity} × {formatAmount(li.unitPrice, invoice.currency)}
                        </span>
                      </div>
                      <strong>{formatAmount(li.amount, invoice.currency)}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="invoice-view-totals">
                <div className="invoice-view-totals__row">
                  <span>Subtotal</span>
                  <span>{formatAmount(invoice.subtotal, invoice.currency)}</span>
                </div>
                {Number(invoice.taxAmount) > 0 ? (
                  <div className="invoice-view-totals__row">
                    <span>Tax ({Number(invoice.taxRate).toFixed(2)}%)</span>
                    <span>{formatAmount(invoice.taxAmount, invoice.currency)}</span>
                  </div>
                ) : null}
                {Number(invoice.discount) > 0 ? (
                  <div className="invoice-view-totals__row">
                    <span>Discount</span>
                    <span>-{formatAmount(invoice.discount, invoice.currency)}</span>
                  </div>
                ) : null}
                <div className="invoice-view-totals__row is-total">
                  <span>Total</span>
                  <strong>{formatAmount(invoice.total, invoice.currency)}</strong>
                </div>
                <div className="invoice-view-totals__row">
                  <span>Payment received</span>
                  <strong>{formatAmount(paidAmount, invoice.currency)}</strong>
                </div>
                <div className="invoice-view-totals__row is-total">
                  <span>Balance due</span>
                  <strong>{formatAmount(balanceDue, invoice.currency)}</strong>
                </div>
              </div>

              {invoice.notes ? (
                <div className="invoice-view-notes">
                  <p className="eyebrow">Notes</p>
                  <p>{invoice.notes}</p>
                </div>
              ) : null}

              {canRespond && status !== "responded" ? (
                <div className="invoice-view-actions">
                  <p className="muted">Please review the quotation above and indicate your decision.</p>
                  <div className="invoice-view-actions__buttons">
                    <button
                      className="button button-plain"
                      type="button"
                      onClick={() => handleRespond("accept")}
                      disabled={isActing}
                    >
                      {isActing ? "Processing…" : "Accept quotation"}
                    </button>
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => handleRespond("decline")}
                      disabled={isActing}
                    >
                      Decline quotation
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>

      <footer className="invoice-view-footer">
        <p className="muted">Powered by {orgName}</p>
      </footer>
    </div>
  );
};

export default InvoiceView;
