# byNana Portfolio Astro migration

Status: Astro reference implementation, with a deliberately transitional React compatibility island.

## Outcome

The portfolio now builds eighteen static HTML documents with route-specific metadata, canonical URLs, social metadata, structured data, and headings. The prior public route set is retained, `/resume` is added, and project/blog detail URLs are generated from the current content records.

## Route and content parity

| Route | Prior Vite route | Current Astro output | Notes |
| --- | --- | --- | --- |
| `/` | yes | yes | Home content retained |
| `/about` | yes | yes | Content retained |
| `/resume` | no | yes | Current experience and skills route added |
| `/projects` | yes | yes | Current visible projects retained |
| `/projects/:slug` | yes | five static routes | Generated only for visible current projects |
| `/blog` | yes | yes | Listing retained |
| `/blog/:slug` | yes | five static routes | Current detail records generated |
| `/contact` | yes | yes | Form validation, endpoint option, and mail fallback retained |
| `/privacy` | yes | yes | Content retained |
| unknown route | client not-found view | static `404.html` | Real 404 status and noindex |

Current project slugs:

- `reconstruction`
- `development-tracker`
- `odoo`
- `kids-party-shop-rental`
- `portfolio`

Current blog slugs:

- `devfest`
- `snowflake`
- `portfolio`
- `kids-party-shop-rental`
- `stock-management`

The migration did not rename a retained public route. No blanket SPA redirect is present. Hidden historical project records are not placed in the sitemap, and no unverified destination has been invented for them.

## Architecture

- Astro owns route generation, response status, document head, sitemap, robots, and static HTML.
- The existing React application renders server-side inside Astro to preserve content and visual parity.
- Internal link clicks deliberately use full document navigation so the next route receives its correct static head and structured data.
- Static routes use `client:idle` with a bounded timeout rather than immediate hydration.
- `/contact` uses `client:load` because validation and submission are a first-order page task.
- Analytics remains consent-controlled.
- The image optimization build step compresses the copied media set and the output tests enforce asset/link and bundle budgets.

## SEO/AEO completion

- Unique page metadata and absolute canonicals are generated for all public routes.
- `@astrojs/sitemap` emits only current indexable content.
- `robots.txt` points to the generated sitemap.
- OG and Twitter metadata include image alt.
- JSON-LD covers `Person`, `WebSite`, `ProfilePage`, `CreativeWork`, `BlogPosting`, and `BreadcrumbList`.
- Blog dates come from existing ISO content records.
- JSON-LD serialization escapes markup-sensitive characters.

## Accessibility completion

- Server HTML contains headings, landmarks, links, and form content.
- Contact validation associates messages with fields and moves focus to the first invalid control.
- Success and error states are announced through shared feedback patterns.
- The redundant nested banner role on the contact hero was removed.
- Static route links remain usable while hydration is deferred.

## Content Collections decision

Content Collections would improve validation and editorial maintenance for projects and articles. They were not introduced in this pass because the same complex JavaScript records still drive the React compatibility views, detail layouts, cross-links, and SEO maps. Converting only the metadata layer would create two sources of truth.

Adopt collections when each associated page is converted from the compatibility app to Astro:

1. define a project collection schema and convert project listing/detail pages;
2. define an article collection schema and convert blog listing/detail pages;
3. generate SEO and JSON-LD directly from collection entries;
4. remove the corresponding React route and content import;
5. repeat route-level output and visual parity checks.

## Remaining migration debt

- The site still downloads a compatibility React runtime and application chunk.
- Navigation, theme controls, analytics consent, and decorative interactions share one broad island.
- Responsive images are produced by a post-build optimizer rather than Astro image components and `srcset`.
- Some large decorative chunks are lazy but remain part of the output inventory.
- Continue route-by-route conversion; do not rewrite all content and interaction in one PR.

## Verification contract

The portfolio-specific suite checks:

- expected static routes and metadata;
- exact sitemap content and 404 indexability;
- local links/assets and duplicate IDs;
- security headers;
- image and JavaScript budgets;
- current career/project positioning;
- live trust-stat configuration;
- deterministic theme state;
- contact unsaved-work and error behaviour;
- deferred hydration for static routes and immediate contact hydration.
