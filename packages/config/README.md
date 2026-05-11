# @faako/config

Shared configuration helpers for Faako apps.

## What changed

Added the shared ERP module registry foundation under `src/erpModules/`, extended it for safe navigation adapters across ERP apps, added a module visibility/state layer for future module exposure controls, and added shared ERP shell placeholder/status constants.

## Where it lives

- `src/erpModules/moduleGroups.js`: shared ERP module group constants.
- `src/erpModules/moduleStatuses.js`: shared ERP module status constants.
- `src/erpModules/moduleStates.js`: shared ERP module visibility and state constants.
- `src/erpModules/registryHelpers.js`: shared lookup and filtering helpers.
- `src/erpShell/shellFoundation.js`: shared ERP shell placeholder and status badge constants.
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
- `defineErpShellFoundation`
- `getErpShellStatusBadge`
- `getErpShellPlaceholderLabel`
- `getDefaultErpShellPlaceholders`

Supported module groups are `core`, `sales`, `operations`, `finance`, `insights`, `team`, and `system`. Supported status labels include `stable`, `in_progress`, and `experimental`.

Shared shell placeholders are `offlineIndicator`, `syncStatus`, `notificationArea`, and `organizationSwitcher`. They are structural metadata only and do not implement backend sync, notifications, or tenant switching.

Supported visibility and state metadata:

- `visibility: "visible"`: include the module in visible navigation by default.
- `visibility: "hidden"` or `hidden: true`: keep the module out of navigation while preserving route files and app behavior.
- `visibility: "internal"` or `internal: true`: render the module as visible with an internal badge.
- `state: "enabled"`: default visible and linkable state.
- `state: "disabled"` or `enabled: false`: keep the route available but render a disabled visual state for navigation.
- `state: "coming_soon"` or `comingSoon: true`: keep the route available and render a coming-soon badge.
- `status: "experimental"`, `state: "experimental"`, or `experimental: true`: render an experimental badge.

## Environment variables

None.

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

## Testing notes

Use lightweight import checks or app builds to verify registry files parse, exported helpers resolve, visible modules dedupe correctly, hidden modules are ignored by navigation, badges/classes are attached safely, and legacy route targets remain intact.
