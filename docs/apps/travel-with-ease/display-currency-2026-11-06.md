# Website display currency — 6 November 2026

## Approved scope

The user's footer currency request adds display-only conversion to the public
website. This is a narrow exception to the earlier deferred currency scope:
it does not enable the estimator journey, payments, multi-currency invoicing,
automatic quote acceptance or any change to authoritative GHS prices.

The footer uses a compact 88px Faako SelectField pill in the same wrapping legal
and preferences row as Terms, Privacy and Cookie settings. The selected ISO code
is visible; the dropdown retains full currency names and 44px targets. No rate
paragraph or attribution block is displayed in the footer. Rate explanations live
in Terms under "Display currency and indicative exchange rates"; live status is
announced accessibly and available as a tooltip. A failed conversion shows GHS
and an icon-only, accessibly named retry control.

Available codes come from the existing
enabled two-decimal currency catalogue: GHS, USD, EUR, GBP, CAD, AED, TRY and ZAR.
GHS is the default. Successful selections are saved under
`twe-display-currency-v1` as a non-sensitive functional browser preference.
Storage failure does not stop current-page selection; invalid stored values
are ignored. No analytics event or third-party browser request is introduced.

## Rendering and behaviour

- Astro renders original GHS prices as normal search-visible/no-JavaScript text.
- `MoneyText.astro` marks explicit package/service monetary values without
  injecting HTML. `CurrencySwitcher.jsx` updates only these marked values.
- Listing cards, featured packages, detail facts/enquiry panels, tier amounts,
  service fees and explicit GHS amounts within service descriptions participate.
- Each conversion shows `≈` and an ISO currency code, with the original GHS
  amount alongside. Unpriced packages remain unpriced.
- Legal terms, reference months, free-form enquiry budgets, payment schedules,
  CMS records and server-side quote calculations are not rewritten.
- The rate date and cached/stale state are available through the control's
  accessible status/tooltip. Missing/invalid/expired rates
  revert display amounts to GHS with a durable message and retry control.
- An already-open tab also drops an applied conversion when its rate reaches the
  72-hour maximum age; it cannot retain a stale estimate indefinitely.
- Changing currency cancels earlier requests; an old response cannot replace a
  newer choice. Separate pages reapply the saved preference after validation.
- Existing footer backgrounds, package shadows and approved CTA are preserved.

## API, precision and provider

`GET /api/public/currency?currency=USD` returns a minimal shared success envelope:
`baseCurrency`, `currency`, decimal-string `rate`, `updatedAt`, `stale`,
`provider`, `indicative`, plus the existing request ID. Only configured currency
codes and that one query parameter are accepted. No arbitrary amount, provider
URL, organisation or credential is accepted from the browser.

The endpoint reuses CurrencyService's existing six-hour per-pair cache and the
ExchangeRate-API adapter. Concurrent lookups are coalesced, provider failures have
a 30-second cooldown, and reads have a separate 60/10-minute limiter so currency
requests cannot consume the enquiry-submission quota. Upstream failure never
blocks API startup, staff sessions or enquiry persistence.

Validate positive bounded decimal rates, the GHS base and source timestamp.
Cached fallback is labelled; rates over 72 hours old are rejected, and rates over
36 hours old are labelled stale even if returned by the provider. Conversion
reuses the existing BigInt/integer-minor-unit implementation and rounds half-up
to the target's two minor digits. No floating-point multiplication of prices.

The adapter now handles both documented response shapes and endpoints:
[open endpoint](https://www.exchangerate-api.com/docs/free),
[keyed standard endpoint](https://www.exchangerate-api.com/docs/standard-requests).
Open-access use requires source attribution. It is displayed discreetly alongside
converted prices (the first applicable pricing section per page), not in the
footer; it links to the provider and Terms. GHS-only pages do not display it.
No provider key is bundled in the website or returned by this endpoint.

## Configuration and rollout

No new required variables, dependencies or database migrations. Reuse:

- Website: `PUBLIC_API_BASE_URL` for the correct environment's API. Local dev
  uses Astro's existing `/api` proxy and `TWE_API_PROXY_TARGET` when customised.
- API: `EXCHANGE_RATE_API_KEY` (optional, server-only),
  `EXCHANGE_RATE_API_BASE_URL` (normally omit), `EXCHANGE_RATE_TIMEOUT_MS`,
  `EXCHANGE_RATE_CACHE_TTL_SECONDS`. Without a key, use the documented open
  endpoint. With a key, the default standard endpoint is selected automatically.
- For a keyed endpoint override, the base is the prefix before
  `/{key}/latest/{baseCurrency}`, not the full URL. Never place a key in a public
  environment variable or commit a provider URL containing a credential.

The normal local preview launcher uses Node's source watcher and intentionally
does not load hosted `.env` credentials; its rate provider uses the open default.
If an older non-watching API process is running, restart that process. Deploy the
API endpoint before or alongside the website;
an older API causes an honest GHS fallback, not a broken site. Verify live provider
availability and attribution/plan terms in each hosted environment separately.
Rollback is a revert of this feature commit; no stored prices or schemas change.

The selector is shown only when the published Terms contains the new disclosure.
If `TWE_CONTENT_SNAPSHOT` supplies an older CMS snapshot, add/publish that Terms
entry through the normal draft/preview/publication process before expecting the
selector to appear. The source-approved baseline includes it; this code does not
silently modify or publish existing database documents.

## Verification

Unit/HTTP tests use synthetic rates and isolated loopback servers. Chrome checks
exercise actual components at 320/390/768/1440px: keyboard/touch selection,
cross-page persistence, tiers/service fees, original amounts, stale and expired
rates, provider failure/retry, rapid changes, no overflow and no-JavaScript GHS.
No real enquiries, emails, payments or provider requests are made by these tests.
The currency island's measured emitted chunk is 4,715 bytes (2,168 gzip),
excluding already-shared runtime/control chunks. Hosted rates are not certified
by mocked local tests or by CI alone.

Verification on 7 November: the focused release website suite passed 53 tests,
with one portal-artifact check skipped in the source-only worktree. All 114 API
unit/HTTP tests passed. Website/API lint and type checks passed; Astro built
29 routes. Chrome verification in the regular workspace passed all four widths,
including no-JavaScript behaviour, mocked provider failures, expiry and retry.
No hosted provider, authentication or deployment acceptance is implied.

PR #137 already merged the preceding design work. Currency changes belong to
`feat/twe-footer-display-currency`, based on develop `24dce8005`. Additional
uncommitted CTA, imagery and copy edits in the regular workspace are preserved
and excluded from this focused release; their separate test failures are not
reported as passed by the focused-branch results.
