# @faako/config

Shared configuration helpers for Faako apps.

## What changed

Added the shared ERP module registry foundation under `src/erpModules/`, extended it for safe navigation adapters across ERP apps, added a module visibility/state layer for future module exposure controls, added shared ERP shell placeholder/status constants, added platform app-mode helpers, and added a monorepo app registry for config-driven monitoring.

## Where it lives

- `src/erpModules/moduleGroups.js`: shared ERP module group constants.
- `src/erpModules/moduleStatuses.js`: shared ERP module status constants.
- `src/erpModules/moduleStates.js`: shared ERP module visibility and state constants.
- `src/erpModules/registryHelpers.js`: shared lookup and filtering helpers.
- `src/erpShell/shellFoundation.js`: shared ERP shell placeholder and status badge constants.
- `src/appModes/appModes.js`: shared app-mode constants/helpers for normal, degraded, read-only, and maintenance states.
- `src/monorepoApps/appRegistry.js`: shared monorepo app metadata and monitoring-site helpers.
- `src/projectRegistry/projectRegistry.js`: shared public/project metadata foundation for future portfolio/case-study consumption.
- `src/index.js`: exports the registry constants and helpers from `@faako/config`.

## How to use it

App registries can import constants and helpers from `@faako/config`:

```js
import {
  ERP_MODULE_GROUPS,
  ERP_MODULE_STATES,
  ERP_MODULE_STATUSES,
  ERP_MODULE_VISIBILITY,
  ERP_SHELL_PLACEHOLDER_SLOTS,
  ERP_SHELL_STATUS_BADGES,
  APP_MODES,
  getAppModeNotice,
  resolveAppModeFromEnv,
  getMonorepoApps,
  getMonorepoAppByKey,
  getMonorepoMonitoringSites,
  getModuleByKey,
  getModuleByPath,
  getVisibleModules,
  groupModulesByGroup,
} from "@faako/config";
```

Supported helpers:

- `getModuleByKey`
- `getModuleByPath`
- `getModulesByGroup`
- `getCoreModules`
- `getOptionalModules`
- `getLegacyRouteTarget`
- `isCoreModule`
- `getModuleVisibility`
- `getModuleState`
- `isModuleVisible`
- `isModuleEnabled`
- `isModuleExperimental`
- `isModuleInternal`
- `filterVisibleModules`
- `filterEnabledModules`
- `getVisibleModules`
- `flattenModuleTree`
- `dedupeModulesByPath`
- `groupModulesByGroup`
- `getModuleStatusLabel`
- `getModuleVisibilityLabel`
- `getModuleStateLabel`
- `getModuleBadges`
- `normalizeAppMode`
- `resolveAppModeFromEnv`
- `getAppModeFlags`
- `getAppModeTone`
- `getAppModeNotice`
- `isAppModeWriteRestricted`
- `shouldShowAppModeBanner`
- `getMonorepoApps`
- `getMonorepoAppByKey`
- `getMonorepoMonitoringSites`
- `defineErpShellFoundation`
- `getErpShellStatusBadge`
- `getErpShellPlaceholderLabel`
- `getDefaultErpShellPlaceholders`

Supported module groups are `core`, `sales`, `operations`, `finance`, `insights`, `team`, and `system`. Supported status labels include `stable`, `in_progress`, and `experimental`.

Shared shell placeholders are `offlineIndicator`, `syncStatus`, `notificationArea`, and `organizationSwitcher`. They are structural metadata only and do not implement backend sync, notifications, or tenant switching.

`getMonorepoMonitoringSites(env)` returns the config-driven site list used by Dev ERP status checks. Every registered app workspace is represented. Public and hosted apps fall back to documented defaults, while optional internal apps such as System Starter and UI Workbench remain visible as unconfigured until hosted URLs are supplied. Existing legacy monitoring ids (`nana`, `reebs`, and `faako`) are preserved where the dashboard already expects them. Apps can also define optional additional monitoring surfaces. Stroane Web has an optional `stroane-api` monitoring surface for `/health`, `/api/products`, and `/api/categories`; it is emitted only when a backend base URL env value is supplied, so the public frontend is not marked unhealthy while the backend is hosted separately or not yet deployed.

Run `pnpm run monitoring:check` from the repo root after adding apps. The script scans `apps/`, compares app directories to `src/monorepoApps/appRegistry.js`, verifies monitoring-enabled apps resolve into monitoring output, and prints only app keys/counts so private URLs and secrets are not exposed.

`getPortfolioProjects()` and `getPortfolioProjectByAppKey(appKey)` return lightweight project metadata for future byNana portfolio/case-study consumption. The current registry includes Stroane Web / Stroane Solutions as a public client website/product-catalogue project, but `caseStudyEnabled` is `false` so it should not auto-publish a public case study. Use `pnpm run project-registry:check` to review project metadata coverage. The check scans `apps/`, validates registered project metadata, and prints warnings for apps that do not yet have project metadata without failing CI.

App-mode helpers support these shared states:

- `normal`: app works normally.
- `degraded`: show a warning/banner while allowing usage.
- `read_only`: allow viewing and discourage writes; backend enforcement remains app-owned.
- `maintenance`: show a maintenance page/banner; backend enforcement remains app-owned.

Supported visibility and state metadata:

- `visibility: "visible"`: include the module in visible navigation by default.
- `visibility: "hidden"` or `hidden: true`: keep the module out of navigation while preserving route files and app behavior.
- `visibility: "internal"` or `internal: true`: render the module as visible with an internal badge.
- `state: "enabled"`: default visible and linkable state.
- `state: "disabled"` or `enabled: false`: keep the route available but render a disabled visual state for navigation.
- `state: "coming_soon"` or `comingSoon: true`: keep the route available and render a coming-soon badge.
- `status: "experimental"`, `state: "experimental"`, or `experimental: true`: render an experimental badge.

## Environment variables

Optional monitoring URL overrides can be supplied by apps that consume `getMonorepoMonitoringSites`:

- `REEBS_PORTAL_BASE_URL`
- `DEV_ERP_BASE_URL`
- `STROANE_WEB_BASE_URL`
- `STROANE_API_BASE_URL`
- `STROANE_BACKEND_BASE_URL`
- `VITE_BACKEND_BASE_URL` (used by Stroane API monitoring only when supplied to the monitoring process)
- `FAAKO_WEBSITE_BASE_URL`
- `FAAKO_API_BASE_URL`
- `REEBS_WEBSITE_BASE_URL`
- `BYNANA_PORTFOLIO_BASE_URL`
- `FAAKO_ERP_BASE_URL`
- `SYSTEM_STARTER_BASE_URL`
- `UI_WORKBENCH_BASE_URL`

If an override is not set, the helper falls back to the documented production/default URL for monitored public apps. Optional internal apps remain present with no base URL so consumers can display them as not configured.

Optional app-mode values are read by `resolveAppModeFromEnv(env)`:

- `VITE_APP_MODE` or `APP_MODE` (`normal`, `degraded`, `read_only`, `maintenance`)
- `VITE_MAINTENANCE_MODE` or `MAINTENANCE_MODE`
- `VITE_READ_ONLY_MODE` or `READ_ONLY_MODE`
- `VITE_DEGRADED_MODE` or `DEGRADED_MODE`

## Setup or migration steps

None. The helpers are consumed by app-level navigation adapters and do not require migrations or setup commands.

## Security or data impact

Navigation preparation only. These helpers prepare future controlled feature exposure, but they do not enforce auth, API permissions, database schema, billing, SaaS plan access, or data access.

## Known limitations

- Registry helpers support future visibility, disabled-key, enabled-key, permission, role, plan, and organization-module filtering hooks, but there are no database-backed module toggles yet.
- Shell placeholder constants support future offline indicators, sync status, notification areas, and organization switchers, but there is no backend-owned shell config yet.
- Disabled and coming-soon modules intentionally preserve routes for now; route blocking, redirects, and access-control enforcement remain separate future work.
- Shared helpers prepare for grouped rendering, but each app still decides whether visual grouping is safe for its current UI.
- Navigation adapters must preserve existing route and permission behavior until a separate access-control review happens.
- Monitoring helpers only provide URL/page metadata. They do not authenticate, assert service ownership, enforce uptime rules, or replace app-specific deployment checks.
- App-mode helpers only normalize config values and labels. Frontend mode banners are not sufficient protection for migrations or risky deployments; API/backend guards are still required before write protection is reliable.

## Testing notes

Use lightweight import checks or app builds to verify registry files parse, exported helpers resolve, visible modules dedupe correctly, hidden modules are ignored by navigation, badges/classes are attached safely, and legacy route targets remain intact.
