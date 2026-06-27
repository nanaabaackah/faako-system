import { Router } from "express";
import { asyncRoute } from "../apiResponse.js";
import { requireAdminRole, requireSiteUser } from "../adminAuth.js";
import { tryLinkCustomerForOrder } from "../customerAccounts/routes.js";
import {
  prepareCommerceOrder,
  toPublicCommerceOrder,
  validateCommerceOrderPaymentReadiness,
} from "../orders.js";
import {
  PAYMENT_STATUSES,
  buildOrderPaymentAmount,
  buildPaystackReference,
  initializePaystackTransaction,
  mapPaystackStatus,
  toSafePaystackMetadata,
  verifyPaystackTransaction,
} from "../paystack.js";
import { ensureReceiptForOrder, sendReceiptForPaidOrder } from "../receipts/service.js";

const ORDER_STATUSES = new Set([
  "PENDING",
  "PAYMENT_PENDING",
  "PAID",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
]);

const sanitizeText = (value = "", maxLength = 160) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const toMoneyNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
};

const toAdminOrder = (order) => ({
  ...toPublicCommerceOrder(order),
  status: String(order.status || "PAYMENT_PENDING").toLowerCase(),
  customer: {
    name: order.customerName,
    email: order.customerEmail,
    phone: order.customerPhone,
    preferredContactMethod: order.preferredContactMethod || "email",
    businessName: order.businessName || "",
    deliveryAddress: order.deliveryAddress,
    deliveryNotes: order.deliveryNotes || "",
  },
  source: order.source || "checkout",
  paymentProvider: order.paymentProvider || "paystack",
  fulfillmentStatus: order.fulfillmentStatus || "",
  deliveryMethod: order.deliveryMethod || "",
  expectedDeliveryDate:
    order.expectedDeliveryDate instanceof Date
      ? order.expectedDeliveryDate.toISOString()
      : order.expectedDeliveryDate || "",
  adminDeliveryNotes: order.adminDeliveryNotes || "",
  internalNotes: order.internalNotes || "",
  updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : order.updatedAt,
  paymentInitializedAt:
    order.paymentInitializedAt instanceof Date
      ? order.paymentInitializedAt.toISOString()
      : order.paymentInitializedAt || "",
  paymentVerifiedAt:
    order.paymentVerifiedAt instanceof Date
      ? order.paymentVerifiedAt.toISOString()
      : order.paymentVerifiedAt || "",
});

const buildOrderSummary = (orders) => {
  const summary = {
    totalOrders: orders.length,
    totalValue: 0,
    paidValue: 0,
    outstandingValue: 0,
    paidOrders: 0,
    pendingPaymentOrders: 0,
    failedPaymentOrders: 0,
    completedOrders: 0,
  };

  orders.forEach((order) => {
    const value = toMoneyNumber(order.total);
    const paymentStatus = String(order.paymentStatus || "").toLowerCase();
    const status = String(order.status || "").toUpperCase();

    summary.totalValue += value;
    if (paymentStatus === PAYMENT_STATUSES.PAID || status === "PAID" || order.paidAt) {
      summary.paidOrders += 1;
      summary.paidValue += value;
    } else {
      summary.outstandingValue += value;
    }
    if ([PAYMENT_STATUSES.PAYMENT_PENDING, "not_started", ""].includes(paymentStatus)) {
      summary.pendingPaymentOrders += 1;
    }
    if ([PAYMENT_STATUSES.FAILED, PAYMENT_STATUSES.ABANDONED].includes(paymentStatus)) {
      summary.failedPaymentOrders += 1;
    }
    if (status === "COMPLETED") summary.completedOrders += 1;
  });

  return summary;
};

const buildListWhere = (query = {}) => {
  const where = {};
  const search = sanitizeText(query.search, 120);
  const status = sanitizeText(query.status, 40).toUpperCase();
  const paymentStatus = sanitizeText(query.paymentStatus, 40).toLowerCase();
  const fulfillmentStatus = sanitizeText(query.fulfillmentStatus, 80).toLowerCase();

  if (status && ORDER_STATUSES.has(status)) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (fulfillmentStatus) where.fulfillmentStatus = fulfillmentStatus;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
};

const parseExpectedDate = (value) => {
  const safeValue = sanitizeText(value, 40);
  if (!safeValue) return null;
  const date = new Date(safeValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const ensureAdminReceipt = async (prisma, order, options = {}) => {
  try {
    return await ensureReceiptForOrder(prisma, order, options);
  } catch (error) {
    console.warn("Stroane admin receipt creation failed", {
      orderId: order?.id,
      orderNumber: order?.orderNumber,
      error: sanitizeText(error?.message || "Unable to create receipt.", 240),
    });
    return null;
  }
};

const sendAdminPaidReceipt = async (prisma, order) => {
  try {
    return await sendReceiptForPaidOrder(prisma, order);
  } catch (error) {
    console.warn("Stroane admin receipt email failed", {
      orderId: order?.id,
      orderNumber: order?.orderNumber,
      error: sanitizeText(error?.message || "Unable to send receipt.", 240),
    });
    return null;
  }
};

export const createAdminOrderRouter = (prisma) => {
  const router = Router();

  router.use(requireSiteUser(prisma, ["ADMIN", "OWNER", "VIEWER", "CUSTOM"]));

  router.get(
    "/orders",
    asyncRoute(async (req, res) => {
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
      const orders = await prisma.commerceOrder.findMany({
        where: buildListWhere(req.query),
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      res.json({
        orders: orders.map(toAdminOrder),
        summary: buildOrderSummary(orders),
      });
    })
  );

  router.get(
    "/orders/:id",
    asyncRoute(async (req, res) => {
      const order = await prisma.commerceOrder.findUnique({
        where: { id: String(req.params.id || "") },
        include: { items: true },
      });
      if (!order) return res.status(404).json({ error: "Order not found." });
      return res.json({ order: toAdminOrder(order) });
    })
  );

  router.post(
    "/orders",
    requireAdminRole(prisma, "orders", "create"),
    asyncRoute(async (req, res) => {
      const preparedOrder = await prepareCommerceOrder(prisma, {
        ...req.body,
        source: sanitizeText(req.body?.source, 80) || "portal_manual",
      });
      const linkedCustomer = await tryLinkCustomerForOrder(prisma, preparedOrder.customer.email);

      const savedOrder = await prisma.commerceOrder.create({
        data: {
          orderNumber: preparedOrder.orderNumber,
          status: preparedOrder.status,
          customerId: linkedCustomer?.id || null,
          customerName: preparedOrder.customer.name,
          customerEmail: preparedOrder.customer.email,
          customerPhone: preparedOrder.customer.phone,
          preferredContactMethod: preparedOrder.customer.preferredContactMethod,
          businessName: preparedOrder.customer.businessName,
          deliveryAddress: preparedOrder.customer.deliveryAddress,
          deliveryPlaceId: preparedOrder.deliveryLocation?.placeId || null,
          deliveryLocationLabel: preparedOrder.deliveryLocation?.label || null,
          deliveryLocationProvider: preparedOrder.deliveryLocation?.provider || null,
          deliveryLatitude: preparedOrder.deliveryLocation?.latitude ?? null,
          deliveryLongitude: preparedOrder.deliveryLocation?.longitude ?? null,
          deliveryMapUrl: preparedOrder.deliveryLocation?.mapUrl || null,
          deliveryNotes: preparedOrder.customer.deliveryNotes,
          deliveryMethod: preparedOrder.deliveryMethod,
          expectedDeliveryDate: preparedOrder.expectedDeliveryDate,
          currency: preparedOrder.currency,
          subtotal: preparedOrder.subtotal,
          total: preparedOrder.total,
          paymentProvider: preparedOrder.paymentProvider,
          paymentReference: preparedOrder.paymentReference,
          paymentStatus: preparedOrder.paymentStatus,
          source: preparedOrder.source,
          statusUpdatedById: req.authUser?.id || null,
          statusUpdatedAt: new Date(),
          items: {
            create: preparedOrder.lines.map((line) => ({
              productSlug: line.productSlug,
              productName: line.productName,
              sku: line.sku,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
              currency: line.currency,
              snapshot: line.snapshot,
            })),
          },
        },
        include: { items: true },
      });
      await ensureAdminReceipt(prisma, savedOrder, {
        notes: "Automatically created when the manual order was submitted.",
        createdById: req.authUser?.id || null,
        createdByName: req.authUser?.username || null,
      });

      res.status(201).json({ order: toAdminOrder(savedOrder) });
    })
  );

  router.patch(
    "/orders/:id",
    requireAdminRole(prisma, "orders", "edit"),
    asyncRoute(async (req, res) => {
      const status = sanitizeText(req.body?.status, 40).toUpperCase();
      const data = {
        fulfillmentStatus: sanitizeText(req.body?.fulfillmentStatus, 80).toLowerCase() || null,
        deliveryMethod: sanitizeText(req.body?.deliveryMethod, 80) || null,
        expectedDeliveryDate: parseExpectedDate(req.body?.expectedDeliveryDate),
        adminDeliveryNotes: sanitizeText(req.body?.adminDeliveryNotes, 600) || null,
        internalNotes: sanitizeText(req.body?.internalNotes, 800) || null,
        statusUpdatedById: req.authUser?.id || null,
        statusUpdatedAt: new Date(),
      };
      if (status && ORDER_STATUSES.has(status)) data.status = status;

      const order = await prisma.commerceOrder.update({
        where: { id: String(req.params.id || "") },
        data,
        include: { items: true },
      });
      res.json({ order: toAdminOrder(order) });
    })
  );

  router.post(
    "/orders/:id/paystack/initialize",
    requireAdminRole(prisma, "orders", "edit"),
    asyncRoute(async (req, res) => {
      const order = await prisma.commerceOrder.findUnique({
        where: { id: String(req.params.id || "") },
        include: { items: true },
      });
      if (!order) return res.status(404).json({ error: "Order not found." });
      if (!["PENDING", "PAYMENT_PENDING"].includes(String(order.status || ""))) {
        return res.status(409).json({ error: "This order is not available for payment." });
      }

      await validateCommerceOrderPaymentReadiness(prisma, order);
      const initializedPayment = await initializePaystackTransaction({
        order,
        reference: buildPaystackReference(order),
      });

      const updatedOrder = await prisma.commerceOrder.update({
        where: { id: order.id },
        data: {
          status: "PAYMENT_PENDING",
          paymentProvider: "paystack",
          paymentReference: initializedPayment.reference,
          paymentStatus: PAYMENT_STATUSES.PAYMENT_PENDING,
          paymentInitializedAt: new Date(),
          paymentMetadata: {
            provider: "paystack",
            reference: initializedPayment.reference,
            amount: initializedPayment.amountMinor,
            currency: initializedPayment.currency,
            initializedAt: new Date().toISOString(),
            providerMessage: initializedPayment.providerMessage,
            testMode: initializedPayment.testMode,
          },
        },
        include: { items: true },
      });
      await ensureAdminReceipt(prisma, updatedOrder, {
        notes: "Automatically synced when Paystack payment was initialized.",
        createdById: req.authUser?.id || null,
        createdByName: req.authUser?.username || null,
      });

      res.json({
        order: toAdminOrder(updatedOrder),
        payment: {
          provider: "paystack",
          status: PAYMENT_STATUSES.PAYMENT_PENDING,
          reference: initializedPayment.reference,
          authorizationUrl: initializedPayment.authorizationUrl,
          testMode: initializedPayment.testMode,
        },
      });
    })
  );

  router.post(
    "/orders/:id/paystack/verify",
    requireAdminRole(prisma, "orders", "edit"),
    asyncRoute(async (req, res) => {
      const order = await prisma.commerceOrder.findUnique({
        where: { id: String(req.params.id || "") },
        include: { items: true },
      });
      if (!order) return res.status(404).json({ error: "Order not found." });
      const reference = sanitizeText(req.body?.reference || order.paymentReference, 120);
      if (!reference) return res.status(409).json({ error: "Order has no Paystack reference." });

      const expected = buildOrderPaymentAmount(order);
      const transaction = await verifyPaystackTransaction(reference);
      const providerPaymentStatus = mapPaystackStatus(transaction.status);
      const providerAmount = Number(transaction.amount) || 0;
      const providerCurrency = sanitizeText(transaction.currency, 12).toUpperCase();
      const amountMatches = providerAmount === expected.amountMinor;
      const currencyMatches = providerCurrency === String(expected.currency || "GHS").toUpperCase();
      const paid = providerPaymentStatus === PAYMENT_STATUSES.PAID && amountMatches && currencyMatches;
      const metadata = {
        ...toSafePaystackMetadata(transaction),
        confirmationSource: "admin_status_refresh",
        amountMatches,
        currencyMatches,
      };

      const updatedOrder = await prisma.commerceOrder.update({
        where: { id: order.id },
        data: {
          status: paid ? "PAID" : order.status,
          paymentStatus: paid ? PAYMENT_STATUSES.PAID : providerPaymentStatus,
          paymentVerifiedAt: paid ? new Date() : order.paymentVerifiedAt,
          paymentFailedAt:
            providerPaymentStatus === PAYMENT_STATUSES.FAILED ||
            providerPaymentStatus === PAYMENT_STATUSES.ABANDONED
              ? new Date()
              : order.paymentFailedAt,
          paidAt: paid ? order.paidAt || new Date() : order.paidAt,
          paymentConfirmationSource: paid ? "admin_status_refresh" : order.paymentConfirmationSource,
          paymentMetadata: metadata,
        },
        include: { items: true },
      });
      if (paid) await sendAdminPaidReceipt(prisma, updatedOrder);

      res.json({
        order: toAdminOrder(updatedOrder),
        payment: {
          provider: "paystack",
          status: updatedOrder.paymentStatus,
          reference,
          amountMatches,
          currencyMatches,
        },
      });
    })
  );

  return router;
};
