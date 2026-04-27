# System Starter

Workspace package: `@faako/system-starter`

System Starter is the smallest current app shell in the repo. Use it when you want a new frontend to start from the same shared shell system, provider stack, and router conventions as the active apps without carrying over product-specific code.

## What Lives Here

- `src/`: React + Vite starter routes and shell wiring
- shared shell primitives from `@faako/ui`
- shared theme tokens from `@faako/theme`

## Run It Locally

```bash
pnpm --filter @faako/system-starter run dev
```

Equivalent root shortcut:

```bash
pnpm run dev:starter
```

Typical local URL:

- `http://localhost:5182`

## Current System Notes

- mirrors the shared sidebar, topbar, and field foundations used across the ERP apps
- good for validating shared shell changes before copying product-specific flows into a new app

## Common Commands

```bash
pnpm --filter @faako/system-starter run build
pnpm --filter @faako/system-starter run preview
```
