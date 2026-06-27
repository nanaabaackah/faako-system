import { Router } from "express";
import { asyncRoute } from "../apiResponse.js";
import { requireSiteUser } from "../adminAuth.js";

const AUDIT_SOURCES = new Set([
  "inventory",
  "orders",
  "payments",
  "receipts",
  "accounting",
  "crm",
  "team",
]);

const RANGE_HOURS = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
  all: null,
};

const sanitizeText = (value = "", maxLength = 240) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const toIso = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const parseLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 120;
  return Math.min(parsed, 250);
};

const resolveRangeStart = (rangeInput) => {
  const range = Object.prototype.hasOwnProperty.call(RANGE_HOURS, rangeInput)
    ? rangeInput
    : "7d";
  const hours = RANGE_HOURS[range];
  if (!hours) return { range, since: null };
  return {
    range,
    since: new Date(Date.now() - hours * 60 * 60 * 1000),
  };
};

const shouldIncludeSource = (sourceFilter, source) =>
  !sourceFilter || sourceFilter === "all" || sourceFilter === source;

const formatLabel = (value = "") =>
  sanitizeText(value, 120)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const eventDateIsInRange = (createdAt, since) => {
  if (!since) return true;
  const date = new Date(createdAt || "");
  return !Number.isNaN(date.getTime()) && date >= since;
};

const createAuditEntry = ({
  id,
  source,
  category,
  action,
  severity = "info",
  status = "ok",
  summary,
  actorName = "",
  targetType = "",
  targetId = "",
  createdAt,
  metadata = {},
}) => ({
  id,
  source,
  category,
  action,
  severity,
  status,
  summary: sanitizeText(summary, 320) || formatLabel(action),
  actorName: sanitizeText(actorName, 120),
  targetType: sanitizeText(targetType, 80),
  targetId: sanitizeText(targetId, 160),
  createdAt: toIso(createdAt),
  metadata,
});

const withDateFilter = (field, since) => (since ? { [field]: { gte: since } } : {});

const collectInventoryAuditEntries = async (prisma, { limit, since, sourceFilter }) => {
  if (!shouldIncludeSource(sourceFilter, "inventory") || !prisma.inventoryAuditEntry?.findMany) {
    return [];
  }

  const rows = await prisma.inventoryAuditEntry.findMany({
    where: withDateFilter("createdAt", since),
    include: {
      inventoryItem: {
        select: {
          productSlug: true,
          sku: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      },
      supplier: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((entry) => {
    const targetId =
      entry.inventoryItem?.product?.name ||
      entry.productSlug ||
      entry.inventoryItem?.productSlug ||
      entry.supplier?.name ||
      entry.entityId ||
      "inventory record";
    return createAuditEntry({
      id: `inventory-audit:${entry.id}`,
      source: "inventory",
      category: sanitizeText(entry.entityType, 80) || "inventory",
      action: sanitizeText(entry.action, 120) || "INVENTORY_UPDATED",
      severity: /delete|archive|remove/i.test(entry.action || "") ? "warning" : "info",
      summary: `${formatLabel(entry.action)} ${formatLabel(entry.entityType)} ${targetId}`,
      actorName: entry.createdByName || "",
      targetType: entry.entityType || "inventory",
      targetId,
      createdAt: entry.createdAt,
      metadata: {
        productSlug: entry.productSlug || entry.inventoryItem?.productSlug || null,
        variantId: entry.variantId || null,
        note: entry.note || null,
      },
    });
  });
};

const collectInventoryMovements = async (prisma, { limit, since, sourceFilter }) => {
  if (!shouldIncludeSource(sourceFilter, "inventory") || !prisma.inventoryMovement?.findMany) {
    return [];
  }

  const rows = await prisma.inventoryMovement.findMany({
    where: withDateFilter("createdAt", since),
    include: {
      supplier: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((movement) =>
    createAuditEntry({
      id: `inventory-movement:${movement.id}`,
      source: "inventory",
      category: "movement",
      action: `INVENTORY_MOVEMENT_${sanitizeText(movement.movementType, 80).toUpperCase()}`,
      severity: movement.quantityDelta < 0 ? "warning" : "info",
      summary: `${formatLabel(movement.movementType)} ${movement.productSlug} (${movement.quantityDelta > 0 ? "+" : ""}${movement.quantityDelta})`,
      actorName: movement.createdByName || "",
      targetType: "inventoryItem",
      targetId: movement.productSlug,
      createdAt: movement.createdAt,
      metadata: {
        quantityBefore: movement.quantityBefore,
        quantityAfter: movement.quantityAfter,
        reason: movement.reason || null,
        supplier: movement.supplier?.name || null,
      },
    })
  );
};

const orderDateWhere = (since) =>
  since
    ? {
        OR: [
          { createdAt: { gte: since } },
          { updatedAt: { gte: since } },
          { statusUpdatedAt: { gte: since } },
          { paymentInitializedAt: { gte: since } },
          { paymentVerifiedAt: { gte: since } },
          { paymentWebhookProcessedAt: { gte: since } },
          { customerNotificationSentAt: { gte: since } },
        ],
      }
    : {};

const collectOrderEvents = async (prisma, { limit, since, sourceFilter }) => {
  if (!prisma.commerceOrder?.findMany) return [];
  const includeOrders = shouldIncludeSource(sourceFilter, "orders");
  const includePayments = shouldIncludeSource(sourceFilter, "payments");
  if (!includeOrders && !includePayments) return [];

  const orders = await prisma.commerceOrder.findMany({
    where: orderDateWhere(since),
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      paymentReference: true,
      paymentProvider: true,
      source: true,
      createdAt: true,
      updatedAt: true,
      statusUpdatedAt: true,
      statusUpdatedById: true,
      paymentInitializedAt: true,
      paymentVerifiedAt: true,
      paymentWebhookProcessedAt: true,
      customerNotificationStatus: true,
      customerNotificationType: true,
      customerNotificationSentAt: true,
      customerNotificationError: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return orders.flatMap((order) => {
    const entries = [];
    if (includeOrders) {
      entries.push(createAuditEntry({
        id: `order-created:${order.id}`,
        source: "orders",
        category: "order",
        action: "ORDER_CREATED",
        summary: `Order ${order.orderNumber} was created from ${order.source || "checkout"}.`,
        targetType: "order",
        targetId: order.orderNumber,
        createdAt: order.createdAt,
        metadata: {
          status: order.status,
          source: order.source || null,
        },
      }));
    }

    if (includeOrders && order.statusUpdatedAt) {
      entries.push(createAuditEntry({
        id: `order-status:${order.id}:${toIso(order.statusUpdatedAt)}`,
        source: "orders",
        category: "status",
        action: "ORDER_STATUS_UPDATED",
        severity: String(order.status || "").toUpperCase() === "CANCELLED" ? "warning" : "info",
        summary: `Order ${order.orderNumber} status is ${formatLabel(order.status)}.`,
        targetType: "order",
        targetId: order.orderNumber,
        createdAt: order.statusUpdatedAt,
        metadata: {
          status: order.status,
          statusUpdatedById: order.statusUpdatedById || null,
        },
      }));
    }

    if (includePayments && order.paymentInitializedAt) {
      entries.push(createAuditEntry({
        id: `payment-initialized:${order.id}:${toIso(order.paymentInitializedAt)}`,
        source: "payments",
        category: "payment",
        action: "PAYMENT_INITIALIZED",
        summary: `Payment initialized for order ${order.orderNumber}.`,
        targetType: "order",
        targetId: order.orderNumber,
        createdAt: order.paymentInitializedAt,
        metadata: {
          provider: order.paymentProvider || null,
          status: order.paymentStatus || null,
        },
      }));
    }

    const paymentConfirmedAt = order.paymentVerifiedAt || order.paymentWebhookProcessedAt;
    if (includePayments && paymentConfirmedAt) {
      const paymentStatus = String(order.paymentStatus || "").toLowerCase();
      entries.push(createAuditEntry({
        id: `payment-updated:${order.id}:${toIso(paymentConfirmedAt)}`,
        source: "payments",
        category: "payment",
        action: "PAYMENT_UPDATED",
        severity: ["failed", "abandoned"].includes(paymentStatus) ? "warning" : "info",
        status: paymentStatus || "received",
        summary: `Payment for order ${order.orderNumber} is ${formatLabel(paymentStatus || "received")}.`,
        targetType: "order",
        targetId: order.orderNumber,
        createdAt: paymentConfirmedAt,
        metadata: {
          provider: order.paymentProvider || null,
          hasReference: Boolean(order.paymentReference),
          source: order.paymentWebhookProcessedAt ? "webhook" : "manual_verify",
        },
      }));
    }

    if (includeOrders && order.customerNotificationStatus) {
      entries.push(createAuditEntry({
        id: `order-notification:${order.id}:${toIso(order.customerNotificationSentAt || order.updatedAt)}`,
        source: "orders",
        category: "notification",
        action: `ORDER_NOTIFICATION_${sanitizeText(order.customerNotificationStatus, 80).toUpperCase()}`,
        severity: String(order.customerNotificationStatus).toLowerCase() === "failed" ? "warning" : "info",
        status: String(order.customerNotificationStatus || "").toLowerCase(),
        summary: `Order ${order.orderNumber} notification ${formatLabel(order.customerNotificationStatus)}.`,
        targetType: "order",
        targetId: order.orderNumber,
        createdAt: order.customerNotificationSentAt || order.updatedAt,
        metadata: {
          type: order.customerNotificationType || null,
          error: order.customerNotificationError || null,
        },
      }));
    }

    return entries.filter((entry) => eventDateIsInRange(entry.createdAt, since));
  });
};

const collectReceiptEvents = async (prisma, { limit, since, sourceFilter }) => {
  if (!shouldIncludeSource(sourceFilter, "receipts") || !prisma.commerceReceipt?.findMany) {
    return [];
  }

  const receipts = await prisma.commerceReceipt.findMany({
    where: since
      ? {
          OR: [
            { issuedAt: { gte: since } },
            { sentAt: { gte: since } },
            { updatedAt: { gte: since } },
          ],
        }
      : {},
    select: {
      id: true,
      receiptNumber: true,
      status: true,
      paymentStatus: true,
      createdByName: true,
      issuedAt: true,
      sentAt: true,
      updatedAt: true,
      resendStatus: true,
      resendError: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return receipts.flatMap((receipt) => {
    const entries = [
      createAuditEntry({
        id: `receipt-issued:${receipt.id}`,
        source: "receipts",
        category: "receipt",
        action: "RECEIPT_ISSUED",
        summary: `Receipt ${receipt.receiptNumber} was issued.`,
        actorName: receipt.createdByName || "",
        targetType: "receipt",
        targetId: receipt.receiptNumber,
        createdAt: receipt.issuedAt,
        metadata: {
          status: receipt.status,
          paymentStatus: receipt.paymentStatus || null,
        },
      }),
    ];
    if (receipt.sentAt || receipt.resendStatus) {
      entries.push(createAuditEntry({
        id: `receipt-send:${receipt.id}:${toIso(receipt.sentAt || receipt.updatedAt)}`,
        source: "receipts",
        category: "notification",
        action: `RECEIPT_${sanitizeText(receipt.resendStatus || "SENT", 80).toUpperCase()}`,
        severity: receipt.resendError ? "warning" : "info",
        status: receipt.resendStatus || "sent",
        summary: `Receipt ${receipt.receiptNumber} send status is ${formatLabel(receipt.resendStatus || "sent")}.`,
        actorName: receipt.createdByName || "",
        targetType: "receipt",
        targetId: receipt.receiptNumber,
        createdAt: receipt.sentAt || receipt.updatedAt,
        metadata: {
          error: receipt.resendError || null,
        },
      }));
    }
    return entries.filter((entry) => eventDateIsInRange(entry.createdAt, since));
  });
};

const collectAccountingEvents = async (prisma, { limit, since, sourceFilter }) => {
  if (!shouldIncludeSource(sourceFilter, "accounting") || !prisma.accountingLedgerEntry?.findMany) {
    return [];
  }

  const rows = await prisma.accountingLedgerEntry.findMany({
    where: withDateFilter("createdAt", since),
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((entry) =>
    createAuditEntry({
      id: `accounting-entry:${entry.id}`,
      source: "accounting",
      category: sanitizeText(entry.entryType, 80).toLowerCase() || "ledger",
      action: "LEDGER_ENTRY_CREATED",
      severity: String(entry.entryType || "").toUpperCase() === "EXPENSE" ? "warning" : "info",
      summary: `${formatLabel(entry.entryType)} ledger entry recorded for ${entry.category}.`,
      actorName: entry.createdByName || "",
      targetType: "ledgerEntry",
      targetId: entry.reference || entry.id,
      createdAt: entry.createdAt,
      metadata: {
        source: entry.source || null,
        status: entry.status || null,
      },
    })
  );
};

const collectCustomerEvents = async (prisma, { limit, since, sourceFilter }) => {
  if (!shouldIncludeSource(sourceFilter, "crm") || !prisma.customerAccount?.findMany) return [];

  const customers = await prisma.customerAccount.findMany({
    where: since
      ? {
          OR: [
            { createdAt: { gte: since } },
            { invitedAt: { gte: since } },
            { activatedAt: { gte: since } },
            { updatedAt: { gte: since } },
          ],
        }
      : {},
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      invitedAt: true,
      activatedAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          username: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return customers.flatMap((customer) => {
    const entries = [
      createAuditEntry({
        id: `customer-created:${customer.id}`,
        source: "crm",
        category: "customer",
        action: "CUSTOMER_ACCOUNT_CREATED",
        summary: `Customer account created for ${customer.name}.`,
        actorName: customer.createdBy?.username || "",
        targetType: "customer",
        targetId: customer.id,
        createdAt: customer.createdAt,
        metadata: {
          status: customer.status,
        },
      }),
    ];
    if (customer.invitedAt) {
      entries.push(createAuditEntry({
        id: `customer-invited:${customer.id}:${toIso(customer.invitedAt)}`,
        source: "crm",
        category: "customer",
        action: "CUSTOMER_ACCOUNT_INVITED",
        summary: `Customer account invitation sent for ${customer.name}.`,
        actorName: customer.createdBy?.username || "",
        targetType: "customer",
        targetId: customer.id,
        createdAt: customer.invitedAt,
      }));
    }
    if (customer.activatedAt) {
      entries.push(createAuditEntry({
        id: `customer-activated:${customer.id}:${toIso(customer.activatedAt)}`,
        source: "crm",
        category: "customer",
        action: "CUSTOMER_ACCOUNT_ACTIVATED",
        summary: `Customer account activated for ${customer.name}.`,
        targetType: "customer",
        targetId: customer.id,
        createdAt: customer.activatedAt,
      }));
    }
    return entries.filter((entry) => eventDateIsInRange(entry.createdAt, since));
  });
};

const collectTeamEvents = async (prisma, { limit, since, sourceFilter }) => {
  if (!shouldIncludeSource(sourceFilter, "team")) return [];
  const [users, roles] = await Promise.all([
    prisma.siteUser?.findMany
      ? prisma.siteUser.findMany({
          where: withDateFilter("createdAt", since),
          select: {
            id: true,
            username: true,
            role: true,
            isActive: true,
            createdAt: true,
            createdBy: {
              select: {
                username: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [],
    prisma.portalRole?.findMany
      ? prisma.portalRole.findMany({
          where: withDateFilter("createdAt", since),
          select: {
            id: true,
            key: true,
            name: true,
            isSystem: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [],
  ]);

  return [
    ...users.map((user) =>
      createAuditEntry({
        id: `portal-user:${user.id}`,
        source: "team",
        category: "user",
        action: "PORTAL_USER_CREATED",
        severity: user.isActive ? "info" : "warning",
        summary: `Portal user ${user.username} was created as ${formatLabel(user.role)}.`,
        actorName: user.createdBy?.username || "",
        targetType: "siteUser",
        targetId: user.username,
        createdAt: user.createdAt,
        metadata: {
          role: user.role,
          isActive: user.isActive,
        },
      })
    ),
    ...roles.map((role) =>
      createAuditEntry({
        id: `portal-role:${role.id}`,
        source: "team",
        category: "role",
        action: "PORTAL_ROLE_CREATED",
        severity: role.isActive ? "info" : "warning",
        summary: `${role.isSystem ? "System" : "Custom"} role ${role.name} is available.`,
        targetType: "portalRole",
        targetId: role.key,
        createdAt: role.createdAt,
        metadata: {
          isSystem: role.isSystem,
          isActive: role.isActive,
        },
      })
    ),
  ];
};

const filterEntries = (entries, { sourceFilter, search, since }) => {
  const normalizedSearch = sanitizeText(search, 120).toLowerCase();
  return entries.filter((entry) => {
    if (!eventDateIsInRange(entry.createdAt, since)) return false;
    if (!shouldIncludeSource(sourceFilter, entry.source)) return false;
    if (!normalizedSearch) return true;
    const haystack = [
      entry.action,
      entry.summary,
      entry.actorName,
      entry.targetType,
      entry.targetId,
      entry.source,
      entry.category,
      entry.status,
    ].join(" ").toLowerCase();
    return haystack.includes(normalizedSearch);
  });
};

const buildSummary = (entries) => {
  const bySource = {};
  entries.forEach((entry) => {
    bySource[entry.source] = (bySource[entry.source] || 0) + 1;
  });
  return {
    total: entries.length,
    warnings: entries.filter((entry) => entry.severity === "warning").length,
    errors: entries.filter((entry) => entry.severity === "error").length,
    bySource,
    latestAt: entries[0]?.createdAt || null,
  };
};

export const createAdminAuditLogRouter = (prisma) => {
  const router = Router();

  router.use(requireSiteUser(prisma, ["ADMIN"]));

  router.get(
    "/audit-logs",
    asyncRoute(async (req, res) => {
      const limit = parseLimit(req.query.limit);
      const sourceInput = sanitizeText(req.query.source, 40).toLowerCase();
      const sourceFilter = AUDIT_SOURCES.has(sourceInput) ? sourceInput : "";
      const { range, since } = resolveRangeStart(req.query.range);
      const query = {
        limit,
        since,
        sourceFilter,
      };

      const entries = (
        await Promise.all([
          collectInventoryAuditEntries(prisma, query),
          collectInventoryMovements(prisma, query),
          collectOrderEvents(prisma, query),
          collectReceiptEvents(prisma, query),
          collectAccountingEvents(prisma, query),
          collectCustomerEvents(prisma, query),
          collectTeamEvents(prisma, query),
        ])
      )
        .flat()
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

      const filteredEntries = filterEntries(entries, {
        sourceFilter,
        search: req.query.search,
        since,
      }).slice(0, limit);

      res.json({
        ok: true,
        entries: filteredEntries,
        summary: buildSummary(filteredEntries),
        filters: {
          range,
          source: sourceFilter,
          search: sanitizeText(req.query.search, 120),
          limit,
        },
      });
    })
  );

  return router;
};
