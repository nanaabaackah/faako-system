# Stroane API Notes

## Current Public/Customer Endpoints

- `GET /health`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/products/:slug`
- `POST /api/inquiries`
- `POST /api/orders`
- `POST /api/orders/:orderId/paystack/initialize`
- `POST /api/paystack/verify`
- `POST /api/paystack/webhook`

Catalogue endpoints prefer persisted database rows when available and fall back to the local JSON seed when the API/database is unavailable or not yet seeded.

## Current Private Endpoints

- `POST /api/auth/login`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:orderId`
- `PATCH /api/admin/orders/:orderId/status`

Private endpoints require backend `SiteUser` auth. Public customer sign-in/sign-up is not a backend security boundary.

## Planned Inventory/Supplier Endpoints

Do not build frontend admin screens that assume these endpoints exist yet. Expected future API surface:

- `GET /api/admin/suppliers`
- `POST /api/admin/suppliers`
- `PATCH /api/admin/suppliers/:supplierId`
- `GET /api/admin/products/:productSlug/suppliers`
- `POST /api/admin/products/:productSlug/suppliers`
- `GET /api/admin/inventory`
- `GET /api/admin/inventory/:inventoryItemId`
- `POST /api/admin/inventory/adjustments`
- `POST /api/admin/inventory/restocks`
- `GET /api/admin/inventory/:inventoryItemId/movements`
- `GET /api/admin/inventory/audit`

## Inventory Rules To Preserve

- Frontend stock is display-only.
- Backend checkout/payment initialization must validate availability server-side.
- Orders should not reserve or deduct stock until a separate order-inventory workflow is designed.
- Low stock is computed from confirmed available quantity and thresholds.
- Unknown stock should remain non-purchasable.
- Supplier cost and restock notes should stay private.

## Rate Limit And Security Expectations

Use route-specific backend protection plus Railway/provider-level request controls for deployed write routes. Inventory/supplier endpoints should require backend admin auth and should log safely without exposing supplier cost details or customer data.
