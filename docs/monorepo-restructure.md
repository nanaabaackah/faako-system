# Faako Monorepo Restructure

## Scope

Target app boundaries:

- `apps/reebs-portal`
- `apps/reebs-website`
- `apps/faako-erp`
- `apps/faako-api`
- `apps/faako-website`

`bynana-portfolio` and `dev-erp` remain in the repo, but they are outside this ERP split.

## Additional App Checks

`apps/dev-erp` and `apps/bynana-portfolio` were checked separately after the main Faako and Reebs split.

What was corrected:

- Both apps had been copied with nested `.git` directories, which is not valid inside a monorepo workspace.
- Both apps have now been converted from `160000` gitlink entries into normal workspace directories tracked directly by the root repo.
- Both apps still have local copied build and editor artifacts from their standalone repos, but those are ignored local state rather than repo-structure issues.
- Both apps were missing source files compared with their standalone source repositories.

Source sync used:

- `apps/dev-erp` was synced from `/Users/Nana/Desktop/Developer/Dev`
- `apps/bynana-portfolio` was synced from `/Users/Nana/Desktop/Developer/bynana-portfolio`

Monorepo-specific changes retained:

- Workspace package names in each app `package.json`
- Root workspace wiring through `pnpm-workspace.yaml` plus explicit root `package.json` workspace entries
- Existing local `.gitignore` files
- Vite config updated to resolve env from the app directory and dedupe `react` and `react-dom`
- Exclusion of copied standalone `.git`, `node_modules`, `dist`, `.netlify`, and local env files during source sync
- Removal of the stale root `package-lock.json` so the workspace has a single package-manager source of truth

Validation results:

- `apps/dev-erp`: full `npm run build` passed after Prisma was allowed to generate inside the workspace
- `apps/bynana-portfolio`: `npm run build` passed after replacing stale `react-icons` imports from the source app

## Duplication Analysis

Current duplication hotspots from the existing workspace scan:

- `apps/reebs-portal/src` and the original `reebs-website/src` share 117 identical source files.
- The overlap is concentrated in admin pages, shared auth/cart/template context, global admin styles, and shell components.
- `apps/faako-erp/src` is still a direct copy of the previous standalone `faako/apps/erp/src`.
- `apps/faako-website` and `apps/faako-api` were copied almost verbatim from the previous `faako` repo.

Key implication:

- Reebs already has separate website and ERP apps in `faako-new`, but the website app still carries duplicated admin-support code.
- Faako already has the correct app split, but its ERP shell is still self-contained instead of consuming shared workspace packages.

## Proposed Architecture

Shared workspace packages introduced in this step:

- `packages/ui`
  Shared ERP shell primitives and reusable breadcrumb UI.
- `packages/theme`
  Shared ERP shell CSS tokens and layout styles.
- `packages/core`
  Shared Reebs runtime modules: template config state and organization-aware fetch/auth token helpers.
- `packages/types`
  Shared ERP shell contracts.
- `packages/utils`
  Shared path, role, and title helpers for ERP apps.
- `packages/config`
  Shared config builders so each app keeps its own branding/navigation config locally.

App ownership after this step:

- `apps/reebs-portal`
  Owns admin routes, backend, Prisma, Netlify functions, and Reebs-specific modules.
- `apps/reebs-website`
  Owns the public site. Shared template configuration and runtime utilities are now workspace packages instead of duplicated local modules.
- `apps/faako-erp`
  Uses the shared ERP shell packages while keeping Faako-specific routes and branding in local app config.
- `apps/faako-api`
  Remains isolated for Netlify functions and Prisma.
- `apps/faako-website`
  Remains isolated for the public Faako marketing site.

## Incremental Implementation

Completed in this increment:

1. Added shared workspace packages for `ui`, `theme`, `core`, `types`, `utils`, and `config`.
2. Moved Reebs template-config state and organization/auth-token utilities into `packages/core`.
3. Moved the shared breadcrumb UI into `packages/ui`.
4. Added reusable ERP shell primitives and wired `faako-erp` to the shared shell.
5. Wrapped `reebs-portal` admin routes in the shared shell frame so shell-level design tokens and layout changes can now be applied centrally.
6. Added app-local ERP shell config files for Reebs and Faako so branding and module navigation remain app-specific.

Not done yet:

- Reebs `PortalSidebar` and `AdminBottomNav` are still Reebs-specific components. They are now inside the shared shell frame, but their internal behavior has not been extracted yet.
- `apps/reebs-website` still contains some admin-only component directories that are no longer part of the public app boundary. They are now lower priority because the duplicated runtime modules were moved out first.
- ESLint and TypeScript shared config packages still need a later pass if you want every app to consume a single config preset.

## File Move Log

Logical moves completed in this step:

- `apps/reebs-portal/src/context/TemplateConfigContext.jsx`
  moved to `packages/core/src/templateConfig.tsx`
- `apps/reebs-website/src/context/TemplateConfigContext.jsx`
  moved to `packages/core/src/templateConfig.tsx`
- `apps/reebs-portal/src/utils/organization.js`
  moved to `packages/core/src/organization.ts`
- `apps/reebs-website/src/utils/organization.js`
  moved to `packages/core/src/organization.ts`
- `apps/reebs-portal/src/components/AdminBreadcrumb/AdminBreadcrumb.jsx`
  moved to `packages/ui/src/ErpBreadcrumb.tsx`
- `apps/reebs-website/src/components/AdminBreadcrumb/AdminBreadcrumb.jsx`
  moved to `packages/ui/src/ErpBreadcrumb.tsx`

The app-local files now act as thin wrappers or consumers of the shared packages.
