# Stroane Inventory Management Module

The portal inventory module lives at `/admin/inventory` and is the operational hub for product stock.

## Current Scope

- Loads inventory items, suppliers, recent movements, alerts, products, and categories.
- Lets portal admins update stock counts, thresholds, supplier assignment, SKU, purchasable state, backorders, and stock notes.
- Lets portal admins record inventory movements: restock, damage, adjustment, manual correction, reserved, and released.
- Lets portal admins update basic catalogue product details from the selected inventory item: name, SKU, price, currency, category, publishing status, featured state, and short description.
- Uses local cached inventory data so the page remains viewable offline.
- Queues stock updates, movements, and product edits while offline, applies them optimistically to the local view, and syncs pending work through the authenticated API when the device is online again.

## API Touchpoints

- `GET /api/admin/inventory`
- `PATCH /api/admin/inventory/:id`
- `GET /api/admin/inventory/movements`
- `POST /api/admin/inventory/movements`
- `GET /api/admin/inventory/alerts`
- `GET /api/admin/suppliers`
- `GET /api/admin/products`
- `PATCH /api/admin/products/:id`
- `PATCH /api/admin/products/:id/publishing`

## Offline Behavior

Inventory snapshots are cached in `localStorage` per portal user. Offline write actions use the shared `@faako/offline-sync` IndexedDB queue with the same Stroane portal scope as the dashboard queue.

Queued inventory action types:

- `UPDATE_INVENTORY_ITEM`
- `CREATE_INVENTORY_MOVEMENT`
- `UPDATE_CATALOGUE_PRODUCT`

The module processes pending inventory queue items automatically when `useOnlineStatus()` reports the device is online. Failed items remain visible in the module queue panel for retry, resolve, or cancel.

## Guardrails

- Admin-only writes are still enforced by the backend.
- The frontend validates non-negative whole-number stock fields and prevents reserved quantity from exceeding quantity on hand before saving.
- Zero available stock is rendered as `Out of stock`.
- `Unavailable` is only used when a tracked stock quantity has not been confirmed.
