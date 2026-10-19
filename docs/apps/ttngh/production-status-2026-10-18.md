# TTNGH production status — 18 October 2026

This dated evidence snapshot supersedes older claims that hosting and all provider
accounts are unconfigured. It is not deployment authorisation or proof of private
provider settings. No settings, CMS records, messages or payments were changed by
the audit. Later local branch changes are not automatically deployed fixes.

## Baseline and recommendation

- Audited remote main: `4b142d1003e60ed3d7f3b8edcb16326b88ef232f`.
- Live presentation is consistent with that implementation; exact deployment SHA
  still needs Cloudflare/Railway metadata verification.
- Recommendation: **READY WITH CONDITIONS** for an informational launch.
- No confirmed P0 defect. Eight P1 findings/verification gaps, six P2 improvements
  and four post-launch workstreams were identified. Unverified is not passed.
- Payments and Drive → R2 automation do not block informational launch while
  checkout is absent and current approved imagery works.

## Verified public behavior

| Area | Evidence | Remaining uncertainty/action |
| --- | --- | --- |
| Website | `https://thethrivingnetworkgh.org` serves HTTPS; HTTP redirects; 14 public routes return 200; unknown path returns 404 | Confirm deployed SHA and release approval |
| Indexing | Production allows crawling; canonical/sitemap use production; CMS excluded/noindex | `ttngh.pages.dev` also indexable; branch previews unverified; www does not resolve |
| Railway | `https://api.thethrivingnetworkgh.org/health` returns 200; exact production CORS preflight accepted, unrelated origin rejected; no-store responses | Proxy trust, actual replica count, secrets and alerts unverified |
| Sanity | Project `d5k303l7`, dataset `production` is PUBLIC; unauthenticated published-content read and CMS-required build succeed | Public-dataset policy, editor roles/MFA/recovery, backups and content migration need review |
| Studio | `https://ttngh-studio.sanity.studio/` reachable; gateway works | Authenticated editor workflow not tested |
| Publishing | Signed webhook implementation and mocked tests pass | Actual webhook/build-hook configuration and publish/update/withdrawal E2E UNVERIFIED |
| Team/events | Zero records matching website publication filters in both collections | Publish approved content; no fallback to removed/withdrawn profiles |
| Contact | Form enabled; API origin/widget configuration present; required consent; no-JS email fallback | Successful Turnstile verification and real delivery UNVERIFIED; no enquiry sent |
| Email DNS | Cloudflare routing MX/root SPF, Resend DKIM selector and monitoring DMARC observed | Sender approval, aliases/destinations, credentials and inbox delivery UNVERIFIED |
| Calendar | Correct approved ID and Africa/Accra timezone; iframe loads only on action | Signed-out embed requires login; public ICS returns 404; make approved calendar public or hide embed |
| Analytics | Public ID CONFIGURED; no tag before consent/Essential Only; DNT prevents initialization; explicit pageview strips query; advertising consent denied | Collection/reporting and Enhanced Measurement settings UNVERIFIED; repeated acceptance queues duplicate pageviews in audited main |
| Search services | Search Console verification DNS exists; crawl prerequisites work | Account/property access, submissions, indexing reports, Business Profile and Bing UNVERIFIED |

Public configuration does not establish server-secret presence. No secret values
belong here. Report private settings only as CONFIGURED, MISSING or UNVERIFIED;
this audit had no provider-dashboard evidence to establish them.

## Verification evidence

- Website 24 tests, Studio 9 tests, API 28 tests: all passed.
- Isolated main website build with published Sanity content and Studio build passed.
- Built SEO/local destination checks passed for 15 HTML pages.
- 15 live routes at 320/375/390/430/768/1024/1440px: no document overflow.
- 13 desktop/mobile axe scans: no reported targeted violations; not WCAG certification.
- 19 checked live image URLs and 20 internal destinations worked.
- Existing installed dependencies were reused; this was not a fresh dependency
  installation, full advisory audit or proof of production runtime versions.
- One unthrottled Chromium homepage sample: LCP ~2.61s, CLS ~0.001, resource
  transfer ~1.18MB, zero hydrated islands. Not Lighthouse or field Core Web Vitals.
- Temporary evidence was captured under `/private/tmp/ttngh-audit-20261018`;
  that local directory is not a durable CI artifact and may be removed by the OS.

## Required follow-up

P1: verify contact delivery or use direct-contact-only mode; prove CMS publishing
and withdrawal; approve public-dataset handling; fix/hide Calendar; publish team
content or explain its absence; verify GA/privacy settings; record operational
owners/retention; protect alternate and preview origins from unintended indexing.

P2: support www if intended; review inline CSP/HSTS and CSP-blocked Cloudflare
Insights; adopt shared mobile browser chrome/safe-area handling; optimize the
~479KiB navigation logo; prevent duplicate consent pageviews; reconcile runbooks
and the obsolete TTNGH hosting deferral in `scripts/hosting-policy.mjs`.

Keep navbar, pink footer and ScrollExpandSection design intact. Real iPhone/Safari,
screen-reader, 200%/400% zoom, provider delivery, role/recovery, rollback and
Ghana-specific privacy/safeguarding review remain outstanding. Name the CMS and
backup administrators, content/safeguarding approver, event/calendar owners,
inbox owner, analytics owner and incident owner; do not invent personnel.

## Post-launch only

1. Drive → R2 media sync/registry/picker and archive/deletion automation.
2. Paystack checkout, dedicated PostgreSQL runtime/migrations, durable reconciliation,
   receipt worker and refund/dispute operations. Account/infrastructure state is
   UNVERIFIED; public checkout is absent. Keep payment activation gates disabled.
3. Optional advanced GEO/discovery tooling; no guarantee of search/AI citations.
4. Optional scheduling/reporting automation beyond basic launch operations.

## Public dataset and withdrawal boundary

The website's `publishState`, consent and review filters govern rendered content,
not access to Sanity's public API. Do not store private enquiries, health details,
donor records, internal consent evidence or private reviewer notes in published
documents. Changing a custom status is not equivalent to unpublishing. For a
withdrawal, unpublish where required, rebuild, verify website/API visibility and
handle assets/cached copies through the approved process. Dataset privacy alone
must not be assumed to make previously public assets private.

References: [Sanity authentication](https://www.sanity.io/docs/content-lake/http-auth),
[archived document visibility](https://www.sanity.io/docs/studio/archive-documents).
