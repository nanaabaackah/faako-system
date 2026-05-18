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

- **`src/data/products.ts`** is the source of truth for the catalogue. It exports the `Product` type, the `Category` union, the `products` array, `categoryOptions`, `formatCurrency`, `getStockTone`, and `getProductById`. Both `Shop.tsx` and `ProductDetail.tsx` import from here. `Sitemap.tsx` also reads it to auto-generate the Products section. Don't reinstate inline product arrays in pages — update this module.
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
- `src/lib/paystack.ts` is a client-side Paystack Inline helper using `VITE_PAYSTACK_PUBLIC_KEY`. It cannot verify payment settlement without a backend verification endpoint and webhook. Treat checkout success as preview/client-side only until server verification exists.
- Recent Stroane route additions (`/signin`, `/signup`, `/checkout`) passed lint/type/build checks, but still need a production acceptance review for privacy, data retention, and fulfillment assumptions.

## Open questions

- What is the final production backend host and ownership model?
- Which purchasing or payment features are in scope for the initial client release?
- What client-facing acceptance checklist should block production deploys?
- Should the Contact form submit to a real backend endpoint instead of the current `mailto:` fallback?
- Should `CartContext` persist to `localStorage` so the basket survives reloads, or stay in-memory for the preview build?
- Final imagery for service 7 (Cold Storage Checks) and service 8 (Import & Export Support); featured Resources guide cover currently reuses `bg_2.png`.
- Should front-end-only sign-in/sign-up remain in the public release, or should it be held until backend-backed auth exists?
- Should checkout remain client-side preview only, or should backend Paystack verification block launch?

## Future cleanup

- Document production hosting and DNS once finalized.
- Add client-specific release notes once the deployment cadence is established.
- Keep API, CORS, and proxy configuration notes current as hosting changes.
- Use the platform cleanup audit before consolidating client-facing CSS, extracting shared UI pieces, or adding an app API client wrapper. Keep environment examples descriptive and never copy live secret values into docs.

## Risks to monitor

- Frontend/backend URL mismatches after deploy.
- CORS or trusted proxy misconfiguration affecting customers.
- Product, order, customer, or payment-adjacent data regressions.
- Public polish regressions that affect first paying client confidence.
- Exposed or misplaced environment values can affect production safety; rotate exposed credentials outside cleanup work and keep `.env` files out of documentation examples.
