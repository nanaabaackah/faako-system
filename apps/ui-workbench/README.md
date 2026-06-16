# UI Workbench

Workspace package: `@faako/ui-workbench`

UI Workbench is the local playground for the current shared UI system. Use it to inspect `@faako/ui`, `@faako/theme`, responsive shell behavior, shared form styling, and Safari/WebKit compatibility work before those changes land in product apps.

## What Lives Here

- `src/`: React + Vite workbench screens and examples
- shared components from `@faako/ui`
- theme and shell CSS from `@faako/theme`

## Run It Locally

```bash
pnpm --filter @faako/ui-workbench run dev
```

Equivalent root shortcut:

```bash
pnpm run dev:workbench
```

Typical local URL:

- `http://localhost:5181`

## Current System Notes

- useful for checking shared sidebar width, collapse behavior, field sizing, and modal shells in isolation
- the best place to confirm cross-app shared UI changes before touching product-specific screens
- includes `AppUpdateNotice` from `@faako/ui` so the shared deployed-bundle refresh prompt can be inspected with the rest of the design system

## Common Commands

```bash
pnpm --filter @faako/ui-workbench run build
pnpm --filter @faako/ui-workbench run preview
```
