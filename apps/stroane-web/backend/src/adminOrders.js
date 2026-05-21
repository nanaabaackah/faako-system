import { Router } from "express";
import { requireAdminRole, requireSiteUser } from "./adminAuth.js";

const ORDER_STATUS_FILTERS = new Set([
  "PENDING",
  "PAYMENT_PENDING",
  "PAID",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
]);

const PAYMENT_STATUSES = new Set([
  "not_started",
  "payment_pending",
  "paid",
  "failed",
  "abandoned",
]);

const ADMIN_ORDER_STATUSES = new Set([
  "paid",
  "processing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
]);

const FULFILLMENT_STATUSES = new Set([
  "not_started",
  "paid",
  "processing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
]);

const sanitizeText = (value, maxLength = 240) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const toMoneyNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
};

const normalizeLower = (value, maxLength = 80) =>
  sanitizeText(value, maxLength).toLowerCase().replace(/[\s-]+/g, "_");

const normalizeStatusFilter = (value) => {
  const normalized = normalizeLower(value, 80).toUpperCase();
  return ORDER_STATUS_FILTERS.has(normalized) ? normalized : "";
};

const normalizePaymentStatus = (value) => {
  const normalized = normalizeLower(value, 80);
  return PAYMENT_STATUSES.has(normalized) ? normalized : "";
};

const normalizeAdminOrderStatus = (value) => {
  const normalized = normalizeLower(value, 80);
  return ADMIN_ORDER_STATUSES.has(normalized) ? normalized : "";
};

const normalizeFulfillmentStatus = (value) => {
  const normalized = normalizeLower(value, 80);
  return FULFILLMENT_STATUSES.has(normalized) ? normalized : "";
};

const parseLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 50;
  return Math.max(1, Math.min(parsed, 100));
};

const parseNullableDate = (value) => {
  if (value === null || value === "") return null;
  if (value === undefined) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const getPaymentReferenceSafe = (reference = "") => {
  const safeReference = sanitizeText(reference, 120);
  if (!safeReference) return null;
  if (safeReference.length <= 12) return safeReference;
  return `${safeReference.slice(0, 6)}...${safeReference.slice(-6)}`;
};

const isPaidOrder = (order = {}) =>
  order.paymentStatus === "paid" || order.status === "PAID" || Boolean(order.paidAt);

const getFulfillmentStatus = (order = {}) => {
  const storedStatus = normalizeFulfillmentStatus(order.fulfillmentStatus);
  if (storedStatus) return storedStatus;
  if (order.status === "COMPLETED") return "completed";
  if (order.status === "PROCESSING") return "processing";
  if (order.status === "CANCELLED") return "cancelled";
  if (isPaidOrder(order)) return "paid";
  return "not_started";
};

const toIso = (value) => (value instanceof Date ? value.toISOString() : value || null);

const toOrderItem = (item) => ({
  id: item.id,
  productSlug: item.productSlug,
  productName: item.productName,
  sku: item.sku || null,
  quantity: item.quantity,
  unitPrice: toMoneyNumber(item.unitPrice),
  lineTotal: toMoneyNumber(item.lineTotal),
  currency: item.currency || "GHS",
});

const toAdminOrderSummary = (order) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  customerName: order.customerName,
  customerEmail: order.customerEmail,
  customerPhone: order.customerPhone,
  businessName: order.businessName || null,
  createdAt: toIso(order.createdAt),
  updatedAt: toIso(order.updatedAt),
  currency: order.currency || "GHS",
  total: toMoneyNumber(order.total),
  status: String(order.status || "").toLowerCase(),
  paymentStatus: order.paymentStatus || "not_started",
  fulfillmentStatus: getFulfillmentStatus(order),
  itemCount: Array.isArray(order.items)
    ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    : 0,
  paymentReferenceSafe: getPaymentReferenceSafe(order.paymentReference),
  paidAt: toIso(order.paidAt),
  expectedDeliveryDate: toIso(order.expectedDeliveryDate),
});

const toAdminOrderDetail = (order) => ({
  ...toAdminOrderSummary(order),
  customer: {
    name: order.customerName,
    email: order.customerEmail,
    phone: order.customerPhone,
    businessName: order.businessName || null,
    preferredContactMethod: order.preferredContactMethod || "email",
  },
  delivery: {
    address: order.deliveryAddress,
    customerNotes: order.deliveryNotes || null,
    method: order.deliveryMethod || null,
    adminNotes: order.adminDeliveryNotes || null,
    expectedDeliveryDate: toIso(order.expectedDeliveryDate),
  },
  payment: {
    provider: order.paymentProvider || "paystack",
    status: order.paymentStatus || "not_started",
    reference: getPaymentReferenceSafe(order.paymentReference),
    confirmationSource: order.paymentConfirmationSource || null,
    initializedAt: toIso(order.paymentInitializedAt),
    verifiedAt: toIso(order.paymentVerifiedAt),
    failedAt: toIso(order.paymentFailedAt),
    paidAt: toIso(order.paidAt),
  },
  internalNotes: order.internalNotes || null,
  statusUpdatedAt: toIso(order.statusUpdatedAt),
  statusUpdatedById: order.statusUpdatedById || null,
  items: (order.items || []).map(toOrderItem),
});

const buildOrderWhere = (query = {}) => {
  const where = {};
  const search = sanitizeText(query.search, 120);
  const status = normalizeStatusFilter(query.status);
  const paymentStatus = normalizePaymentStatus(query.paymentStatus);
  const fulfillmentStatus = normalizeFulfillmentStatus(query.fulfillmentStatus);

  if (status) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (fulfillmentStatus) where.fulfillmentStatus = fulfillmentStatus;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: search, mode: "insensitive" } },
      { businessName: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
};

const applyAdminStatusTransition = (order, status, data, now) => {
  if (!status) return;
  if (order.status === "CANCELLED" && status !== "cancelled") {
    const error = new Error("Cancelled orders cannot be moved back into fulfillment.");
    error.statusCode = 409;
    throw error;
  }

  const paid = isPaidOrder(order);
  if (status !== "cancelled" && !paid) {
    const error = new Error("Payment must be webhook-confirmed before fulfillment status changes.");
    error.statusCode = 409;
    throw error;
  }

  if (status === "paid") {
    data.status = "PAID";
    data.fulfillmentStatus = "paid";
    return;
  }

  if (status === "processing") {
    data.status = "PROCESSING";
    data.fulfillmentStatus = "processing";
    return;
  }

  if (status === "ready" || status === "out_for_delivery") {
    data.status = "PROCESSING";
    data.fulfillmentStatus = status;
    return;
  }

  if (status === "completed") {
    data.status = "COMPLETED";
    data.fulfillmentStatus = "completed";
    return;
  }

  if (status === "cancelled") {
    data.status = "CANCELLED";
    data.fulfillmentStatus = "cancelled";
    data.cancelledAt = order.cancelledAt || now;
  }
};

const buildAdminOrderUpdateData = (order, body = {}, authUser) => {
  if (Object.prototype.hasOwnProperty.call(body, "paymentStatus")) {
    const error = new Error("Payment status cannot be updated manually.");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const data = {};
  const requestedStatus = normalizeAdminOrderStatus(body.status || body.orderStatus);
  applyAdminStatusTransition(order, requestedStatus, data, now);

  if (Object.prototype.hasOwnProperty.call(body, "deliveryMethod")) {
    data.deliveryMethod = sanitizeText(body.deliveryMethod, 80) || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "expectedDeliveryDate")) {
    const date = parseNullableDate(body.expectedDeliveryDate);
    if (date === undefined) {
      const error = new Error("Expected delivery date is invalid.");
      error.statusCode = 400;
      throw error;
    }
    data.expectedDeliveryDate = date;
  }

  if (Object.prototype.hasOwnProperty.call(body, "adminDeliveryNotes")) {
    data.adminDeliveryNotes = sanitizeText(body.adminDeliveryNotes, 700) || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "internalNotes")) {
    data.internalNotes = sanitizeText(body.internalNotes, 1000) || null;
  }

  if (!Object.keys(data).length) {
    const error = new Error("No valid order update fields were provided.");
    error.statusCode = 400;
    throw error;
  }

  data.statusUpdatedAt = now;
  data.statusUpdatedById = authUser?.id || null;
  return data;
};

export const createAdminOrdersRouter = (prisma) => {
  const router = Router();

  router.use(requireSiteUser(prisma, ["ADMIN", "VIEWER"]));

  router.get("/", async (req, res) => {
    try {
      const orders = await prisma.commerceOrder.findMany({
        where: buildOrderWhere(req.query),
        include: { items: true },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: parseLimit(req.query.limit),
      });

      return res.json({
        ok: true,
        orders: orders.map(toAdminOrderSummary),
      });
    } catch (error) {
      console.error("Admin order list failed:", {
        message: error?.message || "Unknown order list error",
      });
      return res.status(503).json({ error: "Unable to load orders." });
    }
  });

  router.get("/:orderId", async (req, res) => {
    try {
      const order = await prisma.commerceOrder.findUnique({
        where: { id: String(req.params.orderId || "") },
        include: { items: true },
      });

      if (!order) return res.status(404).json({ error: "Order not found." });
      return res.json({ ok: true, order: toAdminOrderDetail(order) });
    } catch (error) {
      console.error("Admin order detail failed:", {
        message: error?.message || "Unknown order detail error",
      });
      return res.status(503).json({ error: "Unable to load order." });
    }
  });

  router.patch("/:orderId/status", requireAdminRole(prisma), async (req, res) => {
    try {
      const order = await prisma.commerceOrder.findUnique({
        where: { id: String(req.params.orderId || "") },
        include: { items: true },
      });

      if (!order) return res.status(404).json({ error: "Order not found." });

      const data = buildAdminOrderUpdateData(order, req.body, req.authUser);
      const updatedOrder = await prisma.commerceOrder.update({
        where: { id: order.id },
        data,
        include: { items: true },
      });

      console.info("Stroane admin order updated", {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        fulfillmentStatus: updatedOrder.fulfillmentStatus,
        updatedBy: req.authUser?.username,
      });

      return res.json({ ok: true, order: toAdminOrderDetail(updatedOrder) });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      console.error("Admin order update failed:", {
        message: error?.message || "Unknown order update error",
      });
      return res.status(503).json({ error: "Unable to update order." });
    }
  });

  return router;
};
