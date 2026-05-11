# @faako/theme

Shared CSS theme foundations for Faako apps.

## What changed

Added ERP shell CSS patterns for topbar wrappers, page content/header wrappers, module group rendering, mobile bottom-nav frames, shell placeholder slots, and shared status badges.

## Where it lives

- `src/erp-shell.css`: ERP shell and navigation CSS.
- `src/system.css`: broader UI system tokens.

## How to use it

The CSS is imported by `@faako/ui`, so apps that consume shared ERP shell components get these classes automatically.

## Environment variables

None.

## Setup or migration steps

None.

## Security or data impact

Structural UI standardization only. No auth, route, permission, database, or data access behavior changed.

## Known limitations

The shell placeholder styles are ready for offline, sync, notifications, and organization-switcher UI, but no backend data source is connected yet.

## Testing notes

Run affected ERP app builds and visually check sidebar, topbar, page body, status badges, and mobile bottom navigation spacing.
