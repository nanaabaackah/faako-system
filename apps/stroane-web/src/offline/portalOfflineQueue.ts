import {
  OFFLINE_CONFLICT_STATUSES,
  SYNC_STATES,
  createIndexedDbQueueStorage,
} from "@faako/offline-sync";
import type { AdminSession } from "../api/adminSession";

export const STROANE_PORTAL_QUEUE_SOURCE_APP = "stroane-portal";
export const STROANE_PORTAL_QUEUE_ORGANIZATION_ID = "stroane";
export const STROANE_PORTAL_OVERVIEW_TARGET_TYPE = "portal-overview";
export const STROANE_PORTAL_REFRESH_ACTION = "REFRESH_PORTAL_OVERVIEW";
export const STROANE_PORTAL_QUEUE_CHANGED_EVENT = "stroane-portal-queue-changed";

type QueueStorage = ReturnType<typeof createIndexedDbQueueStorage>;
interface QueueItem {
  id: string;
  actionType: string;
  sourceApp: string;
  organizationId: string;
  actorId: string;
  payload?: {
    targetType?: string;
    targetId?: string;
    [key: string]: unknown;
  };
  status: string;
  conflictStatus?: string;
  retry?: {
    attempts?: number;
    lastError?: string;
    [key: string]: unknown;
  };
}

const REVIEWABLE_REFRESH_STATUSES = new Set([
  SYNC_STATES.PENDING,
  SYNC_STATES.SYNCING,
  SYNC_STATES.RETRYING,
]);

const getActorId = (session: AdminSession) => session.username.trim().toLowerCase();

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to sync queued portal work.";

export const createStroanePortalQueueStorage = () => createIndexedDbQueueStorage();

export const notifyStroanePortalQueueChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STROANE_PORTAL_QUEUE_CHANGED_EVENT));
};

export const getStroanePortalQueueScope = (session: AdminSession) => ({
  sourceApp: STROANE_PORTAL_QUEUE_SOURCE_APP,
  organizationId: STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
  actorId: getActorId(session),
});

export const isQueuedPortalOverviewRefresh = (
  item: QueueItem | undefined,
  session: AdminSession
) =>
  item?.sourceApp === STROANE_PORTAL_QUEUE_SOURCE_APP &&
  item?.organizationId === STROANE_PORTAL_QUEUE_ORGANIZATION_ID &&
  item?.actorId === getActorId(session) &&
  item?.actionType === STROANE_PORTAL_REFRESH_ACTION &&
  item?.payload?.targetType === STROANE_PORTAL_OVERVIEW_TARGET_TYPE;

export const queuePortalOverviewRefresh = async (
  storage: QueueStorage,
  session: AdminSession
) => {
  const items = await storage.list();
  const existing = items.find(
    (item: QueueItem) =>
      isQueuedPortalOverviewRefresh(item, session) &&
      REVIEWABLE_REFRESH_STATUSES.has(item.status)
  );

  if (existing) return existing;

  const queuedAt = new Date().toISOString();
  const queued = await storage.put({
    actionType: STROANE_PORTAL_REFRESH_ACTION,
    sourceApp: STROANE_PORTAL_QUEUE_SOURCE_APP,
    organizationId: STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
    actorId: getActorId(session),
    status: SYNC_STATES.PENDING,
    payload: {
      queuedAt,
      targetType: STROANE_PORTAL_OVERVIEW_TARGET_TYPE,
      targetId: "dashboard",
      source: "portal-dashboard-refresh",
      endpoint: {
        method: "GET",
        paths: [
          "/api/admin/inventory",
          "/api/admin/suppliers",
          "/api/admin/inventory/movements",
          "/api/admin/inventory/alerts",
          "/api/admin/products",
        ],
      },
      metadata: {
        itemName: "Portal overview refresh",
        queuedBy: session.username,
      },
    },
  });
  notifyStroanePortalQueueChanged();
  return queued;
};

export const processQueuedPortalOverviewRefresh = async (
  storage: QueueStorage,
  item: QueueItem,
  syncOverview: () => Promise<void>
) => {
  const now = new Date().toISOString();
  await storage.updateStatus(item.id, SYNC_STATES.SYNCING, {
    lastAttemptAt: now,
    review: {
      lastError: "",
      syncStartedAt: now,
    },
  });

  try {
    await syncOverview();
    const synced = await storage.updateStatus(item.id, SYNC_STATES.SYNCED, {
      lastAttemptAt: new Date().toISOString(),
      conflictStatus: OFFLINE_CONFLICT_STATUSES.NONE,
      retry: {
        ...(item.retry || {}),
        lastError: "",
      },
      review: {
        lastError: "",
        syncedAt: new Date().toISOString(),
        resolution: "Portal overview refreshed from the server.",
      },
    });
    notifyStroanePortalQueueChanged();
    return synced;
  } catch (error) {
    const message = getErrorMessage(error);
    const failed = await storage.updateStatus(item.id, SYNC_STATES.FAILED, {
      lastAttemptAt: new Date().toISOString(),
      conflictStatus: OFFLINE_CONFLICT_STATUSES.NEEDS_REVIEW,
      retry: {
        ...(item.retry || {}),
        attempts: Number(item.retry?.attempts || 0) + 1,
        lastError: message,
      },
      review: {
        lastError: message,
      },
    });
    notifyStroanePortalQueueChanged();
    return failed;
  }
};

export const processPendingPortalOverviewRefreshes = async (
  storage: QueueStorage,
  session: AdminSession,
  syncOverview: () => Promise<void>
) => {
  const items = await storage.list();
  const pendingItems = items.filter(
    (item: QueueItem) =>
      isQueuedPortalOverviewRefresh(item, session) && item.status === SYNC_STATES.PENDING
  );

  for (const item of pendingItems) {
    await processQueuedPortalOverviewRefresh(storage, item, syncOverview);
  }

  return pendingItems.length;
};
