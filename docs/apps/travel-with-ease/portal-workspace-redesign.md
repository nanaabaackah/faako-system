# TWE portal workspace redesign — phase 1
Approved direction: Faako workspace shell + modular operations studio. This PR changes only the shell, navigation, page heading and typography foundation, not CMS data or publication workflows.

- The desktop sidebar uses shared ErpNavSidebar and shared collapse persistence with a backward-compatible controlled navigation adapter. The existing guarded navigate function remains authoritative for dirty drafts and role-filtered destinations. Only the active module reveals permitted contextual destinations; Account remains in the footer. Mobile retains the proven drawer and five-shortcut navigation (900px breakpoint aligned with Faako).
- Neutral grey shell, white workspace, navy accents and consistent radius tokens; no new icon library. Use shared Iconsax and shared topbar.
- Public website's approved typography from its typography.css: Poiret One (400 with optical stroke), Quicksand body, Inter accents/navigation. Use compact portal sizes, no decorative signature headings; website preview keeps its own typography. Actual files are Fontsource WOFF2 with Latin and Latin Extended subsets and OFL notices, pinned to an inspected upstream Git commit. Vite downloads and verifies these public assets only if the local cache is absent or invalid. Browser font loads remain same-origin; no portal CSP or authentication changes. A fresh build needs network access to raw.githubusercontent.com; a cached build doesn't.
- Existing API contracts, permission checks, session preservation, autosave, publication, role restrictions and 02:00 UTC app update schedule remain unchanged.

Acceptance: shared navigation desktop, collapse/expand and context visibility, permission filtering, mobile keyboard and touch navigation, dirty draft guard, real font loading, viewport overflow, independent staging smoke test. Remaining phases: dashboard and enquiry UX, structured content editor, media and synchronisation, communications/form builders, administration, complete rendered QA.

## Phase 2 — operational dashboard and enquiry inbox
- Independent dashboard resources for summary, recent records, drafts and publication jobs. A failed request no longer masks other data or reports false zero counts. Manual refresh retries each resource. Publication activity uses actual returned jobs; no invented trends.
- Enquiry list and selected detail fetch independently; preserve filters and pagination on selection. Wide workspace uses master-detail view, smaller screens retain full-width detail and restore focus on return. Existing version checks, CSRF, permission checks, snapshot rendering and status-only writes remain intact.
- Browser regression coverage includes partial dashboard failure; final live visual acceptance remains outstanding.
