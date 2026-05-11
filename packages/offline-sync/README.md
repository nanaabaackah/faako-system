# @faako/offline-sync

Shared offline infrastructure foundation for Faako ERP apps.

## What Changed

Added the Offline Foundation Wave. This package provides offline queue constants, sync status constants, conflict status constants, documented queue/sync shapes, IndexedDB queue storage helpers, memory queue helpers for tests, local draft storage helpers, retry metadata helpers, online/offline detection, passive React hooks, and small status UI components.

Offline POS/payment drafts now use the local draft helpers for work-in-progress browser storage. This package still does not sync real business actions to production, does not bypass auth or permissions, and does not change app persistence logic.

## Where It Lives

- `src/constants/`: sync states, queue action types, conflict statuses, and storage constants.
- `src/types/`: documented offline queue and sync metadata shapes.
- `src/storage/indexedDb.js`: IndexedDB wrapper for future browser queue storage.
- `src/storage/queueStorage.js`: queue item helpers plus IndexedDB and memory queue storage adapters.
- `src/storage/localDraftStorage.js`: scoped browser-local draft helpers for work-in-progress forms.
- `src/retry/retryMetadata.js`: retry metadata and retry timing helpers.
- `src/status/`: online/offline detector and aggregate sync status helpers.
- `src/hooks/`: `useOnlineStatus` and `useSyncStatus`.
- `src/components/`: `OfflineStatusBadge`, `PendingSyncBadge`, and `SyncStatusBanner`.
- `test/offlineSync.test.mjs`: low-risk unit tests for queue items, draft storage, retry metadata, and sync summaries.

## Queue Action Types

Future queue action constants include:

- `CREATE_CUSTOMER`
- `CREATE_POS_ORDER`
- `CREATE_ORDER`
- `RECORD_PAYMENT`
- `CREATE_BOOKING`
- `UPDATE_BOOKING_STATUS`
- `ADJUST_STOCK`
- `UPDATE_DELIVERY_STATUS`
- `ADD_DELIVERY_NOTE`

These constants are not wired to production sync yet.

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

## How To Use It

Passive online/offline indicator example:

```jsx
import { OfflineStatusBadge } from "@faako/offline-sync";

<OfflineStatusBadge />
```

Queue storage example for future draft-only work:

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

## Security Rules

- User must authenticate online before offline use.
- Backend must re-check auth and permissions during sync.
- Organization isolation must be preserved in every queued action.
- Sensitive settings, secrets, tokens, and private configuration should not be cached unnecessarily.
- Queued actions are untrusted client data and must be validated server-side later.
- Offline receipt previews must not be treated as official server-confirmed receipts.
- Local drafts must remain user/org scoped where possible and should store only the fields needed to restore the unfinished form.

## Environment Variables

None.

## Setup Or Migration Steps

None. No database migration, API migration, service worker, or production sync configuration is required.

## Data Impact

No server data changes. Draft helpers write only to browser-local storage for unfinished POS/payment form state.

## Security Impact

Offline infrastructure and local draft storage only, no unsynced production writes yet. The package documents and reinforces future server-side validation, organization isolation, permission rechecks, conflict handling, and audit logging requirements.

## Known Limitations

- No real business actions are queued by current app adoption.
- No production sync loop exists yet.
- No service worker is added.
- No auth refresh strategy is implemented.
- POS and manual payment support is draft-only; final sale/payment recording still uses existing online server APIs.
- No receipt, booking, inventory, delivery, or full POS workflow is offline-enabled yet.
- UI components are passive indicators only.

## Testing Notes

Run package tests:

```bash
pnpm --filter @faako/offline-sync run test
```

Manual app checks:

- REEBS admin shell shows online/offline indicator.
- REEBS Store Mode restores a local POS draft after refresh and clears it after successful online sale.
- REEBS order payment forms restore local unsent drafts and clear them after successful online payment recording.
- Dev ERP topbar shows online/offline indicator.
- Existing submit/save flows still require current online APIs.
- No queued action is sent to production.

## Future Work

- Queued offline POS order creation.
- Auth-aware offline session guardrails.
- App-specific queue adapters.
- Server-side sync endpoint contracts.
- Idempotency and conflict handling.
- Audit logging for sync attempts and outcomes.
- Offline-safe finance queue.
- Booking, inventory, delivery, and receipt draft integration.
