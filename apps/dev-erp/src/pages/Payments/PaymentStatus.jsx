import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiGet } from "../../api/client";
import { buildApiUrl } from "../../api-url";
import "./payments.css";

const PaymentStatus = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState({ loading: true, error: "", payment: null });

  useEffect(() => {
    if (!token) { setState({ loading: false, error: "This payment status link is invalid.", payment: null }); return; }
    apiGet(`/api/public/payments/status/${encodeURIComponent(token)}`, { fallbackMessage: "Unable to verify this payment" })
      .then((payment) => setState({ loading: false, error: "", payment }))
      .catch((error) => setState({ loading: false, error: error.message || "Unable to verify this payment.", payment: null }));
  }, [token]);

  const success = state.payment?.status === "SUCCEEDED";
  const failed = ["FAILED", "EXPIRED", "CANCELED"].includes(state.payment?.status);
  return <main className="payment-status-page"><section className="payment-status-card">
    <p className="eyebrow">Payments By Nana</p>
    {state.loading ? <><h1>Verifying your payment…</h1><p className="muted">Please keep this page open while Paystack confirms the transaction.</p></> : null}
    {state.error ? <><h1>We could not verify this payment</h1><div className="notice is-error" role="alert">{state.error}</div><p className="muted">If you were charged, contact us with your Paystack reference. Do not pay again yet.</p></> : null}
    {state.payment ? <><div className={`payment-status-icon${success ? " is-success" : failed ? " is-failed" : ""}`} aria-hidden="true">{success ? "✓" : failed ? "!" : "…"}</div><h1>{success ? "Payment confirmed" : failed ? "Payment not completed" : "Payment is still processing"}</h1><p className="payment-status-amount">{state.payment.currency} {state.payment.amount}</p><p className="muted">{success ? "Your payment was verified securely and recorded." : failed ? "This attempt was not settled. If you were charged, contact us with your Paystack reference before trying again." : "We have not received final confirmation yet. You may refresh this page shortly."}</p>{state.payment.receiptAvailable ? <a className="button button-primary" href={buildApiUrl(`/api/public/payments/status/${encodeURIComponent(token)}/receipt`)}>Download receipt</a> : null}</> : null}
  </section></main>;
};

export default PaymentStatus;
