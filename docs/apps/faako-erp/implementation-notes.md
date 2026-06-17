# Faako ERP Implementation Notes

## Purpose

Capture technical notes, open questions, cleanup targets, and risks for Faako ERP.

## Known technical notes

- `src/config/adminModules.js` defines the Faako ERP registry for current demo/reference routes.
- `src/config/erpShell.js` adapts the registry into the existing shared shell sidebar and bottom navigation config.
- Scenario-specific labels remain applied through the existing `navigation.labels` and `navigation.bottomLabels` maps.
- Registry metadata includes group, status, visibility, and state fields for future grouped rendering and module exposure controls.
- Hidden modules are filtered out of shell navigation. Disabled, internal, coming-soon, and experimental metadata is currently visual only and does not block routes or redirect users.
- The app shell uses shared ERP topbar, page-content, navigation, and status-badge patterns from `@faako/ui`, but demo routes, scenario labels, page components, and demo access behavior remain app-owned.
- Shared shell placeholders for offline/sync/notifications/org switching are available structurally only and are not connected to demo backend behavior.
- The registry has no required environment variables, setup steps, migrations, data impact, or access-control enforcement changes.
- Demo access is API-owned. The browser must call `VITE_FAAKO_ERP_DEMO_ACCESS_ENDPOINT` and must not generate, display, or persist access codes. The browser stores only non-sensitive demo metadata such as email, scenario, and expiry; no demo bearer token is persisted.
- `docs/platform/codebase-cleanup-audit.md` flags Faako ERP as a lower-risk reference surface for shared shell/style validation before applying cleanup patterns to live ERP apps.

## Open questions

- Should Faako ERP eventually use grouped visual navigation, or remain a flat reference shell?
- Which registry metadata should become shared with future ERP starter apps?
- Which demo/reference modules should be consolidated before module toggles are exposed as a product concept?
- Which shell patterns should stay in Faako ERP as reference examples before broader ERP app adoption?

## Future cleanup

- Keep the registry aligned with demo route additions.
- Review grouped navigation UI separately before changing the shared shell layout.
- Connect database-backed module toggles, org-level module config, permissions integration, and SaaS plan gating only after shared-shell UX behavior is reviewed.
- Keep the reference shell aligned with shared wrappers without moving scenario-specific demo logic into shared packages.
- Use Faako ERP, System Starter, and UI Workbench to validate shared UI/style cleanup before applying the same changes to REEBS Portal or Dev ERP.

## Risks to monitor

- Scenario label overrides drifting from registry keys.
- Future registry wiring accidentally changing demo access, route behavior, or future module-toggle expectations.
- Shared shell wrapper changes drifting away from app-specific demo scenario labels or route expectations.
- Reference cleanup should not become implicit production behavior for live ERP apps without separate app-specific verification.
