# Reebs Backend Documentation

## Overview
The backend is an Express API wrapper that adapts the existing Node handler modules. Data is stored in PostgreSQL. Prisma is used for schema and migrations, but the handlers primarily use `pg` directly.

Key responsibilities:
- Auth (staff login + manager PIN)
- Inventory, orders, and bookings
- Stock movements + maintenance logs
- Accounting, expenses, invoicing
- Delivery planning and HR records
- Marketing discounts
- Organization-scoped dashboard aggregates and optional read-only Python analytics

## Advanced Analytics Boundary

- `GET /api/advancedAnalytics` is restricted to users with `financials:read`.
- The Node handler reads organization-scoped aggregates for revenue, booking demand,
  stock velocity, and customer repeat activity.
- When `FAAKO_ANALYTICS_SERVICE_URL` (or the legacy REEBS alias) is configured,
  Node sends only those tenant-scoped aggregates to the shared isolated FastAPI
  service at the temporary `services/reebs-analytics` compatibility path.
- The Python service has no database connection and cannot mutate orders, payments,
  bookings, inventory, or customers.
- Node validates the returned organization scope and falls back to local deterministic
  forecasting if the service is unavailable.

## Runtime and Data Access
- API wrapper lives in `backend/server.js`.
- Handler source lives in `backend/functions/*.js` for compatibility during the migration.
- Production base URL: `https://api.reebspartythemes.com/api/*`.
- Legacy `/api/*` remains an API-server alias while browser calls migrate to `/api/*`.
- Each function now loads the shared runtime env helper, resolves `DATABASE_URL` from the active app environment, and uses `resolvePgSslConfig()` so local Postgres can run with `DATABASE_SSL_MODE="disable"` while hosted Postgres keeps SSL enabled.
- The standalone API adapter limits active handlers with `REEBS_API_CONCURRENCY_LIMIT`
  (default `2`) to avoid overwhelming the hosted PostgreSQL proxy.
- Failed read-only GET handlers are retried up to `REEBS_API_READ_RETRY_LIMIT`
  times (default `2`) with exponential backoff starting at
  `REEBS_API_READ_RETRY_DELAY_MS` (default `180`). Mutation requests are never
  retried automatically.
- `prisma/schema.prisma` is the source of truth for table definitions.
- `prismaClient.js` configures Prisma with the Postgres adapter (used by scripts).

## Authentication
### Staff Login
- Endpoint: `POST /api/login`
- Validates user credentials from the `user` table.
- Passwords are hashed with `utils/passwords.js` (scrypt).
- Sets a signed session token only in the secure HttpOnly session cookie and returns safe user/session metadata without the raw token.

### Manager Login (Mobile App)
- Endpoint: `POST /api/managerLogin`
- Expects 6-digit PIN, checked against `MANAGER_PIN_HASH`.
- Returns manager token signed with `MANAGER_APP_SECRET`.

### Token Handling
- Staff cookie sessions are validated by `requireUser()` in `backend/functions/_shared/userAuth.js`. Bearer-token parsing remains temporarily for supported legacy non-browser clients but is not emitted by login responses.
- Manager token is validated by `getManagerFromEvent()` in `backend/functions/_shared/managerAuth.js`.
- Frontend includes credentials for cookie sessions. An already-present legacy token may still be attached during the temporary compatibility period.

## Organization Scoping
- `backend/functions/_shared/organization.js` resolves `organizationId` from:
  - `x-organization-id` header
  - `organizationId` in query/body
  - fallback to user organization
- Frontend `patchOrganizationFetch()` automatically attaches org ID + auth token.

## Money Handling
- All money is stored in integer cents in the DB.
- Functions convert to and from cents when needed.

## Data Model Summary
Main tables from `prisma/schema.prisma`:
- Organization: multi-tenant root entity
- User: staff accounts with roles and permissions
- EmployeeProfile: HR details per user
- Customer: buyer or booking client
- Product: unified catalog for retail and rentals
- Order + OrderItem: retail sales
- Booking + BookingItem: rental reservations
- StockMovement: stock in/out audit log
- Expense: operational expenses
- Discount: marketing codes
- Vendor: suppliers
- MaintenanceLog: asset maintenance history
- Document: stored documents and invoices (base64 data)
- Timesheet: employee clock-in/out
- Delivery: booking delivery status + route metadata
- BouncyCastle, IndoorGame, Machine, ShopItem: specialized catalog metadata
- ManagerDevice: Expo push tokens for manager app

## API Reference
Below is a concise map of each API handler.

## Request/Response Examples
Headers used in most staff-auth endpoints:
- `Authorization: Bearer <token>`
- `x-organization-id: <orgId>` (also accepted via query/body)

### Staff Login
Request:
```http
POST /api/login
Content-Type: application/json

{"email":"staff@example.com","password":"supersecret"}
```

Response:
```json
{
  "id": 12,
  "firstName": "Ama",
  "lastName": "Mensah",
  "fullName": "Ama Mensah",
  "email": "ama_mensah@reebs.com",
  "role": "staff",
  "organizationId": 1,
  "authenticatedAt": "2026-07-18T10:00:00.000Z",
  "sessionCreatedAt": "2026-07-18T10:00:00.000Z",
  "sessionLastSeenAt": "2026-07-18T10:00:00.000Z",
  "expiresInHours": 168
}
```

### Inventory (List)
Request:
```http
GET /api/inventory
```

Response:
```json
[
  {
    "id": 101,
    "sku": "INV-CUPS-ABC",
    "name": "Paper cups",
    "inventoryProductCode": "CLOTHES",
    "category": "Party supplies",
    "sourceCategoryCode": "CLOTHES",
    "specificCategory": "Party supplies",
    "price": 12.5,
    "quantity": 120,
    "currency": "GHS",
    "status": true,
    "imageUrl": "/imgs/shopItems/img_1.png"
  }
]
```

### Create Order (Checkout)
Request:
```http
POST /api/createOrder
Content-Type: application/json

{"customerId":42,"items":[{"productId":101,"quantity":2,"price":12.5}],"deliveryMethod":"delivery","deliveryDetails":{"address":"East Legon, Accra","date":"2025-02-01","window":"11am-1pm"},"source":"checkout"}
```

Response:
```json
{
  "message": "Order created successfully",
  "orderId": 778,
  "orderNumber": "ORD-20250201-003",
  "assignedUserId": null,
  "updatedByUserId": null
}
```

### Create Booking (Public)
Request:
```http
POST /api/bookings
Content-Type: application/json

{"customerId":42,"eventDate":"2025-02-14","startTime":"Morning setup (7am - 11am)","venueAddress":"Spintex, Accra","items":[{"productId":501,"quantity":1}],"applyBundleDiscount":true,"status":"pending"}
```

Response:
```json
{
  "id": 455,
  "customerId": 42,
  "customerName": "Kwame Boateng",
  "eventDate": "2025-02-14T00:00:00.000Z",
  "status": "pending",
  "items": [
    { "id": 9001, "productId": 501, "quantity": 1, "price": 35000 }
  ]
}
```

### Stock Movement
Request:
```http
POST /api/stock
Content-Type: application/json

{"productId":101,"type":"StockOut","quantity":4,"notes":"Damaged items","reference":"ADJ-2025-02-10"}
```

Response:
```json
{
  "message": "StockOut successful.",
  "productId": 101,
  "newStock": 116,
  "lastUpdatedByName": "Ama Mensah"
}
```

### HR Profile Update
Request:
```http
PUT /api/hr
Authorization: Bearer <token>
Content-Type: application/json

{"id":12,"jobTitle":"Inventory Lead","phone":"+233501234567","emergencyContactName":"Nana K.","emergencyContactPhone":"+233541112233"}
```

Response:
```json
{
  "id": 12,
  "firstName": "Ama",
  "lastName": "Mensah",
  "fullName": "Ama Mensah",
  "email": "ama_mensah@reebs.com",
  "role": "staff",
  "jobTitle": "Inventory Lead",
  "phone": "+233501234567",
  "emergencyContactName": "Nana K.",
  "emergencyContactPhone": "+233541112233"
}
```

### Vendor Create
Request:
```http
POST /api/vendors
Authorization: Bearer <token>
Content-Type: application/json

{"name":"Party Supplies Ltd","contactName":"Kojo A.","phone":"+233541234000","leadTimeDays":3,"notes":"Delivers Wednesdays"}
```

Response:
```json
{
  "id": 7,
  "name": "Party Supplies Ltd",
  "contactName": "Kojo A.",
  "phone": "+233541234000",
  "leadTimeDays": 3,
  "notes": "Delivers Wednesdays"
}
```

### Expense Create
Request:
```http
POST /api/expenses
Authorization: Bearer <token>
Content-Type: application/json

{"category":"Logistics","amount":120.5,"description":"Fuel for delivery","date":"2025-02-15"}
```

Response:
```json
{
  "id": 223,
  "category": "Logistics",
  "amount": 12050,
  "description": "Fuel for delivery",
  "date": "2025-02-15T00:00:00.000Z",
  "userId": 12
}
```

### Document Upload
Request:
```http
POST /api/documents
Authorization: Bearer <token>
Content-Type: application/json

{"title":"Delivery Waiver","category":"Waiver","fileName":"waiver_2025_02_15.pdf","mimeType":"application/pdf","data":"<base64-data>"}
```

Response:
```json
{
  "id": 41,
  "title": "Delivery Waiver",
  "category": "Waiver",
  "fileName": "waiver_2025_02_15.pdf",
  "mimeType": "application/pdf",
  "size": 124566,
  "source": "upload",
  "createdAt": "2025-02-15T09:10:03.000Z"
}
```

### Financials Summary
Request:
```http
GET /api/financials?window=thisMonth
```

Response:
```json
{
  "window": "thisMonth",
  "orders": 34,
  "bookings": 12,
  "summary": {
    "revenue": 14500,
    "cogs": 3900,
    "rentalIncome": 5200,
    "grossProfit": 15800,
    "operatingExpenses": 2100,
    "netProfit": 13700
  }
}
```

### Marketing Discount Validate
Request:
```http
GET /api/marketing?code=WELCOME10
```

Response:
```json
{
  "id": 3,
  "code": "WELCOME10",
  "type": "PERCENTAGE",
  "value": 10,
  "minOrderValue": 0,
  "expiryDate": "2026-01-31",
  "scope": "both",
  "segment": "all",
  "reward": "10% off your first order",
  "usageCount": 4,
  "isActive": true
}
```

### Delivery Upsert
Request:
```http
POST /api/deliveries
Content-Type: application/json

{"bookingId":455,"status":"scheduled","driverName":"Yaw Doe","routeGroup":"Route A","routeOrder":3,"eta":"1:30pm","notes":"Call on arrival"}
```

Response:
```json
{
  "id": 19,
  "bookingId": 455,
  "status": "scheduled",
  "driverName": "Yaw Doe",
  "routeGroup": "Route A",
  "routeOrder": 3,
  "eta": "1:30pm",
  "notes": "Call on arrival",
  "updatedAt": "2025-02-15T10:14:22.000Z"
}
```

### Generate Invoice (Order)
Request:
```http
GET /api/generateInvoice?orderId=778
```

Response:
```json
{
  "invoiceNumber": "REC-ORD-20250201-003",
  "orderId": 778,
  "date": "01/02/2025",
  "customer": { "id": 42, "name": "Kwame Boateng" },
  "summary": { "subtotal": 250, "taxRate": 0, "taxTotal": 0, "grandTotal": 250 }
}
```

### Booking Invoice Details
Request:
```http
GET /api/getInvoiceDetails?id=455
```

Response:
```json
{
  "id": 455,
  "customerName": "Kwame Boateng",
  "eventDate": "2025-02-14T00:00:00.000Z",
  "totalAmount": 35000,
  "items": [{ "productId": 501, "quantity": 1, "price": 35000 }]
}
```

### Auth
- `POST /api/login`
  - Body: `{ email, password }`
  - Returns: `{ id, fullName, role, organizationId, token, expiresInHours }`
- `POST /api/managerLogin`
  - Body: `{ pin }`
  - Returns: `{ token, expiresInHours }`
- `POST /api/managerTokens`
  - Auth: manager token required
  - Body: `{ token, platform, deviceId }`
  - Registers Expo push token in `managerDevice`

### Users and HR
- `GET /api/users` (auth required)
  - Lists staff users.
- `POST /api/users` (auth required)
  - Creates staff user with generated email and hashed password.
- `PUT /api/users` (auth required)
  - Updates name, role (system admin only), permissions, password.
- `GET /api/hr` (auth required)
  - Staff directory with HR profile data + activity counts.
- `PUT /api/hr` (auth required)
  - Updates user profile + employee profile fields.

### Customers
- `GET /api/customers`
  - Auth required for full list and customer-by-id.
  - Supports lookup by `email`, `phone`, or `name` (used by checkout/booking).
- `POST /api/customers`
  - Creates or upserts a customer (checkout and booking use this).
- `PUT /api/customers` (auth required)
  - Updates customer name/email/phone.

### Inventory and Stock
- `GET /api/inventory`
  - Lists products; supports `?view=archived|deleted`.
- `POST /api/inventory`
  - Upserts a product. Generates SKU for new items.
- `PATCH /api/inventory`
  - Actions: `archive` or `unarchive`.
- `DELETE /api/inventory`
  - Soft-delete (admin only).
- `POST /api/stock` (auth required)
  - Records StockIn/StockOut and updates product stock.
- `GET /api/stockActivity`
  - Monthly stock in/out aggregates.
- `GET /api/inventoryCounts`
  - Counts rental vs retail products.

### Orders
- `POST /api/createOrder`
  - Creates order + order items + stock movements.
  - Auth optional if `{ source: "checkout" }`.
  - Sends WhatsApp + push notifications to manager.
- `GET /api/orders` (auth required)
  - Lists orders or `?orderId=123` for detail.
- `PUT /api/orders` (auth required)
  - Updates order status; cancels restock items.
- `GET /api/orderStats`
  - Dashboard KPIs: revenue, low stock, conflicts, bookings, etc.
- `GET /api/userStats`
  - User KPIs for dashboard; add `?details=1` to include lists.

### Bookings (Rentals)
- `GET /api/bookings` (auth required)
  - Full booking list with items and staff attribution.
- `POST /api/bookings`
  - Creates a booking (public booking form uses this).
  - Enforces rental-only items and auto-adds pump items.
  - Applies bundle discounts when eligible.
- `PUT /api/bookings` (auth required)
  - Updates booking and items.
- `GET /api/managerBookings` (manager token)
  - Lightweight list for the mobile manager app.

### Delivery
- `GET /api/deliveries`
  - Delivery board (booking + items + driver info).
- `POST /api/deliveries`
  - Upserts a delivery record for a booking.
- `PUT /api/deliveries`
  - Updates delivery status/route/driver.

### Maintenance
- `GET /api/maintenance`
  - List maintenance logs.
- `POST /api/maintenance`
  - Create a maintenance log and mark product inactive.
- `PUT /api/maintenance`
  - Update status and re-activate product when resolved.

### Vendors
- `GET /api/vendors` (auth required)
  - Vendor list with related product names.
- `POST /api/vendors` (auth required)
  - Create vendor.
- `PUT /api/vendors` (auth required)
  - Update vendor.

### Timesheets
- `GET /api/timesheets`
  - Requires `userId` in header or query.
  - Returns active shift, history, and weekly/monthly totals.
- `POST /api/timesheets`
  - Toggles clock in/out for the user.

### Expenses and Financials
- `GET /api/expenses` (auth required)
  - Lists expenses with optional `?month=YYYY-MM` filter.
  - Returns maintenance costs as expense rows.
- `POST /api/expenses` (auth required)
  - Adds an expense. Supports linking to order or booking.
  - Supports `seed: true` to insert sample expenses.
- `GET /api/financials`
  - Revenue, cost, margin, and cashflow summaries by time window.

### Invoices and Documents
- `GET /api/documents` (auth required)
  - Lists documents or fetches a document by id.
- `POST /api/documents` (auth required)
  - Stores a base64-encoded document.
- `GET /api/generateInvoice`
  - Generates invoice data for an order (`orderId` query param).
- `GET /api/getInvoiceDetails`
  - Returns booking invoice details (`id` query param).

### Marketing and Discounts
- `GET /api/marketing`
  - Lists discounts or validates a code with `?code=XYZ`.
- `POST /api/marketing`
  - Creates discounts or seeds samples with `{ seed: true }`.
- `PUT /api/marketing`
  - Toggles `isActive` for a discount.

### Catalog Helpers
- `GET /api/bouncy_castles`
- `GET /api/indoor_games`
- `GET /api/machines`

### Geocoding
- `POST /api/geocode`
  - Body: `{ address }`
  - Uses OpenStreetMap Nominatim, falls back to Google if `GOOGLE_MAPS_API_KEY` is set.

### Ops Hub KPIs
- `GET /api/opsHubKpis`
  - Requires `userId` and admin/owner role.

### Manager Orders (Mobile)
- `GET /api/managerOrders`
  - Manager token required.
  - Returns recent orders for the mobile app.

## Notifications
- WhatsApp notifications: `backend/functions/_shared/whatsapp.js`
  - Requires `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_MANAGER_PHONE`.
- Expo push notifications: `backend/functions/_shared/managerPush.js`
  - Requires manager device tokens in `managerDevice` table.

## Scripts and Imports
- Data import scripts: `importUsers.js`, `importProducts.js`, `importOrders.js`, `importVendors.js`, etc.
- Password tooling: `scripts/rehashPasswords.js`, `scripts/hashManagerPin.js`.
- Prisma migrations: `prisma/migrations/*`.

## Environment Variables (Backend)
Core:
- `DATABASE_URL`
- `USER_APP_SECRET`
- `MANAGER_APP_SECRET`
- `MANAGER_PIN_HASH`

Optional integrations:
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_MANAGER_PHONE`
- `GOOGLE_MAPS_API_KEY` (or `GOOGLE_GEOCODING_API_KEY`)
- `OPENAI_API_KEY` (used by `backend/utils/openaiClient.js` if AI search is enabled)

## Deployment and Ops
Cloudflare Pages + API service:
- Cloudflare Pages deploys the Vite frontend from `src/`.
- The API service runs `backend/server.js` and loads handlers from `backend/functions/*`.
- Recommended local command: `pnpm run dev:reebs`.
- Handlers run with Node runtime and read `DATABASE_URL` plus secrets from the hosted API env.

Railway (PostgreSQL):
- Primary database host for `DATABASE_URL`.
- SSL required (`rejectUnauthorized: false` is used in functions).
- Prisma migrations live in `prisma/migrations/*` and can be applied via `npx prisma migrate`.

Data imports:
- One-off import scripts exist in the repo root (`importUsers.js`, `importProducts.js`, etc.).
- These scripts use the same `DATABASE_URL` to seed or transform data.

## Related Files
- Functions: `backend/functions/*.js`
- Shared helpers: `backend/functions/_shared/*`
- Prisma schema: `prisma/schema.prisma`
- Password hashing: `utils/passwords.js`
