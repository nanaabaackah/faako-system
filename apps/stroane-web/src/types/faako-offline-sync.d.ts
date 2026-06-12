declare module "@faako/offline-sync" {
  export type OfflineQueuePayload = {
    targetType?: string;
    targetId?: string;
    queuedAt?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };

  export type OfflineQueueItem = {
    id: string;
    actionType: string;
    sourceApp: string;
    organizationId: string;
    actorId: string;
    status: string;
    conflictStatus?: string;
    payload?: OfflineQueuePayload;
    retry?: {
      attempts?: number;
      lastError?: string;
      [key: string]: unknown;
    };
    review?: {
      lastError?: string;
      [key: string]: unknown;
    };
    lastError?: string;
    createdAt?: string;
    updatedAt?: string;
    lastAttemptAt?: string;
  };

  export type OfflineQueueSummaryCounts = {
    total: number;
    pending: number;
    syncing: number;
    failed: number;
    conflict: number;
    needsReview: number;
    retrying: number;
    synced: number;
    cancelled: number;
    resolved: number;
    reviewable: number;
    closed: number;
  };

  export type OfflineQueueStorage = {
    put(item: Partial<OfflineQueueItem>): Promise<OfflineQueueItem>;
    get(id: string): Promise<OfflineQueueItem | undefined>;
    list(): Promise<OfflineQueueItem[]>;
    remove(id: string): Promise<void>;
    clear(): Promise<void>;
    updateStatus(
      id: string,
      status: string,
      patch?: Partial<OfflineQueueItem>
    ): Promise<OfflineQueueItem | undefined>;
    patch(id: string, patch?: Partial<OfflineQueueItem>): Promise<OfflineQueueItem | undefined>;
  };

  export const SYNC_STATES: {
    ONLINE: string;
    OFFLINE: string;
    PENDING: string;
    SYNCING: string;
    SYNCED: string;
    FAILED: string;
    CONFLICT: string;
    NEEDS_REVIEW: string;
    RETRYING: string;
    CANCELLED: string;
    RESOLVED: string;
  };

  export const SYNC_STATE_LABELS: Record<string, string>;

  export const OFFLINE_CONFLICT_STATUSES: {
    NONE: string;
    DETECTED: string;
    RESOLVED: string;
    NEEDS_REVIEW: string;
  };

  export const OFFLINE_CONFLICT_STATUS_LABELS: Record<string, string>;

  export function useOnlineStatus(): boolean;

  export function useSyncQueueSummary(options?: {
    storage?: OfflineQueueStorage;
    sourceApp?: string;
    organizationId?: string;
    actorId?: string;
    enabled?: boolean;
    pollIntervalMs?: number;
    requireScope?: boolean;
  }): {
    items: OfflineQueueItem[];
    reviewItems: OfflineQueueItem[];
    counts: OfflineQueueSummaryCounts;
    loading: boolean;
    error: string;
    refresh: () => Promise<OfflineQueueItem[]>;
    storage: OfflineQueueStorage;
    hasReviewItems: boolean;
    lastError: string;
  };

  export function createIndexedDbQueueStorage(options?: Record<string, unknown>): OfflineQueueStorage;

  export function cancelQueuedAction(
    storage: OfflineQueueStorage,
    itemOrId: OfflineQueueItem | string | { id: string },
    options?: Record<string, unknown>
  ): Promise<OfflineQueueItem | undefined>;

  export function markQueuedActionResolved(
    storage: OfflineQueueStorage,
    itemOrId: OfflineQueueItem | string | { id: string },
    options?: Record<string, unknown>
  ): Promise<OfflineQueueItem | undefined>;

  export function getQueueActionLabel(item?: Partial<OfflineQueueItem>): string;

  export function getQueueItemDisplayMeta(item?: Partial<OfflineQueueItem>): {
    title?: string;
    targetType?: string;
    targetId?: string;
    source?: string;
    queuedAt?: string;
    lastError?: string;
  };

  export function isQueueItemConflictLike(item?: Partial<OfflineQueueItem>): boolean;
}
