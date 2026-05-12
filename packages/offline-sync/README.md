# @faako/offline-sync

Shared offline infrastructure foundation for Faako ERP apps.

## What Changed

Added the Offline Foundation Wave. This package provides offline queue constants, sync status constants, conflict status constants, documented queue/sync shapes, IndexedDB queue storage helpers, memory queue helpers for tests, local draft storage helpers, retry metadata helpers, review/recovery helpers, online/offline detection, passive React hooks, and small status UI components.

Offline POS/payment drafts use the local draft helpers for work-in-progress browser storage. REEBS Store Mode uses the queue helpers for `CREATE_POS_ORDER` actions when offline. REEBS manual order payments and Dev ERP new rent payments use `RECORD_PAYMENT` queue items when offline. REEBS inventory stock adjustments use `ADJUST_STOCK` queue items when offline. REEBS admin bookings use `CREATE_BOOKING`, `UPDATE_BOOKING_DETAILS`, and `UPDATE_BOOKING_STATUS` queue items when offline. Queued actions still submit to existing server endpoints when connectivity returns; this package does not bypass auth, permissions, stock validation, booking availability validation, payment validation, receipt creation, balance updates, or server validation.

The Offline conflict review and sync reliability layer adds queue summary counts, last-error review metadata, retry/cancel/mark-resolved helpers, `SyncReviewPanel`, and `SyncConflictCard`. These tools expose pending, failed, conflict, and needs-review local queue records without showing raw payloads. Retry re-arms items for the existing app-specific sync paths; server endpoints remain the only source of truth.

## Where It Lives

- `src/constants/`: sync states, queue action types, conflict statuses, and storage constants.
- `src/types/`: documented offline queue and sync metadata shapes.
- `src/storage/indexedDb.js`: IndexedDB wrapper for future browser queue storage.
- `src/storage/queueStorage.js`: queue item helpers plus IndexedDB and memory queue storage adapters.
- `src/storage/localDraftStorage.js`: scoped browser-local draft helpers for work-in-progress forms.
- `src/storage/queueActions.js`: local retry, cancel, resolve, last-error, and conflict metadata helpers.
- `src/retry/retryMetadata.js`: retry metadata and retry timing helpers.
- `src/status/`: online/offline detector, aggregate sync status helpers, and queue summary helpers.
- `src/hooks/`: `useOnlineStatus`, `useSyncStatus`, `useSyncQueueSummary`, `useQueuedActionRetry`, and `useQueuedActionCancel`.
- `src/components/`: `OfflineStatusBadge`, `PendingSyncBadge`, `SyncStatusBanner`, `SyncReviewPanel`, and `SyncConflictCard`.
- `test/offlineSync.test.mjs`: low-risk unit tests for queue items, draft storage, retry metadata, sync summaries, and review helper behavior.

## Queue Action Types

Future queue action constants include:

- `CREATE_CUSTOMER`
- `CREATE_POS_ORDER`
- `CREATE_ORDER`
- `RECORD_PAYMENT`
- `CREATE_BOOKING`
- `UPDATE_BOOKING_STATUS`
- `UPDATE_BOOKING_DETAILS`
- `ADJUST_STOCK`
- `UPDATE_DELIVERY_STATUS`
- `ADD_DELIVERY_NOTE`

`CREATE_POS_ORDER` is wired for REEBS Store Mode only. `RECORD_PAYMENT` is wired for REEBS manual order payments and Dev ERP new rent payment records only. `ADJUST_STOCK` is wired for REEBS inventory stock adjustments only. `CREATE_BOOKING`, `UPDATE_BOOKING_DETAILS`, and `UPDATE_BOOKING_STATUS` are wired for REEBS admin bookings only. Other action constants remain future placeholders and are not wired to production sync yet.

## Sync States

Supported states:

- `online`
- `offline`
- `pending`
- `syncing`
- `synced`
- `failed`
- `conflict`
- `needs_review`
- `retrying`
- `cancelled`
- `resolved`

## How To Use It

Passive online/offline indicator example:

```jsx
import { OfflineStatusBadge } from "@faako/offline-sync";

<OfflineStatusBadge />
```

Queue storage example:

```js
import { createIndexedDbQueueStorage } from "@faako/offline-sync";

const storage = createIndexedDbQueueStorage({
  dbName: "faako-offline-sync",
});
```

Local draft example:

```js
import { buildScopedDraftKey, writeLocalDraft } from "@faako/offline-sync";

const key = buildScopedDraftKey({
  sourceApp: "reebs-portal",
  organizationId: currentOrgId,
  actorId: currentUserId,
  draftType: "manual-payment",
  recordId: orderId,
});

writeLocalDraft(key, { amount: "25.00", method: "cash" }, {
  metadata: {
    sourceApp: "reebs-portal",
    organizationId: currentOrgId,
    actorId: currentUserId,
    draftType: "manual-payment",
    recordId: orderId,
  },
});
```

Local drafts are for unfinished form input only. They are not queue items and are not production transactions.

Sync review panel example:

```jsx
import {
  SyncReviewPanel,
  createIndexedDbQueueStorage,
  useQueuedActionCancel,
  useQueuedActionRetry,
  useSyncQueueSummary,
} from "@faako/offline-sync";

const storage = createIndexedDbQueueStorage();
const summary = useSyncQueueSummary({
  storage,
  sourceApp: "reebs-portal",
  organizationId: currentOrgId,
  actorId: currentUserId,
});
const { retry, retryingId } = useQueuedActionRetry({ storage, onAfterChange: summary.refresh });
const { cancel, cancellingId } = useQueuedActionCancel({ storage, onAfterChange: summary.refresh });

<SyncReviewPanel
  items={summary.items}
  summary={summary}
  loading={summary.loading}
  error={summary.error}
  onRefresh={summary.refresh}
  onRetry={retry}
  onCancel={cancel}
  retryingId={retryingId}
  cancellingId={cancellingId}
/>
```

The review panel only displays summary metadata and last error text. Do not expose raw queue payloads in review UIs because queued actions may contain customer references, payment references, notes, or operational context.

Queued POS order notes:

- Queued POS order records use `OFFLINE_QUEUE_ACTION_TYPES.CREATE_POS_ORDER`.
- Queued records are marked `pending` until sync starts.
- Sync submits to the existing REEBS order creation endpoint when the browser is online again.
- The server remains the source of truth for stock, auth, permissions, payment persistence, receipt numbers, and final order status.
- Failed sync attempts remain in the local queue as `needs_review` with an error message.

Queued manual payment notes:

- Queued manual payment records use `OFFLINE_QUEUE_ACTION_TYPES.RECORD_PAYMENT`.
- REEBS queues order payment records from the order detail ledger and orders board payment action modal.
- Dev ERP queues new rent payment records only; existing rent payment edits stay online-only.
- Sync submits to the existing app payment endpoints when the browser is online again.
- The server remains the source of truth for auth, permissions, references, balances, accounting effects, receipt records, notifications, and final payment status.
- Failed sync attempts remain local as `needs_review` or `failed` with an error message for staff review.

Queued inventory adjustment notes:

- Queued inventory adjustment records use `OFFLINE_QUEUE_ACTION_TYPES.ADJUST_STOCK`.
- REEBS queues stock adjustment records from the Inventory adjustment modal only.
- Queued adjustment payloads store the inventory item reference, optional variant reference, adjustment amount, adjustment type, optional notes/reference/sold month, timestamp/idempotency metadata, and user/org scope.
- Sync submits to the existing REEBS stock adjustment endpoint when the browser is online again.
- The server remains the source of truth for auth, permissions, stock validation, rental restrictions, variant checks, booking reservation safety, and final stock state.
- Failed sync attempts remain local as `needs_review` or `failed` with an error message for staff review.

Queued booking action notes:

- Queued booking records use `OFFLINE_QUEUE_ACTION_TYPES.CREATE_BOOKING`, `UPDATE_BOOKING_DETAILS`, and `UPDATE_BOOKING_STATUS`.
- REEBS queues admin booking create/edit/status actions from the Bookings module only.
- Queued booking payloads store the booking reference when present, selected customer reference/details, event date/time, selected items, venue/delivery location, status action, timestamp/idempotency metadata, and user/org scope.
- Sync submits to the existing REEBS `/.netlify/functions/bookings` endpoint when the browser is online again.
- The server remains the source of truth for auth, permissions, booking availability, rental reservation writes, item/date conflicts, customer validity, and final booking status.
- Failed sync attempts remain local as `needs_review` or `failed` with an error message for staff review.

## Security Rules

- User must authenticate online before offline use.
- Backend must re-check auth and permissions during sync.
- Organization isolation must be preserved in every queued action.
- Sensitive settings, secrets, tokens, and private configuration should not be cached unnecessarily.
- Queued actions are untrusted client data and must be validated server-side later.
- Retry actions must use existing app sync handlers or server endpoints; they must not bypass backend validation.
- Cancelled or resolved queue records are local review decisions only and must not be treated as proof of server-side completion.
- Offline receipt previews must not be treated as official server-confirmed receipts.
- Local drafts must remain user/org scoped where possible and should store only the fields needed to restore the unfinished form.

## Environment Variables

None.

## Setup Or Migration Steps

None. No database migration, API migration, service worker, or new production sync service is required.

## Data Impact

Local queued data only until server sync. Draft helpers write only to browser-local storage for unfinished POS/payment form state. Queued REEBS POS orders, manual payments, inventory adjustments, booking actions, and Dev ERP rent payments write to server data only after the existing online endpoints accept them.

## Security Impact

Server remains the source of truth. Offline queue records are untrusted client data and must pass existing backend auth, permissions, stock validation, booking availability validation, payment validation, balance validation, receipt creation, accounting behavior, future idempotency safeguards, and organization isolation before any production data changes.

## Known Limitations

- REEBS Store Mode queues POS order creation, REEBS manual order payment forms queue payment recording, REEBS Inventory queues stock adjustments, and REEBS Bookings queues booking create/edit/status actions only.
- Dev ERP queues new rent payment recording only; rent payment edits remain online-only.
- No general production sync loop exists yet. The review panel can retry/cancel/mark-resolved local items, but endpoint submission remains app-specific and server-validated.
- No service worker is added.
- No auth refresh strategy is implemented.
- Final payment recording still uses existing online server APIs during sync.
- No final receipt number is generated offline.
- No permanent stock deduction/reservation before server sync, balance update, accounting effect, notification, or receipt persistence happens offline.
- Dev ERP booking/calendar settings and Google Calendar sync remain online-only.
- Delivery and full POS workflow coverage are not offline-enabled yet.
- UI components are passive indicators only.

## Testing Notes

Run package tests:

```bash
pnpm --filter @faako/offline-sync run test
```

Manual app checks:

- REEBS admin shell shows online/offline indicator.
- REEBS Store Mode restores a local POS draft after refresh and clears it after successful online sale.
- REEBS Store Mode saves offline POS sales as pending `CREATE_POS_ORDER` queue items and syncs them through the existing order endpoint when online.
- REEBS order payment forms restore local unsent drafts, queue offline `RECORD_PAYMENT` items, sync through the existing order payment endpoint when online, and clear only after confirmed success.
- REEBS Inventory saves offline stock adjustments as pending `ADJUST_STOCK` queue items and syncs them through the existing stock endpoint when online.
- REEBS Bookings saves offline booking create/edit/status actions as pending booking queue items and syncs them through the existing bookings endpoint when online.
- REEBS Admin Workspace Offline Sync shows a shared review panel with pending, failed, conflict, needs-review, retrying, cancelled, and resolved queue counts plus retry/cancel/mark-resolved controls.
- Dev ERP Rent queues new offline rent payments as pending `RECORD_PAYMENT` items and syncs them through the existing rent payment endpoint when online.
- Dev ERP Settings shows a shared review panel for local Dev ERP queue items, including failed or needs-review rent payment records.
- Dev ERP topbar shows online/offline indicator.
- Existing online submit/save flows still use current online APIs.
- Failed queued POS/payment/inventory/booking sync attempts remain local as `needs_review` or `failed`.

## Future Work

- WhatsApp receipt sharing.
- Auth-aware offline session guardrails.
- App-specific queue adapters.
- Server-side sync endpoint contracts.
- Idempotency and conflict handling.
- Audit logging for sync attempts and outcomes.
- Offline-safe finance queue.
- Booking, inventory, delivery, and receipt draft integration.
