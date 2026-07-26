# @faako/types

Framework-independent TypeScript contracts for Faako apps, packages, APIs, and
integration boundaries.

## What changed

Added shared business-domain contracts for identity, access, catalogue,
operations, commerce, people, and audit boundaries. React-specific table and
icon-renderer contracts now live in `@faako/ui`.

## Where it lives

- `src/domain.ts`: framework-independent business-domain contracts.
- `src/index.ts`: public exports plus existing framework-independent app, shell,
  navigation, form, and feedback contracts.

## How to use it

Use the domain contracts at API-client, event, and integration boundaries.
Extend them locally when an application has additional fields with
application-specific meaning. Use `ErpShellConfig`, `ErpShellFoundation`, and
`ErpShellPlaceholders` for shared shell metadata.

## Environment variables

None.

## Setup or migration steps

None.

## Security or data impact

Structural typing only. The package contains no React, Vite, Astro, Express, or
Prisma imports. It does not expose credentials, sessions, database relations, or
ORM-generated types.

## Known limitations

Statuses and identifiers remain deliberately open because applications own
their lifecycles and use both string and integer IDs. Existing API payloads need
explicit adapters when their money representation or field names differ.

## Testing notes

Run `pnpm --filter @faako/types typecheck` and type-check any application that
adopts a shared contract.
