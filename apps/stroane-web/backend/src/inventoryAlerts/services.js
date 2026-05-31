import { randomUUID } from "node:crypto";
import {
  calculateAvailableQuantity,
  isLowStock,
  needsReorder,
} from "../inventory/services.js";
import {
  INVENTORY_ALERT_CHANNELS,
  INVENTORY_ALERT_DISPATCH_STATUSES,
  prepareInventoryAlertWhatsApp,
  sendInventoryAlertEmail,
} from "./notifications.js";

export const INVENTORY_ALERT_TYPES = Object.freeze({
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  RESTOCKED: "RESTOCKED",
});

export const INVENTORY_ALERT_STATUSES = Object.freeze({
  ACTIVE: "ACTIVE",
  RESOLVED: "RESOLVED",
});

const DEFAULT_COOLDOWN_MINUTES = 12 * 60;

const sanitizeLogText = (value, maxLength = 200) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const parseCooldownMs = (value = process.env.STROANE_ALERT_COOLDOWN_MINUTES) => {
  const minutes = Number.parseInt(String(value || ""), 10);
  return (Number.isInteger(minutes) && minutes > 0 ? minutes : DEFAULT_COOLDOWN_MINUTES) * 60_000;
};

const alertInventoryInclude = {
  product: {
    select: {
      id: true,
      slug: true,
      name: true,
      sku: true,
      isPublished: true,
      publishingStatus: true,
    },
  },
};

const alertDetailInclude = {
  inventoryItem: {
    include: alertInventoryInclude,
  },
};

const toIso = (value) => (value instanceof Date ? value.toISOString() : value || null);

export const isInventoryAlertEligible = (item = {}) =>
  item.inventoryTrackingEnabled !== false &&
  Boolean(item.product) &&
  item.product.isPublished !== false &&
  String(item.product.publishingStatus || "active").toLowerCase() === "active";

export const detectInventoryAlert = (item = {}) => {
  if (!isInventoryAlertEligible(item)) return null;

  const availableQuantity = calculateAvailableQuantity(
    item.quantityOnHand,
    item.reservedQuantity
  );
  if (availableQuantity === null) return null;

  const base = {
    availableQuantity,
    reservedQuantity: item.reservedQuantity ?? 0,
    reorderThreshold: item.reorderThreshold ?? item.lowStockThreshold ?? null,
  };

  if (availableQuantity <= 0) {
    return {
      ...base,
      alertType: INVENTORY_ALERT_TYPES.OUT_OF_STOCK,
      reason: "available_quantity_depleted",
    };
  }

  const lowStock = isLowStock(item);
  const reorderReached = needsReorder(item);
  if (lowStock || reorderReached) {
    return {
      ...base,
      alertType: INVENTORY_ALERT_TYPES.LOW_STOCK,
      reason:
        lowStock && reorderReached
          ? "low_stock_and_reorder_threshold_reached"
          : lowStock
            ? "low_stock_threshold_reached"
            : "reorder_threshold_reached",
    };
  }

  return null;
};

export const shouldDispatchAlert = (
  alert = {},
  { now = new Date(), cooldownMs = parseCooldownMs() } = {}
) => {
  if (!alert.lastNotificationAttemptAt) return true;
  return now.getTime() - new Date(alert.lastNotificationAttemptAt).getTime() >= cooldownMs;
};

const resolveAlert = (prisma, id, now) =>
  prisma.inventoryAlert.update({
    where: { id },
    data: {
      status: INVENTORY_ALERT_STATUSES.RESOLVED,
      resolvedAt: now,
    },
  });

const buildAlertData = (inventoryItemId, detection, now) => ({
  inventoryItemId,
  alertType: detection.alertType,
  status: INVENTORY_ALERT_STATUSES.ACTIVE,
  reason: detection.reason,
  availableQuantity: detection.availableQuantity,
  reservedQuantity: detection.reservedQuantity,
  reorderThreshold: detection.reorderThreshold,
  lastDetectedAt: now,
  resolvedAt: null,
});

const upsertDetectedAlert = (prisma, inventoryItemId, detection, now) =>
  prisma.inventoryAlert.upsert({
    where: {
      inventoryItemId_alertType: {
        inventoryItemId,
        alertType: detection.alertType,
      },
    },
    create: buildAlertData(inventoryItemId, detection, now),
    update: buildAlertData(inventoryItemId, detection, now),
    include: alertDetailInclude,
  });

const claimAlertForDispatch = async (prisma, alert, now, cooldownMs) => {
  if (!shouldDispatchAlert(alert, { now, cooldownMs })) return false;
  const cooldownBoundary = new Date(now.getTime() - cooldownMs);
  const result = await prisma.inventoryAlert.updateMany({
    where: {
      id: alert.id,
      status: INVENTORY_ALERT_STATUSES.ACTIVE,
      OR: [
        { lastNotificationAttemptAt: null },
        { lastNotificationAttemptAt: { lte: cooldownBoundary } },
      ],
    },
    data: { lastNotificationAttemptAt: now },
  });
  return result.count === 1;
};

const toSafeAlert = (alert) => ({
  id: alert.id,
  alertType: alert.alertType,
  status: alert.status,
  reason: alert.reason || null,
  productSlug: alert.inventoryItem?.productSlug || null,
  productName: alert.inventoryItem?.product?.name || alert.inventoryItem?.productSlug || null,
  sku: alert.inventoryItem?.sku || null,
  availableQuantity: alert.availableQuantity,
  reservedQuantity: alert.reservedQuantity,
  reorderThreshold: alert.reorderThreshold,
  firstDetectedAt: toIso(alert.firstDetectedAt),
  lastDetectedAt: toIso(alert.lastDetectedAt),
  lastNotificationAttemptAt: toIso(alert.lastNotificationAttemptAt),
  lastNotifiedAt: toIso(alert.lastNotifiedAt),
  notificationCount: alert.notificationCount,
  resolvedAt: toIso(alert.resolvedAt),
});

const toSafeDispatch = (dispatch) => ({
  id: dispatch.id,
  batchKey: dispatch.batchKey,
  trigger: dispatch.trigger,
  alertType: dispatch.alertType,
  channel: dispatch.channel,
  status: dispatch.status,
  recipientCount: dispatch.recipientCount,
  createdAt: toIso(dispatch.createdAt),
});

const safeDispatchResult = (result, fallbackChannel) => ({
  channel: result?.channel || fallbackChannel,
  status: result?.status || INVENTORY_ALERT_DISPATCH_STATUSES.FAILED,
  recipientCount: Number(result?.recipientCount) || 0,
  providerId: sanitizeLogText(result?.providerId, 120) || null,
  error: sanitizeLogText(result?.reason || result?.error, 180) || null,
});

const runChannelSafely = async (channel, send) => {
  try {
    return safeDispatchResult(await send(), channel);
  } catch (error) {
    return safeDispatchResult(
      { channel, status: INVENTORY_ALERT_DISPATCH_STATUSES.FAILED, error: error?.message },
      channel
    );
  }
};

const saveDispatches = async (prisma, alerts, results, trigger, batchKey) => {
  const dispatches = alerts.flatMap((alert) =>
    results.map((result) => ({
      alertId: alert.id,
      batchKey,
      trigger,
      alertType: alert.alertType,
      channel: result.channel,
      status: result.status,
      recipientCount: result.recipientCount,
      providerId: result.providerId,
      error: result.error,
      payloadSummary: {
        productSlug: alert.inventoryItem?.productSlug || null,
        availableQuantity: alert.availableQuantity,
        reorderThreshold: alert.reorderThreshold,
      },
    }))
  );
  if (dispatches.length) await prisma.inventoryAlertDispatch.createMany({ data: dispatches });
};

const dispatchClaimedAlerts = async (prisma, alerts, { now, trigger }) => {
  if (!alerts.length) return [];

  const batchKey = randomUUID();
  const results = await Promise.all([
    runChannelSafely(INVENTORY_ALERT_CHANNELS.EMAIL, () =>
      sendInventoryAlertEmail({ alerts })
    ),
    runChannelSafely(INVENTORY_ALERT_CHANNELS.WHATSAPP, () =>
      prepareInventoryAlertWhatsApp({ alerts })
    ),
  ]);

  await saveDispatches(prisma, alerts, results, trigger, batchKey);

  const delivered = results.some(
    (result) => result.status === INVENTORY_ALERT_DISPATCH_STATUSES.SENT
  );
  await Promise.all(
    alerts.map((alert) =>
      prisma.inventoryAlert.update({
        where: { id: alert.id },
        data: {
          lastNotifiedAt: delivered ? now : alert.lastNotifiedAt,
          notificationCount: delivered ? { increment: 1 } : undefined,
          status:
            alert.alertType === INVENTORY_ALERT_TYPES.RESTOCKED
              ? INVENTORY_ALERT_STATUSES.RESOLVED
              : alert.status,
          resolvedAt:
            alert.alertType === INVENTORY_ALERT_TYPES.RESTOCKED ? now : alert.resolvedAt,
        },
      })
    )
  );

  return results.map(({ channel, status, recipientCount }) => ({
    channel,
    status,
    recipientCount,
  }));
};

export const runInventoryAlertCheck = async (
  prisma,
  {
    inventoryItemIds,
    trigger = "manual",
    now = new Date(),
    cooldownMs = parseCooldownMs(),
  } = {}
) => {
  const where = Array.isArray(inventoryItemIds) && inventoryItemIds.length
    ? { id: { in: inventoryItemIds } }
    : {};
  const items = await prisma.inventoryItem.findMany({
    where,
    include: alertInventoryInclude,
  });
  const existingAlerts = await prisma.inventoryAlert.findMany({
    where: {
      inventoryItemId: { in: items.map((item) => item.id) },
      status: INVENTORY_ALERT_STATUSES.ACTIVE,
    },
    include: alertDetailInclude,
  });
  const activeByItem = new Map();
  existingAlerts.forEach((alert) => {
    const alerts = activeByItem.get(alert.inventoryItemId) || [];
    alerts.push(alert);
    activeByItem.set(alert.inventoryItemId, alerts);
  });

  const detected = [];
  const restocked = [];
  for (const item of items) {
    const activeAlerts = activeByItem.get(item.id) || [];
    const warningAlerts = activeAlerts.filter((alert) =>
      [INVENTORY_ALERT_TYPES.LOW_STOCK, INVENTORY_ALERT_TYPES.OUT_OF_STOCK].includes(
        alert.alertType
      )
    );
    const nextAlert = detectInventoryAlert(item);

    if (!isInventoryAlertEligible(item)) {
      await Promise.all(warningAlerts.map((alert) => resolveAlert(prisma, alert.id, now)));
      continue;
    }

    if (nextAlert) {
      await Promise.all(
        warningAlerts
          .filter((alert) => alert.alertType !== nextAlert.alertType)
          .map((alert) => resolveAlert(prisma, alert.id, now))
      );
      detected.push(await upsertDetectedAlert(prisma, item.id, nextAlert, now));
      continue;
    }

    if (warningAlerts.length) {
      await Promise.all(warningAlerts.map((alert) => resolveAlert(prisma, alert.id, now)));
      restocked.push(
        await upsertDetectedAlert(
          prisma,
          item.id,
          {
            alertType: INVENTORY_ALERT_TYPES.RESTOCKED,
            reason: "inventory_recovered_above_threshold",
            availableQuantity: calculateAvailableQuantity(
              item.quantityOnHand,
              item.reservedQuantity
            ),
            reservedQuantity: item.reservedQuantity ?? 0,
            reorderThreshold: item.reorderThreshold ?? item.lowStockThreshold ?? null,
          },
          now
        )
      );
    }
  }

  const candidates = [...detected, ...restocked];
  const claimed = [];
  for (const alert of candidates) {
    if (await claimAlertForDispatch(prisma, alert, now, cooldownMs)) claimed.push(alert);
  }
  const deliveries = await dispatchClaimedAlerts(prisma, claimed, { now, trigger });

  return {
    ok: true,
    checked: items.length,
    detected: detected.length,
    restocked: restocked.length,
    dispatched: claimed.length,
    alerts: candidates.map(toSafeAlert),
    deliveries,
  };
};

export const runInventoryAlertCheckSafely = async (prisma, options = {}) => {
  try {
    return await runInventoryAlertCheck(prisma, options);
  } catch (error) {
    console.warn("Stroane inventory alert check failed", {
      trigger: sanitizeLogText(options.trigger, 80) || "unknown",
      message: sanitizeLogText(error?.message || "Unknown inventory alert error"),
    });
    return {
      ok: false,
      checked: 0,
      detected: 0,
      restocked: 0,
      dispatched: 0,
      error: "Inventory alert check is temporarily unavailable.",
    };
  }
};

export const listInventoryAlertSummary = async (prisma) => {
  const [alerts, dispatches] = await Promise.all([
    prisma.inventoryAlert.findMany({
      where: { status: INVENTORY_ALERT_STATUSES.ACTIVE },
      include: alertDetailInclude,
      orderBy: [{ alertType: "asc" }, { lastDetectedAt: "desc" }],
      take: 100,
    }),
    prisma.inventoryAlertDispatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return {
    active: alerts.map(toSafeAlert),
    recentDispatches: dispatches.map(toSafeDispatch),
    counts: {
      lowStock: alerts.filter((alert) => alert.alertType === INVENTORY_ALERT_TYPES.LOW_STOCK)
        .length,
      outOfStock: alerts.filter(
        (alert) => alert.alertType === INVENTORY_ALERT_TYPES.OUT_OF_STOCK
      ).length,
      total: alerts.length,
    },
  };
};

