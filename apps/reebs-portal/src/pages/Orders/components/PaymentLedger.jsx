import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SYNC_STATES,
  buildScopedDraftKey,
  clearLocalDraft,
  createIndexedDbQueueStorage,
  incrementRetryMetadata,
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
import {
  buildQueuedOrderPayment,
  getManualPaymentFailureState,
  getQueuedPaymentNotice,
  isQueuedOrderPaymentForScope,
} from "../offlineManualPaymentQueue";

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
  const [paymentQueueNotice, setPaymentQueueNotice] = useState(null);
  const restoredDraftKeyRef = useRef("");
  const draftWriteTimerRef = useRef(null);
  const draftRestoreSkipWriteRef = useRef(false);
  const paymentQueueSyncingRef = useRef(false);
  const isOnline = useOnlineStatus();
  const paymentQueueStorage = useMemo(() => createIndexedDbQueueStorage(), []);

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

  const clearPaymentDraft = useCallback(() => {
    clearLocalDraft(draftStorageKey);
    setDraftNotice(null);
  }, [draftStorageKey]);

  const resetForm = useCallback(({ clearDraft = true } = {}) => {
    setForm(initialForm);
    setNotice(null);
    if (clearDraft) clearPaymentDraft();
  }, [clearPaymentDraft]);

  const loadQueuedPayments = useCallback(async () => {
    if (!order?.id || !draftScope.organizationId || !draftScope.actorId) {
      setPaymentQueueNotice(null);
      return [];
    }

    try {
      const queued = (await paymentQueueStorage.list()).filter((item) =>
        isQueuedOrderPaymentForScope(item, {
          organizationId: draftScope.organizationId,
          actorId: draftScope.actorId,
          orderId: order.id,
        })
      );
      setPaymentQueueNotice(getQueuedPaymentNotice(queued));
      return queued;
    } catch (queueError) {
      setPaymentQueueNotice({
        status: SYNC_STATES.FAILED,
        tone: "error",
        title: "Sync failed",
        message: queueError.message || "Unable to read the local manual payment queue.",
      });
      return [];
    }
  }, [
    draftScope.actorId,
    draftScope.organizationId,
    order?.id,
    paymentQueueStorage,
  ]);

  const syncQueuedPayment = useCallback(async (queueItem) => {
    await paymentQueueStorage.updateStatus(queueItem.id, SYNC_STATES.SYNCING, {
      lastAttemptAt: new Date().toISOString(),
    });
    setPaymentQueueNotice({
      status: SYNC_STATES.SYNCING,
      tone: "loading",
      title: "Syncing",
      message: "Submitting queued manual payment. The server will validate the order, balance, receipt, and permissions.",
    });

    try {
      const result = await onRecordPayment(queueItem.payload?.payment || {});
      await paymentQueueStorage.remove(queueItem.id);
      clearPaymentDraft();
      const receiptNumber = result?.receipt?.receiptNumber || "";
      setPaymentQueueNotice({
        status: SYNC_STATES.SYNCED,
        tone: "success",
        title: "Synced",
        message: receiptNumber
          ? `Queued manual payment synced. Final receipt ${receiptNumber} was created by the server.`
          : "Queued manual payment synced. Final records were created by the server.",
      });
      setNotice({
        tone: "success",
        title: "Payment synced",
        message: receiptNumber
          ? `Receipt ${receiptNumber} is now linked to this order.`
          : "Queued manual payment is now linked to this order.",
      });
      onPaymentSaved?.(result);
      return result;
    } catch (queueError) {
      const message = queueError.message || "Queued manual payment could not sync.";
      const failureState = getManualPaymentFailureState(message);
      await paymentQueueStorage.updateStatus(queueItem.id, failureState.status, {
        conflictStatus: failureState.conflictStatus,
        retry: incrementRetryMetadata(queueItem.retry, {
          now: new Date(),
          lastError: message,
        }),
        lastAttemptAt: new Date().toISOString(),
      });
      setPaymentQueueNotice({
        status: failureState.status,
        tone: "error",
        title: failureState.status === SYNC_STATES.NEEDS_REVIEW ? "Needs review" : "Sync failed",
        message:
          failureState.status === SYNC_STATES.NEEDS_REVIEW
            ? `${message} Review before retrying to avoid duplicate or invalid payment records.`
            : message,
      });
      return null;
    }
  }, [
    clearPaymentDraft,
    onPaymentSaved,
    onRecordPayment,
    paymentQueueStorage,
  ]);

  const syncQueuedPayments = useCallback(async () => {
    if (!isOnline || paymentQueueSyncingRef.current || !order?.id) return;
    paymentQueueSyncingRef.current = true;
    try {
      const queued = await loadQueuedPayments();
      const pending = queued.filter((item) => item.status === SYNC_STATES.PENDING);
      for (const queueItem of pending) {
        await syncQueuedPayment(queueItem);
      }
      await loadQueuedPayments();
    } finally {
      paymentQueueSyncingRef.current = false;
    }
  }, [isOnline, loadQueuedPayments, order?.id, syncQueuedPayment]);

  const queueOfflinePayment = useCallback(async (paymentPayload) => {
    if (!order?.id || !draftScope.organizationId || !draftScope.actorId) {
      setNotice({
        tone: "error",
        title: "Payment not queued",
        message: "Sign in again before saving an offline payment.",
      });
      return false;
    }

    await paymentQueueStorage.put(
      buildQueuedOrderPayment({
        organizationId: draftScope.organizationId,
        actorId: draftScope.actorId,
        order,
        payment: paymentPayload,
        source: "order-detail-payment-ledger",
      })
    );
    clearPaymentDraft();
    setForm(initialForm);
    setDrawerOpen(false);
    setNotice({
      tone: "success",
      title: "Offline payment saved",
      message: "Pending sync. No final receipt number has been generated.",
    });
    await loadQueuedPayments();
    return true;
  }, [
    clearPaymentDraft,
    draftScope.actorId,
    draftScope.organizationId,
    loadQueuedPayments,
    order,
    paymentQueueStorage,
  ]);

  useEffect(() => {
    loadQueuedPayments();
  }, [loadQueuedPayments]);

  useEffect(() => {
    if (isOnline) {
      syncQueuedPayments();
    }
  }, [isOnline, syncQueuedPayments]);

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
    clearPaymentDraft,
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

    const paymentPayload = {
      amountCents,
      method: form.method,
      provider: form.provider || null,
      transactionReference: form.transactionReference || null,
      phoneNumber: form.phoneNumber || null,
      notes: form.notes || null,
    };

    setSaving(true);
    try {
      if (!isOnline) {
        await queueOfflinePayment(paymentPayload);
        return;
      }

      const result = await onRecordPayment(paymentPayload);
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
      {paymentQueueNotice && (
        <InlineNotice
          tone={paymentQueueNotice.tone}
          title={paymentQueueNotice.title}
          message={paymentQueueNotice.message}
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
              {saving ? "Saving..." : isOnline ? "Save payment" : "Save offline payment"}
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
