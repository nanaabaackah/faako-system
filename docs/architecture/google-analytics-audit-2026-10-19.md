# Public Google Analytics audit — 19 October 2026

Scope: TTNGH as the working reference, Faako Website, byNana Portfolio, REEBS Website, Stroane storefront, and Travel With Ease. Private ERP and portal surfaces were not enabled or tested for collection.

## Outcome

Each configured repository checkout uses a different GA4 web-stream ID. No TTNGH identifier was copied. The shared implementation had two confirmed defects: the Vite HTML plugin fetched and configured Google Analytics before consent, and the route tracker split initialisation and page-view dispatch across effects, leaving consent transitions vulnerable to a lost or stale first page view. Faako also passed an unsupported consent property, REEBS passed its route under the wrong option name, and the three Astro migrations using `VITE_GA_*` did not expose the documented `VITE_` client prefix. Their production builds therefore discarded configured IDs.

The fixes are code-only. No production environment values were changed and nothing was deployed. Consequently, the live deployment findings below remain accurate until the affected sites are rebuilt with their own host-side variables.

## Shared lifecycle after the fix

1. Build output contains no measurement ID when the application's variable is empty.
2. Vite output may contain a same-origin bootstrap asset. It sets Consent Mode defaults to denied and collection disabled, but does not fetch `gtag.js`, call `js`, or configure a stream.
3. Explicit analytics consent initializes that application's own stream, with automatic page views disabled.
4. The route tracker initializes or updates consent and dispatches the current route in one effect. It de-duplicates the same route and resets that guard after revocation so re-consent can dispatch the current route once.
5. Revocation sets the `ga-disable-<measurement-id>` flag and a denied consent update before any later route can be sent.
6. The shared page-view boundary removes query strings and fragments.

## Application report

| Application | Build variable and implementation | Consent and dispatch | Repository CSP / headers | Live verification on 19 Oct 2026 |
| --- | --- | --- | --- | --- |
| TTNGH | `PUBLIC_GA_MEASUREMENT_ID`; Astro `AnalyticsConsent` calls the shared initializer after consent. | Consent-gated, DNT-aware, one page view per document, marketing denied. | Allows Google Tag Manager plus `www` and `region1` Analytics connections. | Its own ID is embedded in the consent config. After consent, the browser created its own `gtag.js`, `config(send_page_view:false)`, and sanitized `/` `page_view` commands. No GA collect request was observed in the isolated run, so receipt must still be confirmed in that stream's Realtime/DebugView. Cloudflare's injected Insights beacon is separately blocked by TTNGH CSP; it is not the GA4 implementation. |
| Faako Website | `VITE_GA_MEASUREMENT_ID` (`VITE_GA_ID` legacy fallback); Astro React island and shared route tracker. **Build defect fixed:** Astro now admits the documented public `VITE_` prefix. | **Code defect fixed:** `analyticsStorage` was not part of the shared consent contract and kept storage denied. It now passes `{ analytics: true, marketing: false }`. | Repository `_headers` allows the provider and hashes generated inline scripts. | Accepting analytics produced no stream initialization, tag, or page view in the current deployment. The live response also lacked the repository CSP header. The corrected local production build embeds Faako's own configured ID; rebuild after confirming the same host build variable and confirm `_headers` is published. |
| byNana Portfolio | `VITE_GA_MEASUREMENT_ID` (`VITE_GA_ID` legacy fallback); shared React route tracker inside the portfolio island. **Build defect fixed:** Astro now admits the documented public `VITE_` prefix. | Consent state gates `enabled`; the fixed tracker initializes before sending and handles revocation. | Live and repository CSP allow Tag Manager and Analytics; `connect-src` is broad HTTPS. | Accepting analytics produced no stream initialization, tag, or page view in the current deployment. The corrected local production build embeds byNana's own configured ID; rebuild after confirming the same host build variable. |
| REEBS Website | `VITE_GA_MEASUREMENT_ID` (`VITE_GA_ID` legacy fallback); Astro analytics island plus thin shared-utility adapter. **Build defect fixed:** Astro now admits the documented public `VITE_` prefix. | Accept/save initializes and dispatches even if the idle analytics island has not hydrated. **Code defect fixed:** the island now sends `pagePath`, not the ignored `path` property. | Live CSP contains generated Astro hashes and permits the provider; `connect-src` is broad HTTPS. | Accepting analytics produced no stream initialization, tag, or page view in the current deployment. The corrected local production build embeds REEBS' own configured ID; rebuild after confirming the same host build variable. |
| Stroane storefront | `VITE_GA_MEASUREMENT_ID` (`VITE_GA_ID` fallback); Vite HTML plugin and shared React route tracker. Portal builds exclude the plugin. | Consent gates the tracker. **Shared defect fixed:** future builds no longer fetch or configure the tag before consent. | Provider-specific script, image, and connect allow-lists are present. Admin output has a separate CSP with no Google Analytics allowance. | Its own tag is present and a valid post-consent GA4 `page_view` was observed with the Stroane stream ID, `dl=https://stroanesolutions.com/`, and `dp=/`. The current live build still contains the old pre-consent external tag and must be rebuilt to receive the consent-loading fix. |
| Travel With Ease | `PUBLIC_GA_MEASUREMENT_ID`; consent-aware Astro component and shared utility. | Same deferred, DNT-aware flow as TTNGH; marketing denied and manual page view only. | Allows Tag Manager and Analytics connections. | Not live-verifiable: the repository still uses `.example` origins and has no configured GA4 stream. Keep analytics off until the real origin and a dedicated Travel With Ease web stream are approved. |

## Deployment actions still required

- Confirm `VITE_GA_MEASUREMENT_ID` is set separately in the production build environments for Faako Website, byNana Portfolio, and REEBS Website, then rebuild with the corrected Astro client prefix. Do not use a runtime-only variable: Astro and Vite embed these values during build.
- Rebuild Stroane to remove the pre-consent external Google tag from initial HTML.
- Diagnose why Faako production is not serving `dist/_headers`; its current live response has no CSP despite the repository output contract.
- Use each property's Realtime or DebugView after deployment to prove receipt. This repository audit can validate browser dispatch but cannot establish that the Google property accepted and attributed the event.
- Travel With Ease needs a real approved origin and its own GA4 web stream before its currently blank `PUBLIC_GA_MEASUREMENT_ID` is populated.

## Verification method

Live HTML and response headers were fetched from the public origins. Post-consent checks used fresh headless-browser contexts. GA collect requests were intercepted and aborted after their safe routing fields were inspected, avoiding intentional production traffic from the test. No cookies, secrets, deployment settings, or production data were modified.

Corrected local production builds were also served in isolated previews. Faako, byNana, and REEBS each initialized only their own configured stream after consent and queued `config(send_page_view:false)` followed by exactly one sanitized `/` page view. Stroane build output contained only the same-origin denied-consent bootstrap in initial HTML; the external Google tag was absent before consent.
