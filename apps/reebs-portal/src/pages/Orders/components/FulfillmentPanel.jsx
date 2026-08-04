import React, { useEffect, useState } from "react";
import { SelectField } from "@faako/ui";
import { InlineNotice } from "../../../components/InlineNotice/InlineNotice";
import { reebsApiResponse } from "../../../api/client.js";
import {
  FULFILLMENT_STATUS_OPTIONS,
  formatDateTime,
  formatStatusLabel,
  getOrdersStatusClass,
} from "../orderUi";

export default function FulfillmentPanel({ order, onUpdated }) {
  const [status, setStatus] = useState(order?.fulfillmentStatus || "not_started");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setStatus(order?.fulfillmentStatus || "not_started");
  }, [order?.fulfillmentStatus]);

  const handleSave = async () => {
    if (!order?.id || status === order.fulfillmentStatus) return;
    setSaving(true);
    setNotice(null);
    const controller = new AbortController();
    try {
      const response = await reebsApiResponse("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, fulfillmentStatus: status }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update fulfillment.");
      }
      setNotice({
        tone: "success",
        title: "Fulfillment updated",
        message: formatStatusLabel(payload.fulfillmentStatus || status),
      });
      onUpdated?.(payload);
    } catch (err) {
      if (err.name !== "AbortError") {
        setNotice({
          tone: "error",
          title: "Fulfillment not updated",
          message: err.message || "Try again after checking your access.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const details =
    order?.deliveryMethod === "delivery"
      ? order?.deliveryDetails || {}
      : order?.pickupDetails || {};

  return (
    <section className="glass-card orders-panel orders-fulfillment-panel">
      <div className="orders-panel-header">
        <div>
          <h3>Fulfillment</h3>
          <span>{order?.fulfillmentMethod || order?.deliveryMethod || "Pickup"}</span>
        </div>
        <span className={`orders-status-pill orders-status-pill--compact ${getOrdersStatusClass(order?.fulfillmentStatus)}`}>
          {formatStatusLabel(order?.fulfillmentStatus, "Not Started")}
        </span>
      </div>

      {notice && (
        <InlineNotice
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
          compact
        />
      )}

      <div className="orders-fulfillment-grid">
        <div className="bubble-card orders-fulfillment-card">
          <span>Method</span>
          <strong>{order?.fulfillmentMethod || formatStatusLabel(order?.deliveryMethod, "Pickup")}</strong>
        </div>
        <div className="bubble-card orders-fulfillment-card">
          <span>Required</span>
          <strong>{order?.deliveryRequired ? "Delivery required" : "No delivery"}</strong>
        </div>
        <div className="bubble-card orders-fulfillment-card">
          <span>Expected</span>
          <strong>{formatDateTime(order?.expectedFulfillmentDate || details?.date)}</strong>
        </div>
        <div className="bubble-card orders-fulfillment-card">
          <span>Window</span>
          <strong>{details?.window || "-"}</strong>
        </div>
        {details?.address && (
          <div className="bubble-card orders-fulfillment-card orders-fulfillment-wide">
            <span>Address</span>
            <strong>{details.address}</strong>
          </div>
        )}
        {details?.notes && (
          <div className="bubble-card orders-fulfillment-card orders-fulfillment-wide">
            <span>Notes</span>
            <strong>{details.notes}</strong>
          </div>
        )}
      </div>

      <div className="orders-fulfillment-actions">
        <label className="orders-fulfillment-field">
          Fulfillment status
          <SelectField value={status} onChange={(event) => setStatus(event.target.value)}>
            {FULFILLMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </label>
        <button
          type="button"
          className="orders-primary"
          onClick={handleSave}
          disabled={saving || status === order?.fulfillmentStatus}
        >
          {saving ? "Saving..." : "Save fulfillment"}
        </button>
      </div>
    </section>
  );
}
