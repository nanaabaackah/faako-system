# @faako/ui

Shared React UI foundations for Faako apps.

## What changed

Expanded the ERP shell foundation with reusable wrappers for topbars, page content, page headers, mobile bottom navigation frames, sidebar slots, module group rendering, and status badges.

## Where it lives

- `src/ErpShellFrame.tsx`: shell frame with sidebar, content, topbar, bottom-nav, and placeholder slots.
- `src/ErpShellTopbar.tsx`: shared topbar/header wrapper.
- `src/ErpMobileBottomNavFrame.tsx`: shared mobile bottom-nav wrapper.
- `src/ErpPageContent.tsx`: page content container.
- `src/ErpPageHeader.tsx`: section/page header pattern.
- `src/ErpModuleGroupNav.tsx`: grouped module navigation renderer.
- `src/ErpStatusBadge.tsx`: shared status/module badge pattern.
- `src/ErpNavSidebar.tsx` and `src/ErpBottomNav.tsx`: registry-friendly navigation primitives.

## How to use it

Import wrappers from `@faako/ui` and keep app-specific routes, pages, branding, and workflows in the app:

```tsx
import { ErpShellFrame, ErpShellTopbar, ErpPageContent } from "@faako/ui";
```

The shell supports registry-driven navigation metadata, module groups, module visibility states, responsive sidebar collapse, mobile bottom navigation, and placeholder slots for offline, sync, notifications, and future organization switching.

## Environment variables

None.

## Setup or migration steps

None. These are frontend shell primitives and do not require migrations.

## Security or data impact

Structural UI standardization only. No auth behavior, route behavior, API permissions, billing, database schema, or data access changed.

## Known limitations

The placeholder slots are visual/structural only. Backend-backed module toggles, org branding, offline sync, notifications, and multi-tenant controls remain future work.

## Testing notes

Run app builds for ERP apps that consume these components and verify existing sidebar, topbar, page body, and mobile bottom navigation behavior remains intact.
