# @faako/types

Shared TypeScript contracts for Faako apps and packages.

## What changed

Added ERP shell layout and placeholder metadata types to support shared shell foundations.

## Where it lives

- `src/index.ts`: shared app, shell, navigation, form, feedback, and table types.

## How to use it

Use `ErpShellConfig`, `ErpShellFoundation`, and `ErpShellPlaceholders` for shell metadata contracts shared by config and UI packages.

## Environment variables

None.

## Setup or migration steps

None.

## Security or data impact

Structural typing only. No runtime behavior, auth, database, or data access changed.

## Known limitations

The types describe placeholder support for future offline/sync/notifications/org switching, but do not implement those systems.

## Testing notes

Run TypeScript-aware app/package builds that consume `@faako/types`.
