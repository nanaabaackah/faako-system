# Public-site SEO and AEO standards

These rules are the minimum for public marketing, editorial, service, event, and commerce pages in this monorepo. byNana Portfolio is the current reference implementation.

## Page contract

Every indexable page must ship these fields in its initial HTML:

- one concise, unique `<title>`;
- one unique description that accurately summarizes the page;
- one absolute, production canonical URL;
- `index, follow` only when the page is approved for search;
- exactly one clear primary heading;
- logical heading order beneath it;
- OG site name, locale, title, description, type, URL, image, and image alt;
- Twitter card, title, description, image, and image alt;
- a visible accountable organisation or author where relevant;
- meaningful internal links to the next useful page.

Descriptions should be written for clarity, not a fixed character-count trick. Titles and descriptions must remain useful when truncated. Do not add keywords, locations, awards, client counts, dates, prices, availability, or impact claims that the content owner has not supplied.

## Canonicals, indexability, and redirects

- Build canonicals from one configured production origin and normalized route.
- Canonicalize aliases to one preferred route. Do not let `/home`, `/shop`, query variants, or trailing-slash variants compete.
- Account, login, password-reset, cart, checkout, internal search, preview, error, and admin pages default to `noindex`.
- A 404 must return status 404 and `noindex`; do not silently redirect every unknown URL to the home page.
- Use permanent redirects only for verified route moves with a clear equivalent. Use temporary redirects for genuinely temporary changes.
- Keep redirect rules in source control and test representative old URLs.
- Sitemap entries must be canonical, indexable, return success, and be internally linked. Exclude 404s, aliases, private pages, and query strings.
- Robots rules are a crawl hint, not an access-control mechanism.

## Structured data

Use the smallest schema that matches visible, verified content:

| Page/content | Preferred schema |
| --- | --- |
| Site home | `WebSite` plus `Organization` or `Person` |
| Person profile | `ProfilePage` with a `Person` |
| Editorial article | `Article` or `BlogPosting` |
| Product detail | `Product` and valid offer/availability only when supplied |
| Event detail | `Event` with real dates, place or online location, and status |
| Service | `Service` |
| FAQ visible on page | `FAQPage` only when the questions and answers are visible |
| Detail hierarchy | `BreadcrumbList` |

- JSON-LD must be emitted in initial HTML and serialized safely.
- Structured data must agree with visible copy and canonical URLs.
- Dates use ISO 8601. Show meaningful publication and modification dates to readers.
- Never manufacture ratings, prices, availability, organisers, locations, donation tax status, or impact data.
- Validate representative output with a schema validator before launch.

## Answer-engine content

- Start important pages with a plain-language answer to who the organisation serves, what it provides, and how to take the next step.
- Use descriptive question headings when the reader is likely to ask a question.
- Put the direct answer first, then supporting detail.
- Define specialist terms on first use.
- Keep contact, support, booking, donation, registration, and partnership steps explicit.
- Use FAQs only for real recurring questions; avoid duplicate, keyword-stuffed questions.
- Cite accountable sources for medical, legal, financial, or safety claims. Public mental-health content requires editorial and safeguarding review.

## Astro implementation

- Define the site origin once in `astro.config.mjs`.
- Put shared metadata and safe JSON-LD serialization in the base layout.
- Supply route-specific values from page frontmatter or typed Content Collections.
- Use `@astrojs/sitemap`; filter non-indexable routes.
- Keep `robots.txt`, security headers, and exact redirects under `public/`.
- Render page content as Astro HTML. Search-critical content must not depend on a React island.
- Use content collection schemas for article, event, resource, project, and product records when those records are editorially maintained.

## Release checks

For every release:

1. Build the production output.
2. Assert every public route has title, description, canonical, one H1, social fields, and parseable JSON-LD.
3. Compare sitemap URLs with built routes and indexability.
4. crawl local output for broken local links, assets, redirect loops, duplicate IDs, and orphan pages;
5. verify direct URLs, 404 status, and representative redirects;
6. inspect mobile and desktop output with JavaScript both enabled and disabled;
7. validate schema and social preview URLs against production assets;
8. record any intentional exception with an owner and expiry.
