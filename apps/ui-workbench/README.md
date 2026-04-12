# UI Workbench

Workspace package: `@faako/ui-workbench`

UI Workbench is the local playground for the shared Faako UI system. Use it to inspect components, theme behavior, shell primitives, and visual changes before they land in product apps.

## What Lives Here

- `src/`: React and Vite workbench frontend
- shared components from `@faako/ui`
- theme integration from `@faako/theme`

## Run It Locally

```bash
pnpm --filter @faako/ui-workbench run dev
```

Equivalent root command:

```bash
pnpm run dev:workbench
```

Local frontend URL:

- `http://localhost:5181`

## Common Commands

```bash
pnpm --filter @faako/ui-workbench run build
pnpm --filter @faako/ui-workbench run preview
```

