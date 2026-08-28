# Modernisation completion report

## Outcome

The monorepo now has documented framework boundaries, shared API/domain/validation/security foundations, three implemented Astro public migrations, a deliberately retained Vite Stroane storefront/admin split, and representative operational-app adoption. This is a completed programme phase, not a claim that every legacy module was rewritten.

## Programme status

| Workstream | Status | Evidence |
| --- | --- | --- |
| Repository/framework audit | Complete | Current/target/final maps and framework ADRs |
| Turbo/build determinism | Complete baseline | Environment hashing, outputs and dependency docs; CI uses affected Turbo tasks |
| API contracts/types/validation/client | Complete foundations + pilots | Shared packages/tests and documented adoption patterns |
| REEBS duplication/boundaries | Complete approved extraction | Public/backend ownership separated; portal remains Vite |
| Shared UI/tokens/UX states | Complete standards + pilots | Existing packages audited; no duplicate design system created |
| Authentication/authorisation/logging/errors/audit | Complete standard + representative enforcement | Existing provider retained; request IDs/redaction/permissions tested |
| byNana Astro | Complete | Route/output/SEO/standards tests pass |
| Faako Website Astro | Complete | Route/output/form/browser smoke evidence |
| REEBS Website Astro | Complete | Public catalogue boundary/output/browser smoke evidence |
| Stroane modernisation | Complete approved boundary phase | Vite retained by ADR; independent storefront/admin builds and critical backend tests |
| Operational Batch 1 | Complete in prior changes | Identity/master-data pilots and permissions/tests |
| Operational Batch 2 | Complete | Shared commercial validation/client adoption, safe stock/order transitions and tests |
| Operational Batch 3 | Deliberately deferred | Finance migration requires a dedicated release train; current critical status/payment tests remain |
| Operational Batch 4 | Deliberately deferred | People/operations/settings broad rollout; water fixes/tests exist but mass adoption is out of scope |
| TTNGH | Deliberately deferred | Requirements/docs only; no tracked scaffold |
| Final audit/security/CI/docs | Complete with documented blockers | Zero critical dependency advisories; remaining high/medium work in roadmap |

## Batch 2 result

- Added shared order-line/create/status, booking-status and delivery-update validation.
- Adopted compatibility API clients across selected REEBS orders/bookings/delivery/inventory/POS modules and Stroane admin products/orders.
- Added duplicate-submit/unsaved-draft protection and preserved editable order prices.
- Rejected invalid Stroane order status transitions instead of silently accepting them.
- Preserved stock mutation safeguards, current-stock water calculations, permissions and idempotency behaviour.
- Targeted validation, REEBS and Stroane tests/builds passed before final audit work.

## Final phase changes

- Closed fail-open analytics auth and auth-throttling gaps.
- Removed critical vulnerable dead dependencies and reduced production dependency highs from 20 to 3 acknowledged items.
- Prevented analytics query/fragment PII leakage.
- Added low-risk public accessibility semantics.
- Replaced Stroane-only CI with affected monorepo, Python and selected local browser gates.
- Added complete active deployment index/runbooks, final accessibility/performance/SEO reviews, testing strategy, security roadmap, final architecture and permanent repository rules.

## Honest completion boundary

Full browser workflow parity for every operational module, distributed rate limiting, uniform session invalidation, the Astro/sharp upgrade, REEBS recovery redesign, and TTNGH implementation remain future work. They are explicit debt, not hidden failures.

## Final validation status

| Check | Status | Result |
| --- | --- | --- |
| `pnpm lint` | Passed | 28 workspaces; existing warnings only, no errors |
| `pnpm typecheck` | Passed | 15 applicable workspace tasks; Astro checks report zero errors |
| `pnpm test` | Passed | 21/21 applicable workspace tasks |
| `pnpm build` | Passed | All 28 workspaces; REEBS emitted 1,125 static pages |
| `pnpm check` | Passed | Root one-command lint, type-check, test and build sequence |
| `pnpm security:all` | Passed | 2,383 tracked files plus application configuration/security rules |
| Critical dependency audit | Passed | No known critical advisory remains |
| Production dependency audit at `high` | Failed with accepted follow-up | Three acknowledged findings remain: Astro/sharp, non-applicable React Router RSC actions, and Prisma build tooling |
| Monitoring/project/hosting registries | Passed | All three repository readiness checks |
| Dev ERP Playwright | Passed | 15/15 local scenarios using the configured system-Chrome fallback |
| Faako and REEBS public browser smoke | Passed | Local built-output navigation and interaction smoke coverage |
| REEBS Analytics Python tests | Blocked locally | System Python lacks `pytest`; CI installs Python 3.12 and the service dev dependencies |
| TTNGH application validation | Not applicable | No tracked application scaffold exists in this phase |
| `git diff --check` | Passed | No whitespace errors |

The dependency-audit failure and local Python blocker are deliberately classified separately from product regressions. Neither is hidden by the root quality gate, and both have an owner/action in the security and technical-debt roadmaps.
