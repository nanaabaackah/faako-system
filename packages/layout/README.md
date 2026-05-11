# @faako/layout

Shared ERP layout contracts for Faako apps.

## What changed

Added a low-level package for ERP shell region names, layout modes, responsive breakpoints, placeholder slot names, and class-name helpers.

## Where it lives

- `src/index.ts`: exports shell layout constants and helper functions.

## How to use it

Use the constants when shared UI or app shells need stable region names:

```ts
import { ERP_SHELL_REGIONS, getErpShellRegionProps } from "@faako/layout";
```

This package is intentionally framework-light. React components live in `@faako/ui`; shell metadata and registry helpers live in `@faako/config`.

## Environment variables

None.

## Setup or migration steps

None.

## Security or data impact

Structural UI standardization only. No auth, permissions, database, billing, route, or data access behavior changes.

## Known limitations

The package defines contracts for future module toggles, org branding, offline sync, notifications, and multi-tenant context, but does not implement backend persistence or enforcement.

## Testing notes

Use package import checks and app builds that consume `@faako/ui` shell components.
