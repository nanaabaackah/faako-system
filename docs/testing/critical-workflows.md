# Critical workflow coverage

| Workflow | Current meaningful coverage | Browser/E2E state | Final status |
| --- | --- | --- | --- |
| Login | Dev ERP HTTP/auth tests; REEBS cookie-session and manager-scope tests; Stroane auth/role tests | Dev ERP suite is CI-selected; REEBS/Stroane full login browser journeys remain gaps | Partial |
| Logout/session expiry | REEBS auth-session adapter tests and backend session routes; Stroane current-user/auth routes | No uniform cross-app expiry browser test | Partial |
| Protected routes | Shared permission tests, representative Dev ERP/REEBS/Stroane denied-route tests | Dev ERP browser suite; other portals need deterministic fixtures | Partial |
| Role/permission access | Shared identifiers/helpers plus representative backend route tests | Browser matrix not complete | Passed at backend boundary |
| Customer creation | Shared validation/API clients; REEBS and Stroane customer modules compile/test | No full browser mutation | Partial |
| Product creation | Shared product schemas; Stroane product/admin and REEBS module tests | No full browser mutation | Partial |
| Inventory adjustment | Stroane negative/oversell/idempotency tests; REEBS queued-adjustment and water-price tests | Browser mutation not yet gated | Passed at critical backend/helper boundary |
| Order creation/status | Stroane paid-order/idempotency/status tests; REEBS shared order validation and queue/client tests | Browser order builder not yet gated | Partial |
| Booking creation/status | Shared booking transition schema; REEBS offline/booking tests; public booking rendering | No isolated end-to-end creation test | Partial |
| Invoice generation | Dev ERP invoice/finance tests and PDF paths | No Playwright invoice assertion | Partial |
| Payment update | Stroane Paystack verification/webhook/inventory idempotency tests; shared finance tests | No real provider call; intentionally mocked | Passed at backend boundary |
| Public contact form | Faako local Playwright smoke validates error/success hand-off; public output tests | Passed locally and selected in CI | Passed |
| Public catalogue/cart | REEBS local Playwright smoke uses mocked inventory and verifies cart persistence; Stroane output boundaries | REEBS passed; Stroane interactive browser spec missing | Partial |
| Donation | No active TTNGH application | Must use provider sandbox after scaffold | Not applicable |
| Event registration | No active TTNGH application | Add after validation/API decision | Not applicable |

“Partial” means the critical backend/helper contract is exercised but a user-level browser journey remains. It is not equivalent to no coverage.
