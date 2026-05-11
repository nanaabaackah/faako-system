import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildScopedDraftKey,
  clearLocalDraft,
  readLocalDraft,
  useOnlineStatus,
  writeLocalDraft,
} from "@faako/offline-sync";
import { SelectField } from "@faako/ui";
import { InlineNotice } from "../../../components/InlineNotice/InlineNotice";
import {
  PAYMENT_METHOD_OPTIONS,
  formatCurrencyFromCents,
  formatDateTime,
  getPaymentMethodLabel,
  majorToCents,
} from "../orderUi";

const initialForm = {
  amount: "",
  method: "cash",
  provider: "",
  transactionReference: "",
  phoneNumber: "",
  notes: "",
};

const hasPaymentDraft = (form) =>
  Boolean(
    String(form.amount || "").trim() ||
      String(form.provider || "").trim() ||
      String(form.transactionReference || "").trim() ||
      String(form.phoneNumber || "").trim() ||
      String(form.notes || "").trim() ||
      (form.method || "cash") !== "cash"
  );

const sanitizePaymentDraft = (value) => ({
  amount: String(value?.amount || "").slice(0, 32),
  method: ["cash", "mobile_money", "bank_transfer", "card", "other"].includes(value?.method)
    ? value.method
    : "cash",
  provider: String(value?.provider || "").slice(0, 80),
  transactionReference: String(value?.transactionReference || "").slice(0, 120),
  phoneNumber: String(value?.phoneNumber || "").slice(0, 40),
  notes: String(value?.notes || "").slice(0, 240),
});

export default function PaymentLedger({
  order,
  payments = [],
  loading = false,
  error = "",
  onRecordPayment,
  onPaymentSaved,
  draftScope = {},
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [draftNotice, setDraftNotice] = useState(null);
  const restoredDraftKeyRef = useRef("");
  const draftWriteTimerRef = useRef(null);
  const draftRestoreSkipWriteRef = useRef(false);
  const isOnline = useOnlineStatus();

  const draftStorageKey = useMemo(
    () =>
      buildScopedDraftKey({
        sourceApp: "reebs-portal",
        organizationId: draftScope.organizationId,
        actorId: draftScope.actorId,
        draftType: "manual-payment",
        recordId: order?.id,
      }),
    [draftScope.actorId, draftScope.organizationId, order?.id]
  );

  const successfulTotalCents = useMemo(() => {
    return payments.reduce((sum, payment) => {
      const status = String(payment.status || "successful").toLowerCase();
      if (!["successful", "confirmed", "paid"].includes(status)) return sum;
      return sum + Number(payment.amountCents || 0);
    }, 0);
  }, [payments]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const clearPaymentDraft = () => {
    clearLocalDraft(draftStorageKey);
    setDraftNotice(null);
  };

  const resetForm = ({ clearDraft = true } = {}) => {
    setForm(initialForm);
    setNotice(null);
    if (clearDraft) clearPaymentDraft();
  };

  useEffect(() => {
    if (!draftStorageKey || restoredDraftKeyRef.current === draftStorageKey) return;
    const draft = readLocalDraft(draftStorageKey);
    if (draft?.data) {
      setForm(sanitizePaymentDraft(draft.data));
      setDrawerOpen(true);
      setNotice(null);
      setDraftNotice({
        type: "restored",
        savedAt: draft.savedAt || "",
      });
      draftRestoreSkipWriteRef.current = true;
    }
    restoredDraftKeyRef.current = draftStorageKey;
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey || restoredDraftKeyRef.current !== draftStorageKey) return undefined;
    if (draftRestoreSkipWriteRef.current) {
      draftRestoreSkipWriteRef.current = false;
      return undefined;
    }
    if (draftWriteTimerRef.current) clearTimeout(draftWriteTimerRef.current);

    draftWriteTimerRef.current = setTimeout(() => {
      if (drawerOpen && hasPaymentDraft(form)) {
        const saved = writeLocalDraft(draftStorageKey, sanitizePaymentDraft(form), {
          metadata: {
            sourceApp: "reebs-portal",
            organizationId: draftScope.organizationId,
            actorId: draftScope.actorId,
            draftType: "manual-payment",
            recordId: order?.id,
          },
        });
        if (saved) {
          setDraftNotice({
            type: "saved",
            savedAt: saved.savedAt || "",
          });
        }
      } else if (!drawerOpen || !hasPaymentDraft(form)) {
        clearPaymentDraft();
      }
    }, 250);

    return () => clearTimeout(draftWriteTimerRef.current);
  }, [
    draftScope.actorId,
    draftScope.organizationId,
    draftStorageKey,
    drawerOpen,
    form,
    order?.id,
  ]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice(null);
    const amountCents = majorToCents(form.amount);
    if (amountCents <= 0) {
      setNotice({
        tone: "error",
        title: "Payment amount required",
        message: "Enter an amount greater than zero.",
      });
      return;
    }

    setSaving(true);
    try {
      const result = await onRecordPayment({
        amountCents,
        method: form.method,
        provider: form.provider || null,
        transactionReference: form.transactionReference || null,
        phoneNumber: form.phoneNumber || null,
        notes: form.notes || null,
      });
      resetForm();
      setDrawerOpen(false);
      setNotice({
        tone: "success",
        title: "Payment recorded",
        message: `Receipt ${result?.receipt?.receiptNumber || ""} is now linked to this order.`.trim(),
      });
      onPaymentSaved?.(result);
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Payment not recorded",
        message: err.message || "Try again after checking the order balance.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-card orders-panel orders-payment-panel">
      <div className="orders-panel-header">
        <div>
          <h3>Payments</h3>
          <span>{formatCurrencyFromCents(successfulTotalCents)} recorded</span>
        </div>
        <button
          type="button"
          className="orders-primary"
          onClick={() => {
            setDrawerOpen((prev) => !prev);
            setNotice(null);
          }}
          disabled={!order?.id || saving}
        >
          {drawerOpen ? "Close" : "+ Payment"}
        </button>
      </div>

      {loading && <InlineNotice tone="loading" title="Loading payments" compact />}
      {error && <InlineNotice tone="error" title="Payments unavailable" message={error} compact />}
      {notice && (
        <InlineNotice
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
          compact
        />
      )}
      {draftNotice && drawerOpen && (
        <InlineNotice
          tone={draftNotice.type === "saved" && isOnline ? "success" : "info"}
          title={
            draftNotice.type === "restored"
              ? "Unsaved local draft restored"
              : isOnline
                ? "Draft saved locally"
                : "Offline"
          }
          message={
            draftNotice.type === "restored"
              ? "Review the payment draft before submitting. The server will still validate the final payment."
              : isOnline
                ? "Online - ready to submit. Final payment and receipt records are still created by the server."
                : "Payment draft saved locally. Submit only after the connection is stable."
          }
          compact
        />
      )}

      {drawerOpen && (
        <form className="glass-card orders-payment-drawer" onSubmit={handleSubmit}>
          <label className="orders-payment-field">
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateField("amount", event.target.value)}
              required
            />
          </label>
          <label className="orders-payment-field">
            Method
            <SelectField
              value={form.method}
              onChange={(event) => updateField("method", event.target.value)}
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </label>
          {form.method === "mobile_money" && (
            <>
              <label className="orders-payment-field">
                Provider
                <input
                  value={form.provider}
                  onChange={(event) => updateField("provider", event.target.value)}
                  placeholder="MTN, Telecel, AT"
                />
              </label>
              <label className="orders-payment-field">
                MoMo phone
                <input
                  value={form.phoneNumber}
                  onChange={(event) => updateField("phoneNumber", event.target.value)}
                />
              </label>
            </>
          )}
          <label className="orders-payment-field">
            Reference
            <input
              value={form.transactionReference}
              onChange={(event) => updateField("transactionReference", event.target.value)}
            />
          </label>
          <label className="orders-payment-field orders-payment-field--wide">
            Notes
            <textarea
              rows="3"
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </label>
          <div className="orders-payment-actions">
            <button type="submit" className="orders-primary" disabled={saving}>
              {saving ? "Saving..." : "Save payment"}
            </button>
            <button
              type="button"
              className="orders-secondary"
              onClick={() => {
                resetForm();
                setDrawerOpen(false);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="orders-payment-list">
        {payments.length ? (
          payments.map((payment) => (
            <article key={payment.id} className="bubble-card orders-payment-card">
              <div>
                <strong>{formatCurrencyFromCents(payment.amountCents)}</strong>
                <span>{getPaymentMethodLabel(payment.method)}</span>
              </div>
              <div>
                <span className={`orders-status-pill orders-status-pill--compact completed`}>
                  {payment.status || "successful"}
                </span>
                <time>{formatDateTime(payment.paidAt)}</time>
              </div>
            </article>
          ))
        ) : (
          !loading && <p className="orders-empty">No payments recorded.</p>
        )}
      </div>
    </section>
  );
}
