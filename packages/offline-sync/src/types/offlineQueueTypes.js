export const OFFLINE_QUEUE_ITEM_VERSION = "offline-queue-item.v1";

export const OFFLINE_QUEUE_ITEM_SHAPE = Object.freeze({
  id: "Client-generated queue item id.",
  actionType: "Action constant from OFFLINE_QUEUE_ACTION_TYPES.",
  sourceApp: "App that created the queue item, such as reebs-portal or dev-erp.",
  organizationId: "Organization id associated with the authenticated user.",
  actorId: "Authenticated user id at the time of queueing.",
  payload: "App-owned action payload. Must be server-validated before sync.",
  status: "Queue item sync state from SYNC_STATES.",
  conflictStatus: "Conflict status from OFFLINE_CONFLICT_STATUSES.",
  retry: "Retry metadata from retryMetadata.js.",
  createdAt: "Client timestamp when queued.",
  updatedAt: "Client timestamp when updated.",
  lastAttemptAt: "Client timestamp of last sync attempt.",
});

export const OFFLINE_QUEUE_SECURITY_ASSUMPTIONS = Object.freeze([
  "User must authenticate online before offline use.",
  "Queued actions must include organization context.",
  "Backend must re-check auth, permissions, and organization isolation during sync.",
  "Queued payloads are untrusted and must be validated server-side.",
  "Sensitive settings and secrets should not be cached in queue payloads.",
]);
