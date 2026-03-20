# Reebs Frontend Documentation

## Overview
Reebs is a hybrid ERP + ecommerce site built with React and Vite. The frontend is split into:
- Public storefront (Home, Shop, Rentals, Gallery, Contact)
- Checkout + booking flows (Cart, Checkout, Book)
- Admin console (inventory, orders, bookings, accounting, HR, etc.)

The app consumes Netlify Functions at `/.netlify/functions/*` (defaulting to `https://portal.reebspartythemes.com/.netlify/functions/*` for production).

## Stack
- React 19 + Vite
- React Router for routing
- Contexts for auth and cart state
- CSS files (global + page-specific)
- FontAwesome + Lucide for iconography
- Leaflet for maps
- Framer Motion for animation

## Entry Points and Boot
- `src/main.jsx` bootstraps the React app and calls `patchOrganizationFetch()`.
- `patchOrganizationFetch()` injects `x-organization-id` and `Authorization` headers on Netlify function calls.
- `src/App.jsx` wires routing, auth gating, cart overlay, and global UI shell.

## System Architecture (High Level)
```mermaid
flowchart LR
  Browser[Web Frontend (React/Vite)] -->|HTTPS| Functions[Netlify Functions API]
  Mobile[Manager App (Expo)] -->|HTTPS| Functions
  Functions -->|SQL| DB[(PostgreSQL)]
  Functions -->|Notifications| WhatsApp[WhatsApp Cloud API]
  Functions -->|Push| Expo[Expo Push Service]
  Functions -->|Geocode| OSM[Nominatim]
  Functions -->|Geocode (optional)| Google[Google Geocoding API]
```

## Route Map
Public pages:
- `/` -> Home
- `/about` -> About
- `/shop` -> Shop
- `/rentals` -> Rentals list
- `/rentals/:slug` -> RentalItem detail
- `/gallery` -> Gallery
- `/faq` -> FAQ
- `/contact` -> Contact
- `/book` -> Rental booking form
- `/cart` -> Cart
- `/checkout` -> Checkout
- `/privacy-policy`, `/refund-policy`, `/delivery-policy`, `/terms-of-service`

Auth and admin pages:
- `/login` -> Admin login
- `/admin` -> Admin dashboard (KPIs)
- `/admin/inventory` -> Inventory
- `/admin/orders` -> Orders list
- `/admin/orders/new` -> Manual order builder
- `/admin/bookings` -> Booking admin
- `/admin/schedule` -> Scheduler
- `/admin/accounting` -> Financials
- `/admin/expenses` -> Expenses
- `/admin/hr` -> HR profiles
- `/admin/documents` -> Documents and invoices
- `/admin/timesheets` -> Timesheets
- `/admin/vendors` -> Vendors
- `/admin/maintenance` -> Maintenance logs
- `/admin/delivery` -> Delivery board
- `/admin/roles` -> Roles and permissions
- `/admin/settings` -> Settings
- `/admin/customers` -> Customers
- `/admin/invoicing` -> Invoicing
- `/admin/marketing` -> Marketing and discounts

Protected routes use `RequireAuth` in `src/App.jsx`. Some admin routes are blocked on mobile via `MobileRestricted`.

## State Management
### AuthContext
Location: `src/components/AuthContext.jsx`
- Stores the logged-in user and token in localStorage or sessionStorage.
- `login(email, password, remember)` calls `/.netlify/functions/login` and stores token.
- `logout()` clears stored user and token.
- `updateUser()` merges profile updates and keeps token.

### CartContext
Location: `src/components/CartContext.jsx`
- Cart items stored in localStorage.
- Fetches currency exchange rates from `v6.exchangerate-api.com` (requires `VITE_CURRENCY_API_KEY`).
- Provides `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart`, `convertPrice`, `formatCurrency`.

### CurrencyContext (optional)
Location: `src/components/CurrencyContext.jsx`
- Supports fallback rates and a separate exchange API key (`VITE_EXCHANGE_API_KEY`).
- Not currently wired in `App.jsx`, but available for future use.

## API Integration
All API calls are routed through Netlify Functions under `/.netlify/functions/*`.
- `patchOrganizationFetch()` automatically adds `x-organization-id` and `Authorization` headers if present.
- Auth token is stored in `window.__reebsAuthToken` and local/session storage.
- Set `VITE_BACKEND_BASE_URL` to override the functions host (default: `https://portal.reebspartythemes.com`).

Caching:
- `src/utils/inventoryCache.js` caches inventory for 5 minutes in sessionStorage.
- `src/pages/Shop.jsx` has its own session cache for product lists.

## Key User Flows
### Shop
Location: `src/pages/Shop.jsx`
- Fetches inventory from `/.netlify/functions/inventory`.
- Filters out rental items (`sourceCategoryCode === "rental"`).
- Supports search, category filters, in-stock toggle, pagination, and a featured carousel.
- Requires auth state to be ready and authenticated before it loads inventory.

### Cart
- Cart is stored locally and rendered via `CartOverlay` and `Cart` page.
- Stock limits are enforced when adding/updating items.

### Checkout
Location: `src/pages/Checkout.jsx`
- Creates or finds customer via `/.netlify/functions/customers`.
- Submits order to `/.netlify/functions/createOrder` (manual payment flow).
- Persists checkout draft in localStorage.
- Does not process payments; it records intent and order details.

Sequence diagram (checkout):
```mermaid
sequenceDiagram
  participant User
  participant UI as Checkout Page
  participant CustomersAPI as /.netlify/functions/customers
  participant OrdersAPI as /.netlify/functions/createOrder
  participant DB as Postgres
  participant Notify as WhatsApp/Push

  User->>UI: Fill delivery + payment details
  UI->>CustomersAPI: POST customer (name/email/phone)
  CustomersAPI->>DB: Upsert customer
  DB-->>CustomersAPI: customerId
  CustomersAPI-->>UI: customerId
  UI->>OrdersAPI: POST order (items, delivery, source=checkout)
  OrdersAPI->>DB: Create order, items, stock movements
  DB-->>OrdersAPI: orderId/orderNumber
  OrdersAPI->>Notify: Send manager WhatsApp/push
  OrdersAPI-->>UI: Confirmation payload
  UI-->>User: Order confirmed message
```

### Rentals Booking
Location: `src/pages/Book.jsx`
- Loads rentals from `/.netlify/functions/inventory` and bouncy castle metadata from `/.netlify/functions/bouncy_castles`.
- Validates booking form, adds bundle discounts, and posts to `/.netlify/functions/bookings`.
- Uses localStorage to save draft bookings.

Sequence diagram (booking):
```mermaid
sequenceDiagram
  participant User
  participant UI as Booking Page
  participant CustomersAPI as /.netlify/functions/customers
  participant BookingsAPI as /.netlify/functions/bookings
  participant DB as Postgres
  participant Notify as WhatsApp/Push

  User->>UI: Select rentals + event details
  UI->>CustomersAPI: Lookup/create customer
  CustomersAPI->>DB: Find or create customer
  DB-->>CustomersAPI: customerId
  CustomersAPI-->>UI: customerId
  UI->>BookingsAPI: POST booking + items
  BookingsAPI->>DB: Create booking + items (auto-add pumps if needed)
  DB-->>BookingsAPI: bookingId
  BookingsAPI->>Notify: Send manager WhatsApp/push
  BookingsAPI-->>UI: Booking payload
  UI-->>User: Booking received
```

### Login
Location: `src/pages/Login.jsx`
- Uses `AuthContext.login()` to authenticate and redirect to `/admin`.

## Admin Console Modules
Each admin page consumes a focused API endpoint:
- Inventory: `/.netlify/functions/inventory`, `/.netlify/functions/stock`, `/.netlify/functions/stockActivity`
- Orders: `/.netlify/functions/orders`, `/.netlify/functions/createOrder`
- Bookings: `/.netlify/functions/bookings`, `/.netlify/functions/customers`
- Scheduler: `/.netlify/functions/bookings` + inventory and customer lookups
- Accounting/Financials: `/.netlify/functions/financials`, `/.netlify/functions/orders`, `/.netlify/functions/bookings`
- Expenses: `/.netlify/functions/expenses`
- HR: `/.netlify/functions/hr`
- Documents + Invoicing: `/.netlify/functions/documents`, `/.netlify/functions/generateInvoice`, `/.netlify/functions/getInvoiceDetails`
- Timesheets: `/.netlify/functions/timesheets`
- Vendors: `/.netlify/functions/vendors`
- Maintenance: `/.netlify/functions/maintenance`
- Delivery: `/.netlify/functions/deliveries`
- Marketing/Discounts: `/.netlify/functions/marketing`
- Dashboard KPIs: `/.netlify/functions/orderStats`, `/.netlify/functions/userStats`

## UI and Styling
- Global styles: `src/index.css`, `src/styles/reset.css`.
- Page styles: `src/pages/master.css` and per-component CSS files.
- `ClickSpark` adds cursor spark effects site-wide.
- `BackToTop` provides navigation back to the top of long pages.

## Testing
- Playwright tests live in `tests/` with config in `playwright.config.ts`.
- Run with `npm run test:e2e` or `npm run test:e2e:ui`.

## Local Development
- Frontend only: `npm run dev`
- Full stack with Netlify functions: `npm run netlify`

## Environment Variables (Frontend)
- `VITE_CURRENCY_API_KEY` for CartContext exchange rates.
- `VITE_EXCHANGE_API_KEY` for CurrencyContext (optional).

## Related Files
- Routing and layout: `src/App.jsx`
- Boot + fetch patching: `src/main.jsx`, `src/utils/organization.js`
- Auth: `src/components/AuthContext.jsx`
- Cart + currency: `src/components/CartContext.jsx`, `src/components/CurrencyContext.jsx`
- Inventory cache: `src/utils/inventoryCache.js`
