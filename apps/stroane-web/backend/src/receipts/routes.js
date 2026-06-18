import { Router } from "express";
import { asyncRoute } from "../apiResponse.js";
import { requireAdminRole, requireSiteUser } from "../adminAuth.js";
import { RECEIPT_EMAIL_STATUSES, sendReceiptEmail } from "./notifications.js";

const sanitizeText = (value = "", maxLength = 160) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const toMoneyNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
};

const toIsoString = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const escapeHtml = (value = "") =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatCurrency = (value, currency = "GHS") =>
  `${sanitizeText(currency || "GHS", 12)} ${toMoneyNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  const date = value instanceof Date ? value : new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const receiptInclude = {
  order: {
    include: {
      items: true,
    },
  },
};

const toAdminReceipt = (receipt) => ({
  id: receipt.id,
  receiptNumber: receipt.receiptNumber,
  status: receipt.status || "issued",
  orderId: receipt.orderId,
  orderNumber: receipt.order?.orderNumber || "",
  customerName: receipt.customerName || receipt.order?.customerName || "",
  customerEmail: receipt.customerEmail || receipt.order?.customerEmail || "",
  currency: receipt.currency || receipt.order?.currency || "GHS",
  subtotal: toMoneyNumber(receipt.subtotal ?? receipt.order?.subtotal),
  total: toMoneyNumber(receipt.total ?? receipt.order?.total),
  paymentReference: receipt.paymentReference || receipt.order?.paymentReference || "",
  paymentStatus: receipt.paymentStatus || receipt.order?.paymentStatus || "",
  issuedAt: toIsoString(receipt.issuedAt),
  sentAt: toIsoString(receipt.sentAt),
  downloadedAt: toIsoString(receipt.downloadedAt),
  resendStatus: receipt.resendStatus || "",
  resendProviderId: receipt.resendProviderId || "",
  resendError: receipt.resendError || "",
  notes: receipt.notes || "",
  createdByName: receipt.createdByName || "",
  createdAt: toIsoString(receipt.createdAt),
  updatedAt: toIsoString(receipt.updatedAt),
  order: receipt.order
    ? {
        id: receipt.order.id,
        orderNumber: receipt.order.orderNumber,
        status: String(receipt.order.status || "").toLowerCase(),
        paymentStatus: receipt.order.paymentStatus || "",
        fulfillmentStatus: receipt.order.fulfillmentStatus || "",
        deliveryMethod: receipt.order.deliveryMethod || "",
        customer: {
          name: receipt.order.customerName,
          email: receipt.order.customerEmail,
          phone: receipt.order.customerPhone,
          deliveryAddress: receipt.order.deliveryAddress,
        },
        items: (receipt.order.items || []).map((item) => ({
          id: item.id,
          productSlug: item.productSlug,
          productName: item.productName,
          sku: item.sku || "",
          quantity: Number(item.quantity) || 0,
          unitPrice: toMoneyNumber(item.unitPrice),
          lineTotal: toMoneyNumber(item.lineTotal),
          currency: item.currency || receipt.order.currency || "GHS",
        })),
      }
    : null,
});

const buildReceiptSummary = (receipts) => {
  const summary = {
    totalReceipts: receipts.length,
    issuedReceipts: 0,
    sentReceipts: 0,
    downloadedReceipts: 0,
    totalValue: 0,
  };

  receipts.forEach((receipt) => {
    const status = String(receipt.status || "").toLowerCase();
    if (status === "issued") summary.issuedReceipts += 1;
    if (receipt.sentAt || receipt.resendStatus === RECEIPT_EMAIL_STATUSES.SENT) {
      summary.sentReceipts += 1;
    }
    if (receipt.downloadedAt) summary.downloadedReceipts += 1;
    summary.totalValue += toMoneyNumber(receipt.total);
  });

  return summary;
};

const buildListWhere = (query = {}) => {
  const where = {};
  const search = sanitizeText(query.search, 120);
  const status = sanitizeText(query.status, 40).toLowerCase();

  if (status) where.status = status;
  if (search) {
    where.OR = [
      { receiptNumber: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
      { paymentReference: { contains: search, mode: "insensitive" } },
      {
        order: {
          orderNumber: { contains: search, mode: "insensitive" },
        },
      },
    ];
  }

  return where;
};

const buildReceiptNumberBase = (order) =>
  sanitizeText(order.orderNumber || order.id, 80)
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase() || "STROANE";

const buildUniqueReceiptNumber = async (prisma, order) => {
  const base = buildReceiptNumberBase(order);
  const existingCount = await prisma.commerceReceipt.count({
    where: { orderId: order.id },
  });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = String(existingCount + attempt + 1).padStart(2, "0");
    const receiptNumber = `RCPT-${base}-${suffix}`;
    const existing = await prisma.commerceReceipt.findUnique({
      where: { receiptNumber },
      select: { id: true },
    });
    if (!existing) return receiptNumber;
  }

  return `RCPT-${base}-${Date.now()}`;
};

const renderReceiptHtml = (receipt) => {
  const adminReceipt = toAdminReceipt(receipt);
  const items = adminReceipt.order?.items || [];
  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(item.sku || "N/A")}</td>
          <td class="right">${escapeHtml(String(item.quantity))}</td>
          <td class="right">${escapeHtml(formatCurrency(item.unitPrice, item.currency))}</td>
          <td class="right">${escapeHtml(formatCurrency(item.lineTotal, item.currency))}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(adminReceipt.receiptNumber)} - Stroane receipt</title>
    <style>
      body{margin:0;background:#f6f8fb;color:#111827;font:14px/1.55 Arial,sans-serif}
      main{width:min(820px,calc(100% - 32px));margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px}
      header{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #e5e7eb;padding-bottom:20px}
      h1{margin:0;color:#0f172a;font-size:28px}
      h2{margin:28px 0 10px;color:#0f172a;font-size:16px}
      p{margin:0;color:#475569}
      .muted{color:#64748b}
      .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}
      .summary div{border:1px solid #e5e7eb;border-radius:10px;padding:12px}
      .summary span{display:block;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase}
      .summary strong{display:block;margin-top:4px;color:#0f172a}
      table{width:100%;border-collapse:collapse}
      th,td{border-bottom:1px solid #e5e7eb;padding:10px;text-align:left;vertical-align:top}
      th{color:#64748b;font-size:11px;text-transform:uppercase}
      .right{text-align:right}
      .total{margin-top:18px;text-align:right;font-size:18px}
      @media print{body{background:#fff}main{width:auto;margin:0;border:0;border-radius:0}}
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Stroane Solutions</h1>
          <p>Food safety products and compliance support</p>
        </div>
        <div class="right">
          <strong>${escapeHtml(adminReceipt.receiptNumber)}</strong>
          <p class="muted">Issued ${escapeHtml(formatDate(adminReceipt.issuedAt))}</p>
        </div>
      </header>
      <section class="summary">
        <div><span>Order</span><strong>${escapeHtml(adminReceipt.orderNumber || "N/A")}</strong></div>
        <div><span>Customer</span><strong>${escapeHtml(adminReceipt.customerName || "N/A")}</strong></div>
        <div><span>Payment</span><strong>${escapeHtml(adminReceipt.paymentStatus || "N/A")}</strong></div>
        <div><span>Total</span><strong>${escapeHtml(formatCurrency(adminReceipt.total, adminReceipt.currency))}</strong></div>
      </section>
      <h2>Receipt items</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>SKU</th>
            <th class="right">Qty</th>
            <th class="right">Unit</th>
            <th class="right">Line total</th>
          </tr>
        </thead>
        <tbody>${itemRows || `<tr><td colspan="5">No items listed.</td></tr>`}</tbody>
      </table>
      <p class="total"><strong>Total: ${escapeHtml(formatCurrency(adminReceipt.total, adminReceipt.currency))}</strong></p>
      <h2>Customer</h2>
      <p>${escapeHtml(adminReceipt.customerEmail || "N/A")}</p>
      <p>${escapeHtml(adminReceipt.order?.customer?.phone || "N/A")}</p>
      <p>${escapeHtml(adminReceipt.order?.customer?.deliveryAddress || "N/A")}</p>
      <h2>Payment reference</h2>
      <p>${escapeHtml(adminReceipt.paymentReference || "N/A")}</p>
    </main>
  </body>
</html>`;
};

export const createAdminReceiptRouter = (prisma) => {
  const router = Router();

  router.use(requireSiteUser(prisma, ["ADMIN", "VIEWER"]));

  router.get(
    "/receipts",
    asyncRoute(async (req, res) => {
      if (!prisma.commerceReceipt?.findMany) {
        return res.status(503).json({ error: "Receipt storage is not available." });
      }

      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
      const receipts = await prisma.commerceReceipt.findMany({
        where: buildListWhere(req.query),
        include: receiptInclude,
        orderBy: { issuedAt: "desc" },
        take: limit,
      });

      res.json({
        receipts: receipts.map(toAdminReceipt),
        summary: buildReceiptSummary(receipts),
      });
    })
  );

  router.get(
    "/receipts/:id",
    asyncRoute(async (req, res) => {
      const receipt = await prisma.commerceReceipt.findUnique({
        where: { id: String(req.params.id || "") },
        include: receiptInclude,
      });
      if (!receipt) return res.status(404).json({ error: "Receipt not found." });
      return res.json({ receipt: toAdminReceipt(receipt) });
    })
  );

  router.post(
    "/receipts",
    requireAdminRole(prisma),
    asyncRoute(async (req, res) => {
      if (!prisma.commerceReceipt?.create) {
        return res.status(503).json({ error: "Receipt storage is not available." });
      }

      const orderId = sanitizeText(req.body?.orderId, 120);
      if (!orderId) return res.status(400).json({ error: "Order is required." });

      const order = await prisma.commerceOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) return res.status(404).json({ error: "Order not found." });
      if (String(order.status || "").toUpperCase() === "CANCELLED") {
        return res.status(409).json({ error: "Cancelled orders cannot receive receipts." });
      }

      const receiptNumber = await buildUniqueReceiptNumber(prisma, order);
      const receipt = await prisma.commerceReceipt.create({
        data: {
          receiptNumber,
          orderId: order.id,
          status: "issued",
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          currency: order.currency || "GHS",
          subtotal: order.subtotal,
          total: order.total,
          paymentReference: order.paymentReference || null,
          paymentStatus: order.paymentStatus || null,
          notes: sanitizeText(req.body?.notes, 600) || null,
          createdById: req.authUser?.id || null,
          createdByName: req.authUser?.username || null,
        },
        include: receiptInclude,
      });

      res.status(201).json({ receipt: toAdminReceipt(receipt) });
    })
  );

  router.get(
    "/receipts/:id/download",
    asyncRoute(async (req, res) => {
      const receipt = await prisma.commerceReceipt.findUnique({
        where: { id: String(req.params.id || "") },
        include: receiptInclude,
      });
      if (!receipt) return res.status(404).json({ error: "Receipt not found." });

      await prisma.commerceReceipt.update({
        where: { id: receipt.id },
        data: { downloadedAt: new Date() },
      });

      const filename = `${receipt.receiptNumber || "stroane-receipt"}.html`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(renderReceiptHtml(receipt));
    })
  );

  router.post(
    "/receipts/:id/resend",
    requireAdminRole(prisma),
    asyncRoute(async (req, res) => {
      const receipt = await prisma.commerceReceipt.findUnique({
        where: { id: String(req.params.id || "") },
        include: receiptInclude,
      });
      if (!receipt) return res.status(404).json({ error: "Receipt not found." });

      try {
        const result = await sendReceiptEmail({ receipt });
        const status = result.status || RECEIPT_EMAIL_STATUSES.SKIPPED;
        const updatedReceipt = await prisma.commerceReceipt.update({
          where: { id: receipt.id },
          data: {
            resendStatus: status,
            resendProviderId: result.providerId || null,
            resendError: result.reason || null,
            sentAt: result.sent ? new Date() : receipt.sentAt,
          },
          include: receiptInclude,
        });

        res.json({
          receipt: toAdminReceipt(updatedReceipt),
          notification: {
            status,
            sent: Boolean(result.sent),
            reason: result.reason || "",
          },
        });
      } catch (error) {
        const message = sanitizeText(error?.message || "Unable to resend receipt.", 240);
        const updatedReceipt = await prisma.commerceReceipt.update({
          where: { id: receipt.id },
          data: {
            resendStatus: RECEIPT_EMAIL_STATUSES.FAILED,
            resendError: message,
          },
          include: receiptInclude,
        });

        res.status(error?.statusCode || 503).json({
          error: message,
          receipt: toAdminReceipt(updatedReceipt),
        });
      }
    })
  );

  return router;
};
