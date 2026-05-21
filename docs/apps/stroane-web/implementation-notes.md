# Stroane Web Implementation Notes

## Purpose

Capture technical notes, open questions, cleanup targets, and risks for Stroane Web without changing application behavior.

## Known technical notes

- The app uses a React and TypeScript frontend, Express backend, and Prisma-managed PostgreSQL database.
- Netlify is recommended for the frontend while the backend may run separately.
- Hostinger can remain the DNS host while the domain points to Netlify.
- `VITE_BACKEND_BASE_URL` controls whether the frontend calls an external backend origin.
- `TRUST_PROXY_HOPS` should match trusted reverse proxy topology when rate limiting relies on client IPs.
- `docs/platform/codebase-cleanup-audit.md` flags Stroane cleanup opportunities around repeated card/button/header/page styles, API fetch wrapper duplication, and component extraction candidates such as Shop, Product/User Management, and header surfaces.

### Shared modules introduced in the 2026-05 redesign sweep

- **`src/data/stroaneCatalogue.json`** is the normalized seed source for the product catalogue. It stores business profile metadata, categories, and products with brand, SKU, descriptions, features, pricing, quote-only flags, availability placeholders, tags, use cases, inquiry CTAs, and source references. It is intentionally data-driven so catalogue content is not pasted into page components.
- **`src/data/products.ts`** is the typed storefront helper layer for the catalogue. It exports `Product`, `CatalogueCategory`, `BusinessProfile`, `products`, `categories`, `categoryOptions`, `formatCurrency`, `formatProductPrice`, `getLineTotal`, `isPricedProduct`, `normalizeProduct`, `normalizeProducts`, `shouldUseLocalCatalogueFallback`, `getStockTone`, and `getProductById`. Shop, Product Detail, Product List, Search, Sitemap, and Checkout should import from here instead of rebuilding product arrays.
- **`src/context/CartContext.tsx`** holds the shopping basket as `Record<string, number>` (productId -> qty) plus `totalCount`, `getQty`, `increment`, `decrement`, `remove`, and `clear`. The provider wraps the app in `main.tsx` inside `AuthProvider`. State is in-memory only; refreshes clear the basket unless a future persistence step is added.
- **`src/components/QuantityControls.tsx`** is the shared add/qty/trash widget used by Shop cards (`size="sm"`) and the Product Detail page (`size="lg"`). Owns its own styles in `src/styles/components/QuantityControls.css`. Don't duplicate this in new pages — reuse the component and let `useCart()` drive props.
- **`src/components/LegalLayout.tsx`** is the shared template for `/terms`, `/privacy`, `/cookies`. Pages pass `title`, `lastUpdated`, optional `intro`, and an array of `{ heading, body }` sections; the layout handles the breadcrumb, "on this page" TOC, numbered headings with anchors, and the footer link to Contact. Use this for any future policy or legal page rather than rebuilding the structure.
- **`src/components/ScrollToTop.tsx`** is mounted by `Layout` so every page gets the bottom-right scroll-to-top button automatically. It hides until `window.scrollY > 300`.

### Header variant logic

- `src/components/Header.tsx` carries a `HERO_ROUTES` set of paths that have an image hero (`/`, `/about`, `/services`, `/shop`, `/resources`, `/contact`). On those routes the header starts transparent (white text/icons) and switches to the solid `--scrolled` variant after `scrollY > 40`.
- Every other route renders solid from page load via `isDark = scrolled || !hasHero`. An additional `page-header--static` modifier suppresses the `slideDown` keyframe so the solid header doesn't animate on every navigation.
- When adding a new public page, decide whether it has an image hero. If yes, add the path to `HERO_ROUTES`. If no, do nothing — the dark variant kicks in automatically.

### Page layout — full-width by default (2026-05-15)

- `#root` no longer has `padding: 1rem`. The entire site is edge-to-edge / full-bleed by default.
- The old pattern of `margin: -1rem -1rem 0; width: calc(100% + 2rem)` on page wrappers (used to "break out" of the `#root` gutter) has been removed everywhere — About, Services, Resources, Shop, Contact, Sitemap, LegalLayout, Footer, and Home's services section. **Do not reintroduce this hack.** New pages are full-width automatically; just use each section's own internal padding for content insets.
- The only element that intentionally keeps a viewport gutter is the **homepage hero** (`.hero-section`). The gutter is set in plain CSS in `Home.css` (`margin: 1.5rem 1.5rem 0;`, reduced to `1rem 1rem 0` under 768px) — **not** via Tailwind utilities. Tailwind v4 is installed with v3-style `@tailwind` directives and `Home.css` is imported after the utility layer, so utility margins on the hero were unreliable; the explicit CSS rule is the source of truth. Adjust the gutter there, not in `#root` or via Tailwind classes.

### Header responsive rules

- The hamburger menu button (`.page-header__menu-btn`, `.hero-header__menu-btn`) is hidden at `min-width: 901px` via Header.css. On desktop the inline nav links handle navigation; only mobile shows the hamburger. The mobile nav-sheet close button (`.mobile-nav-sheet__close`) is unaffected and stays visible inside the slide-out.

### Stabilization notes - 2026-05-17

- Stroane lint now depends on `typescript-eslint` and uses a flat-config-compatible `eslint.config.js` with separate browser and Node contexts. Keep `typescript-eslint` in `devDependencies` while the app contains TypeScript pages and backend JS files.
- The current `AuthContext` is front-end-only customer auth using browser localStorage. It is not server-enforced account security and should not protect admin, payment, or sensitive customer workflows without a backend session model.
- `src/lib/paystack.ts` is a legacy client-side Paystack Inline helper using `VITE_PAYSTACK_PUBLIC_KEY`. It is not used by the current checkout. Current Paystack checkout initializes and verifies payments through the backend so `PAYSTACK_SECRET_KEY` stays server-side.
- Recent Stroane route additions (`/signin`, `/signup`, `/checkout`) passed lint/type/build checks, but still need a production acceptance review for privacy, data retention, and fulfillment assumptions.

### Catalogue and inquiry foundation - 2026-05-19

- Initial PDF content review was limited by local extraction tooling. Visual review confirmed thermometer catalogue branding/contact info, thermometer price-list items, and poster/signage examples. Apron details and full product copy still need manual review before final publishing.
- Current confirmed priced items from the price list are AstroAI IR Thermometer (GHS 900), Taylor Precision Large Dial Fridge/Freezer Thermometer (GHS 500), Taylor Pro Horizontal Strip Fridge/Freezer Thermometer (GHS 500), and Taylor Precision Fridge/Freezer Thermometer with suction cups (GHS 400).
- Poster/signage and apron items are represented as quote-only seed products with manual-review notes where exact pricing, variants, sizes, or images are not confirmed.
- `backend/src/catalogue.js` reads the same JSON seed and also exposes Prisma-backed public mappers for `CatalogueCategory` and `CatalogueProduct`. `GET /api/categories`, `GET /api/products`, and `GET /api/products/:slug` should prefer persisted catalogue rows when available, then fall back to the JSON seed if the database is unavailable, empty, or not yet migrated.
- `POST /api/inquiries` validates and trims contact details, rejects a simple honeypot field if present, and persists a minimal `CatalogueInquiry` record when the additive migration has been deployed. It does **not** send automated email/WhatsApp/SMS, create orders, update inventory, or take payment.
- Product Detail uses `ProductInquiryForm` for product-specific requests across priced and quote-only products. Priced products keep the existing quote basket quantity controls; the inquiry form calls `/api/inquiries` and gives a direct email fallback if the API is unavailable.
- Dev ERP monitoring registry has optional Stroane API monitoring metadata for `/health`, `/api/products`, and `/api/categories`; it only appears when `STROANE_API_BASE_URL`, `STROANE_BACKEND_BASE_URL`, or monitoring-process `VITE_BACKEND_BASE_URL` is provided.

### Catalogue frontend and inquiry workflow completion - 2026-05-19

- `src/hooks/useCatalogueData.ts` centralizes API-first catalogue reads with local JSON fallback. Use it for public catalogue browsing surfaces instead of duplicating `fetch` and fallback state.
- `/shop` now uses the shared hook for product/category data and displays fallback/loading notices, category overview cards, category tabs, category counts, search, sort, result counts, mapped product imagery, and richer product-card summaries.
- `/products` now uses the same hook and displays image-led cards backed by the same normalized catalogue structure.
- Product Detail now attempts `GET /api/products/:slug` and falls back to the local seed. The backend route also catches persisted-table lookup failures and falls back to the seed response, so product pages remain usable during backend/database rollout.
- Product Detail exposes long descriptions, availability notes, normalized specification entries, use cases, related products, and product-specific inquiry forms without changing checkout/payment behavior.
- The Contact page now submits to `POST /api/inquiries` with `source: "contact_page"` when available. The user still gets a direct email fallback if the backend is unavailable.
- Product and contact inquiry forms include simple honeypot fields. Backend validation remains the source of truth; do not rely on frontend-only spam protection.
- No automated message sending, CRM/admin lead review screen, payment workflow, order workflow, or inventory automation was added.

### Product image extraction and mapping - 2026-05-19

- Product assets now live under `apps/stroane-web/public/images/products/` using lower-case slug filenames and WebP format. Keep new catalogue imagery in this folder and reference it from `src/data/stroaneCatalogue.json`, not directly from page components.
- Current mapped catalogue products: AstroAI IR Thermometer, Taylor Precision Large Dial Fridge/Freezer Thermometer, Taylor Pro Horizontal Strip Fridge/Freezer Thermometer, Taylor Precision Fridge/Freezer Thermometer with Suction Cups, Food Safety Posters Pack of 32, Fridge & Freezer Temperature Signage Bundle, Food Preparation Area Signage Bundle, and Food Safety Aprons.
- `src/data/stroaneCatalogue.json` now supports `thumbnailUrl`, `imageUrl`, `galleryImages`, and `imageAlt`. `src/data/products.ts` normalizes these fields and falls back to `/images/products/product-placeholder.webp` when a product has no mapped image.
- Extracted but not yet mapped as live catalogue products: AccuChef Digital Instant Read Thermometer, KitchenCraft Fridge Freezer Thermometer, and Alpha Grillers Instant Read Digital Thermometer. These need product/pricing review before adding catalogue entries.
- Source files used: `FOOD & FRIDGE THERMOMETERS PRICE LIST.pdf`, `Food and Fridge Thermometers Catalogue (2).pdf`, and `STROANE BROCHURE FOR THERMOMETERS, POSTERS & APRONS (1).pdf`.
- Manual review still needed: confirm crop quality with Stroane, replace catalogue-derived images with final product photography if supplied, verify apron variants/sizes/pricing, and decide whether extracted future thermometer assets should become products.

### Commerce and checkout foundation - 2026-05-20

- `src/context/CartContext.tsx` persists only product IDs and quantities in `localStorage` under `stroane_cart_v1`. It does not store customer details, payment references, prices, or sensitive data locally.
- `src/data/products.ts` now distinguishes priced products from purchasable products. `isPricedProduct` only means the catalogue has a numeric price; `canPurchaseProduct`/`isCheckoutEligibleProduct` additionally require confirmed purchasability, supported stock status, and enough stock where stock counts are known.
- Catalogue products support storefront availability fields: `stockQuantity`, `stockStatus`, `lowStockThreshold`, `allowBackorder`, and `isPurchasable`. Use statuses `in_stock`, `low_stock`, `out_of_stock`, `preorder`, and `unavailable`.
- PDF-imported seed products default to `stockQuantity: null`, `stockStatus: unavailable`, and `isPurchasable: false`. Real stock counts must be entered before online purchasing is enabled for those products.
- Inquiry is a fallback path for unavailable, enquiry-only, price-unavailable, or custom-order products. It should not replace visible customer-facing availability for normal purchasable products.
- `backend/src/orders.js` validates product price, purchasability, stock status, stock quantity, and backorder flags before preparing an order. This is storefront stock gating only; it does not deduct stock or create inventory ledger entries.
- `src/pages/Checkout.tsx` is now a pending-order review flow. Customers enter contact/delivery details, review the order summary, then submit an order request. The page does not call Paystack or collect payment.
- `backend/src/orders.js` validates checkout payloads, rejects honeypot submissions, resolves catalogue products, rejects quote-only items, and recalculates line totals server-side. Frontend totals are display-only.
- `POST /api/orders` persists `CommerceOrder` and `CommerceOrderItem` records only when the additive commerce migration has been deployed. The created order status is `PAYMENT_PENDING`, and the response includes Paystack preparation metadata with `status: "not_started"`.
- `prisma/migrations/20260520000000_add_commerce_order_foundation/migration.sql` creates `CommerceOrderStatus`, `CommerceOrder`, and `CommerceOrderItem`. Deploy only after confirming the target database, then test pending order creation before enabling customer-facing checkout links in production.
- Paystack integration uses server-side env values: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_CALLBACK_URL`, and `PAYSTACK_CURRENCY`. Secrets must stay out of `VITE_*` variables. Signed webhook verification plus Paystack transaction verification now gates paid status; a separate payment event log is still needed for strict replay/idempotency review.
- No inventory deduction, warehouse tracking, advanced fulfillment, CRM automation, admin order-management view, subscriptions, or payment capture was added.

### Paystack checkout MVP - 2026-05-20

- Payment flow: checkout creates a pending order through `POST /api/orders`, then calls `POST /api/orders/:orderId/paystack/initialize`. The backend verifies the stored order total from order items, initializes Paystack with the server-side secret key, stores the Paystack reference/status metadata, and returns the authorization URL for redirect.
- Callback flow: Paystack returns the customer to `/checkout/return` with `reference`/`trxref`. The return page calls `POST /api/paystack/verify`, and the backend verifies the reference against Paystack before returning a customer-friendly status. This endpoint is a status check only for successful payments and does not finalize paid status unless the order was already confirmed by webhook.
- Paid status rule: an order is marked `PAID` only from the signed Paystack webhook path after the backend calls Paystack's transaction verify endpoint and the verified reference, amount, and currency match the stored order. Failed or abandoned statuses keep the order available for follow-up.
- Current payment statuses are `payment_pending`, `paid`, `failed`, and `abandoned` in `CommerceOrder.paymentStatus`.
- `paymentMetadata` stores a safe subset only: provider, reference, status, gateway response, channel, currency, amount, paid/transaction dates, verification timestamp, and test-mode flag. Do not store card details, MoMo wallet details, authorization payloads, or secrets.
- Env values: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_CALLBACK_URL`, `PAYSTACK_CURRENCY`, and `PAYSTACK_ALLOW_LIVE`. `PAYSTACK_SECRET_KEY` must remain backend-only. Start with Paystack test keys (`sk_test_...`); `sk_live_...` is blocked unless `PAYSTACK_ALLOW_LIVE=true` is explicitly set server-side.
- Webhook processing is implemented at `POST /api/paystack/webhook` with raw body signature verification, event validation, reference lookup, Paystack transaction verification, verified amount/currency validation, safe metadata storage, duplicate paid-event short-circuiting, and payment-confirmed customer email trigger. Next phase should add a dedicated payment event/notification log before fulfillment automation, staff alerts, or multi-channel order updates.

### Paystack webhook verification - 2026-05-20

- `PAYSTACK_WEBHOOK_SECRET` is used for webhook signature verification. If blank, the backend falls back to `PAYSTACK_SECRET_KEY`, matching Paystack's standard server-side signature pattern. Neither value may be exposed through `VITE_*`.
- `express.json` stores the raw request body only for `/api/paystack/webhook` so the HMAC-SHA512 signature can be verified against `x-paystack-signature`.
- Supported webhook events are charge events. `charge.success` can mark a matching order paid only after the webhook reference matches a stored `paymentReference`, the backend verifies the transaction with Paystack, and the verified reference/amount/currency match the server-calculated order total/currency.
- Browser callback verification no longer sends confirmation email and no longer marks a successful Paystack status as paid while waiting for webhook confirmation. The customer sees a pending/processing message until the webhook-confirmed state exists.
- Existing paid orders are not downgraded by later failed/abandoned webhook statuses. Already-finalized paid orders return successfully without re-running the paid transition; if the customer email has not been sent yet, the backend may attempt the customer-safe confirmation email again.
- `paymentConfirmationSource`, `paymentWebhookEvent`, `paymentWebhookReference`, `paymentWebhookProcessedAt`, and `paymentWebhookMetadata` are additive webhook audit fields. They are not a complete event log; add a separate event table before retry tooling, replay dashboards, or fulfillment automation.

### Order notification foundation - 2026-05-20

- `backend/src/orderNotifications.js` builds customer-safe Stroane order messages for order received, payment confirmed, order processing, order completed, payment pending, and payment failed states. Templates include order number, item summary, totals, payment status, and customer contact details only.
- The current automated email MVP is limited to payment-confirmed email after the signed webhook path verifies the Paystack transaction and marks the order paid. Browser callback verification does not send confirmation email. The app does not send order-received, processing, completed, payment-failed, WhatsApp, or SMS messages automatically.
- Resend is called from the backend with `RESEND_API_KEY`, `ORDER_NOTIFICATION_FROM`, and `ORDER_NOTIFICATION_REPLY_TO`. Do not expose these as `VITE_*` variables.
- `CommerceOrder` now has additive notification metadata fields: `preferredContactMethod`, `customerNotificationStatus`, `customerNotificationType`, `customerNotificationSentAt`, `customerNotificationProviderId`, and `customerNotificationError`.
- Duplicate sends are reduced by checking `customerNotificationSentAt` before attempting another payment-confirmed email. This is not a complete idempotency/audit system; add a `NotificationLog` table before webhook-driven retries, staff dashboards, or multi-channel automation.
- WhatsApp and SMS helpers are templates only. Do not connect WhatsApp Business API or an SMS provider until consent, opt-out, retry, delivery-cost, and audit requirements are defined.
- Checkout now captures preferred contact method (`email`, `phone`, `whatsapp`) with email as the default. Backend validation still requires customer name, email, phone, delivery/pickup note, and server-priced items.

### Security and production readiness pass - 2026-05-20

- `backend/security.js` now reuses the shared `@faako/security` API header baseline instead of maintaining a separate one-off header implementation.
- `@faako/security` is an explicit Stroane workspace dependency; keep it in `apps/stroane-web/package.json` and `pnpm-lock.yaml` so backend tests and deployments resolve the shared package.
- Route-specific in-memory rate limits now sit on auth, inquiry, checkout, Paystack initialize, Paystack verify, and Paystack webhook routes. These supplement the global API limiter but are not a replacement for Railway/provider-level rate controls in production.
- `POST /api/orders/:orderId/paystack/initialize` now revalidates current catalogue price, currency, stock status, purchasability, and quantity before Paystack initialization. This catches product/stock changes between order creation and payment start.
- Paystack initialization metadata was minimized. The provider receives the order number and source only; raw internal order IDs and customer phone are no longer sent as custom metadata.
- Obsolete browser-visible preview-auth env examples (`VITE_AUTH_USERNAME`, `VITE_AUTH_PASSWORD`) were removed from `.env.example`. Do not add secret-like auth/password/session values with a `VITE_*` prefix.
- Privacy/legal copy now uses "pricing" instead of generic "quote" wording. Customer-facing commerce language should use "Price" and "Pricing"; reserve quote/request language for custom orders, unavailable stock, bulk/corporate inquiries, or special requests.
- Current public sign-in/sign-up remains frontend-only localStorage auth. It is intentionally retained for now, but must not protect admin, order, stock, payment, inquiry, or customer workflows.
- Backend `SiteUser` access should stay private and use one seeded `ADMIN` account and one seeded `VIEWER` account until a real admin/customer account model is approved.
- Railway Postgres is the chosen production database. Use server-only database URLs, keep browser database access unavailable, and prefer separate Railway runtime/migration credentials or roles where available.
- Add a dedicated payment event log and notification log before webhook replay tooling, retries, staff alerts, fulfillment automation, or multi-channel order updates.

### Lightweight admin order management - 2026-05-21

- `/admin/orders` is an unlinked private staff screen. It uses backend `SiteUser` login via `/api/auth/login`, not public frontend-only customer sign-in/sign-up.
- `/signin` now supports both customer local accounts and private backend staff credentials. If no local customer account matches, the page attempts backend `SiteUser` login and routes valid staff users to `/admin/orders`.
- `GET /api/admin/orders` and `GET /api/admin/orders/:orderId` require backend bearer auth and allow `ADMIN` or `VIEWER` roles. `PATCH /api/admin/orders/:orderId/status` requires `ADMIN`.
- Order list/detail responses include customer contact data because the route is protected, but Paystack references are masked and raw payment metadata/provider payloads are not returned.
- Admin status actions are intentionally limited to `paid`, `processing`, `ready`, `out_for_delivery`, `completed`, and `cancelled`.
- Payment status is not manually editable. `paid` status can only align the order status after webhook-confirmed payment already exists; it does not write `paymentStatus`.
- Fulfillment actions other than cancellation are blocked until payment is webhook-confirmed/paid.
- Additive `CommerceOrder` fields support lightweight fulfillment notes only: `fulfillmentStatus`, `deliveryMethod`, `expectedDeliveryDate`, `adminDeliveryNotes`, `internalNotes`, `statusUpdatedAt`, and `statusUpdatedById`.
- This is not a full ERP, inventory deduction system, delivery logistics module, CRM, staff notification system, or audit log. Add payment event/notification logs and stock admin separately before fulfillment automation.

### Commerce stabilization and Safari UI QA - 2026-05-21

- App-wide Stroane control styles now normalize buttons, inputs, selects, textareas, search fields, and date fields with `appearance: none`, `-webkit-appearance: none`, inherited fonts, iOS-safe 16px input sizing, and accessible focus behavior retained through existing page/component styles.
- `packages/ui/src/ui.css` applies the same native-control cleanup to shared buttons, ERP actions, icon buttons, field controls, selects, date/dropdown triggers, dropdown options, search inputs, and search clear buttons. Shared selects use a token-friendly CSS chevron instead of native Safari styling.
- Mobile viewport-sensitive surfaces now keep `vh` fallbacks and add `dvh` declarations for modern Safari/Chrome: Stroane checkout, auth, admin orders, error page, services sticky section, shared app screens, shared dropdown lists, and shared maintenance pages.
- Checkout and admin orders add safe-area bottom padding where controls may sit near iPhone home indicators.
- Payment callback QA found and fixed a small consistency issue: `/api/paystack/verify` now normalizes currency codes before comparing Paystack status-check data with the expected order currency. This does not change the rule that webhook verification is the trusted paid-state source.
- Backend route error logs for auth, catalogue, inquiry, order, Paystack initialize, Paystack verify, and unhandled errors now log sanitized message/status details instead of raw error objects.
- Static review confirmed the main commerce flow remains server-priced and stock-gated: cart stores product IDs/quantities only, checkout sends product slugs/quantities, backend recalculates totals, backend validates stock/purchasability before order creation and payment initialization, and paid state still requires signed webhook plus Paystack transaction verification.
- Remaining device QA: test checkout, cart, Paystack return, admin order forms, and product filters on real iPhone Safari against the deployed Netlify/Railway pairing before public purchasing is broadly promoted.

### Database and deployment foundation - 2026-05-19

- Recommended architecture: Hostinger remains DNS/email, Netlify hosts the frontend, Railway hosts the Express backend and production rate-limit layer, and Railway Postgres stores application data. Hostinger should not be the application database host unless a separate production decision is made.
- Prisma now has additive foundation models: `CatalogueCategory`, `CatalogueProduct`, `CatalogueInquiry`, and `BusinessProfileContent`. These sit beside the legacy `Product` model so existing data is not mutated.
- `prisma/migrations/20260519000000_add_catalogue_inquiry_foundation/migration.sql` creates the new tables and `CatalogueInquiryStatus` enum. Deploy with `pnpm --filter @faako/stroane-web run db:deploy:prod` after pointing env vars at the intended production database.
- `prisma/seed-catalogue.mjs` upserts category/product/business-profile content from `src/data/stroaneCatalogue.json`. It is opt-in and should be run only after the migration target is verified.
- Backend database URL resolution now prefers `DATABASE_URL_PRODUCTION` in production and `DATABASE_URL_DEVELOPMENT` in development, while still supporting a single Railway `DATABASE_URL`.
- Frontend env should only use browser-safe values such as `VITE_BACKEND_BASE_URL`. Database URLs, provider keys, inquiry notification keys, and future email/SMS/WhatsApp secrets must remain server-side.

### Portfolio registry preparation - 2026-05-19

- Shared project metadata now lives in `packages/config/src/projectRegistry/projectRegistry.js`.
- Stroane Web is registered as `Stroane Web / Stroane Solutions` with project type `Client Website / Product Catalogue`, public/client-safe metadata, current milestone, tech stack, feature list, live URL, screenshots placeholders, related docs path, and `caseStudyEnabled: false`.
- The byNana portfolio has not been redesigned or wired to consume this registry yet. Existing portfolio pages still use local content. Future consumption should filter through `getCaseStudyReadyProjects()` so disabled/private entries do not auto-publish.
- `pnpm run project-registry:check` validates registered project metadata and prints warning-only app coverage notes. It intentionally does not fail CI while the registry is being adopted.

## Open questions

- What is the final production backend host and ownership model?
- Which purchasing or payment features are in scope for the initial client release?
- What client-facing acceptance checklist should block production deploys?
- Should the Contact form submit to a real backend endpoint instead of the current `mailto:` fallback?
- Should `CartContext` persist to `localStorage` so the basket survives reloads, or stay in-memory for the preview build?
- Final imagery for service 7 (Cold Storage Checks) and service 8 (Import & Export Support); featured Resources guide cover currently reuses `bg_2.png`.
- Public sign-in/sign-up should remain in the public release as frontend-only customer convenience for now. It is not a backend auth boundary; private backend `SiteUser` access should stay limited to one seeded admin and one seeded viewer account until an admin/customer account model is approved.
- What acceptance checklist should be completed before the pending-order checkout is exposed broadly on the production domain?
- Should Paystack payment links be created immediately after pending order creation, or only after Stroane manually confirms availability/delivery?
- Should the catalogue keep quote-only products visible before final apron/poster pricing is verified?
- Should product inquiries also trigger staff email notifications, and what data retention policy should apply?
- Should product/category reads switch from JSON seed to database reads after the first production seed, or should JSON remain the public fallback source for now?
- What content approval process should unlock `caseStudyEnabled` for Stroane later, if any?
- Should `/shop` eventually replace `/products` as the single canonical catalogue route, or should both remain for SEO/backward compatibility?

## Future cleanup

- Document production hosting and DNS once finalized.
- Add client-specific release notes once the deployment cadence is established.
- Keep API, CORS, and proxy configuration notes current as hosting changes.
- Use the platform cleanup audit before consolidating client-facing CSS, extracting shared UI pieces, or adding an app API client wrapper. Keep environment examples descriptive and never copy live secret values into docs.
- Add a catalogue import script only after full PDF/OCR extraction is reliable. Until then, update `src/data/stroaneCatalogue.json` manually with source references and manual-review flags.
- Add a lightweight authenticated inquiry review screen only after access control and retention rules are approved.
- Expand order email/inquiry notification plumbing only after provider choice, secret handling, retry behavior, notification logging, and customer privacy language are approved.
- Wire byNana portfolio to the shared project registry only after deciding how project cards, private flags, screenshots, and case-study readiness should map into the current portfolio content model.
- Add final product photography and image alt-text review before production promotion.

## Risks to monitor

- Frontend/backend URL mismatches after deploy.
- CORS or trusted proxy misconfiguration affecting customers.
- Product, order, customer, or payment-adjacent data regressions.
- Catalogue pricing drift from source PDFs or supplier updates.
- Customer contact data handling if inquiry persistence/email routing is added later.
- Running migrations or seed scripts against the wrong database. Always verify `APP_ENV`, `DATABASE_URL_PRODUCTION`/`DATABASE_URL_DEVELOPMENT`, and migration status before deploy.
- Accidentally publishing a client case study before approval. Keep `caseStudyEnabled: false` until public copy and screenshots are reviewed.
- Public polish regressions that affect first paying client confidence.
- Exposed or misplaced environment values can affect production safety; rotate exposed credentials outside cleanup work and keep `.env` files out of documentation examples.
