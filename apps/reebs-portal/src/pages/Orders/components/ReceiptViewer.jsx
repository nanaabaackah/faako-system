import React, { useEffect, useMemo, useState } from "react";
import {
  NOTIFICATION_CHANNELS,
  buildMailtoHref,
  buildWhatsAppHref,
  formatReceiptSummaryMessage,
  getAvailableNotificationChannels,
} from "@faako/notifications";
import { InlineNotice } from "../../../components/InlineNotice/InlineNotice";
import { reebsApiResponse } from "../../../api/client.js";
import { formatCurrencyFromCents, formatDateTime } from "../orderUi";

const buildEscPosLines = (receipt) => {
  const snapshot = receipt?.snapshot || {};
  const order = snapshot.order || {};
  const payment = snapshot.payment || {};
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  return [
    "\x1b@",
    "\x1ba\x01",
    "REEBS PARTY THEMES\n",
    `${receipt.receiptNumber || "Receipt"}\n`,
    "\x1ba\x00",
    `Order: ${order.orderNumber || receipt.orderId || "-"}\n`,
    `Paid: ${formatCurrencyFromCents(payment.amountCents || receipt.amountCents)}\n`,
    "------------------------------\n",
    ...items.map((item) => {
      const name = item.productName || item.sku || "Shop item";
      const qty = Number(item.quantity || 0);
      const total = formatCurrencyFromCents(item.total_amount || item.totalCents || 0);
      return `${name}\n  ${qty} x ${total}\n`;
    }),
    "------------------------------\n",
    `Issued: ${formatDateTime(receipt.issuedAt)}\n`,
    "\n\n\x1dV\x00",
  ];
};

export default function ReceiptViewer({ receipts = [] }) {
  const safeReceipts = Array.isArray(receipts) ? receipts : [];
  const [selectedId, setSelectedId] = useState(safeReceipts[0]?.id || "");
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!selectedId && safeReceipts[0]?.id) {
      setSelectedId(safeReceipts[0].id);
    }
  }, [safeReceipts, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setReceipt(null);
      return undefined;
    }
    const controller = new AbortController();
    const fetchReceipt = async () => {
      setLoading(true);
      setNotice(null);
      try {
        const response = await reebsApiResponse(`/api/orderReceipts?id=${encodeURIComponent(selectedId)}`, {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load receipt.");
        }
        setReceipt(payload);
      } catch (err) {
        if (err.name !== "AbortError") {
          setNotice({
            tone: "error",
            title: "Receipt unavailable",
            message: err.message || "Try opening the receipt again.",
          });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchReceipt();
    return () => controller.abort();
  }, [selectedId]);

  const snapshotItems = useMemo(() => {
    const snapshot = receipt?.snapshot || {};
    return Array.isArray(snapshot.items) ? snapshot.items : [];
  }, [receipt]);
  const receiptCustomer = useMemo(() => {
    const snapshot = receipt?.snapshot || {};
    const order = snapshot.order || {};
    const customer = snapshot.customer || order.customer || {};
    return {
      name: customer.name || customer.customerName || order.customerName || "",
      email: customer.email || customer.customerEmail || order.customerEmail || "",
      phone: customer.phone || customer.whatsapp || order.customerPhone || "",
    };
  }, [receipt]);
  const receiptShareMessage = useMemo(() => {
    if (!receipt) return "";
    const snapshot = receipt.snapshot || {};
    const order = snapshot.order || {};
    return formatReceiptSummaryMessage({
      businessName: "REEBS Party Themes",
      customerName: receiptCustomer.name,
      receiptNumber: receipt.receiptNumber || "",
      amountLabel: formatCurrencyFromCents(receipt.amountCents),
      reference: order.orderNumber || receipt.orderId || "",
      issuedAt: receipt.issuedAt ? formatDateTime(receipt.issuedAt) : "",
      supportContact: "info@reebspartythemes.com",
    });
  }, [receipt, receiptCustomer.name]);
  const receiptShareChannels = useMemo(
    () =>
      receiptShareMessage
        ? getAvailableNotificationChannels({
            email: receiptCustomer.email,
            phone: receiptCustomer.phone,
            whatsapp: receiptCustomer.phone,
          })
        : [],
    [receiptCustomer.email, receiptCustomer.phone, receiptShareMessage]
  );
  const receiptMailtoHref = useMemo(
    () =>
      buildMailtoHref({
        to: receiptCustomer.email,
        subject: receipt?.receiptNumber ? `Receipt ${receipt.receiptNumber}` : "Receipt",
        body: receiptShareMessage,
      }),
    [receipt?.receiptNumber, receiptCustomer.email, receiptShareMessage]
  );
  const receiptWhatsAppHref = useMemo(
    () =>
      buildWhatsAppHref({
        phone: receiptCustomer.phone,
        text: receiptShareMessage,
      }),
    [receiptCustomer.phone, receiptShareMessage]
  );

  const handleCopyReceiptSummary = async () => {
    if (!receiptShareMessage) return;
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setNotice({
        tone: "error",
        title: "Copy unavailable",
        message: "Copy the receipt summary manually.",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(receiptShareMessage);
      setNotice({
        tone: "success",
        title: "Receipt copied",
        message: "Customer-safe receipt summary copied.",
      });
    } catch {
      setNotice({
        tone: "error",
        title: "Copy failed",
        message: "Copy the receipt summary manually.",
      });
    }
  };

  const handleThermalPrint = async () => {
    setNotice(null);
    const qz = typeof window !== "undefined" ? window.qz : null;
    if (!qz?.websocket || !qz?.configs || !qz?.print) {
      setNotice({
        tone: "error",
        title: "QZ Tray unavailable",
        message: "Connect QZ Tray before sending thermal receipts.",
      });
      return;
    }

    try {
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }
      const printer = await qz.printers.getDefault();
      const config = qz.configs.create(printer);
      await qz.print(config, buildEscPosLines(receipt));
      setNotice({
        tone: "success",
        title: "Receipt sent",
        message: printer,
      });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Thermal print failed",
        message: err.message || "Check QZ Tray and printer connection.",
      });
    }
  };

  return (
    <section className="glass-card orders-panel orders-receipt-panel">
      <div className="orders-panel-header">
        <div>
          <h3>Receipts</h3>
          <span>{safeReceipts.length} issued</span>
        </div>
        <button
          type="button"
          className="orders-secondary"
          onClick={handleThermalPrint}
          disabled={!receipt || loading}
        >
          Thermal print
        </button>
      </div>

      {loading && <InlineNotice tone="loading" title="Loading receipt" compact />}
      {notice && (
        <InlineNotice
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
          compact
        />
      )}

      {safeReceipts.length ? (
        <div className="orders-receipt-layout">
          <div className="orders-receipt-list">
            {safeReceipts.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`bubble-card orders-receipt-row ${String(selectedId) === String(item.id) ? "is-active" : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                <strong>{item.receiptNumber}</strong>
                <span>{formatCurrencyFromCents(item.amountCents)}</span>
                <time>{formatDateTime(item.issuedAt)}</time>
              </button>
            ))}
          </div>
          <div className="glass-card orders-receipt-preview">
            {receipt ? (
              <>
                <div className="orders-receipt-preview-head">
                  <strong>{receipt.receiptNumber}</strong>
                  <span>{formatCurrencyFromCents(receipt.amountCents)}</span>
                </div>
                <p>Issued {formatDateTime(receipt.issuedAt)}</p>
                {receipt.pdfDocumentId && <p>Document #{receipt.pdfDocumentId}</p>}
                <div className="orders-receipt-items">
                  {snapshotItems.map((item) => (
                    <div key={item.id || `${item.productId}-${item.variantId}`}>
                      <span>{item.productName || item.sku || "Shop item"}</span>
                      <strong>{formatCurrencyFromCents(item.total_amount || item.totalCents || 0)}</strong>
                    </div>
                  ))}
                </div>
                <div className="orders-detail-header-actions" style={{ marginTop: "1rem" }}>
                  {receiptShareChannels.includes(NOTIFICATION_CHANNELS.COPY) ? (
                    <button
                      type="button"
                      className="orders-secondary"
                      onClick={handleCopyReceiptSummary}
                    >
                      Copy summary
                    </button>
                  ) : null}
                  {receiptShareChannels.includes(NOTIFICATION_CHANNELS.EMAIL) ? (
                    <a className="orders-secondary" href={receiptMailtoHref}>
                      Email draft
                    </a>
                  ) : null}
                  {receiptShareChannels.includes(NOTIFICATION_CHANNELS.WHATSAPP) ? (
                    <a
                      className="orders-secondary"
                      href={receiptWhatsAppHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp draft
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="orders-empty">Select a receipt to preview.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="orders-empty">No receipts issued.</p>
      )}
    </section>
  );
}
