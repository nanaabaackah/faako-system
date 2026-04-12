# System Starter

Workspace package: `@faako/system-starter`

System Starter is a small starter app for quickly testing or bootstrapping a Faako-style system frontend. It uses the shared UI package and React Router so new shells can start from the same baseline patterns as the production apps.

## What Lives Here

- `src/`: React and Vite starter frontend
- shared UI primitives from `@faako/ui`
- a minimal route shell for experimenting with app structure

## Run It Locally

```bash
pnpm --filter @faako/system-starter run dev
```

Equivalent root command:

```bash
pnpm run dev:starter
```

Local frontend URL:

- `http://localhost:5182`

## Common Commands

```bash
pnpm --filter @faako/system-starter run build
pnpm --filter @faako/system-starter run preview
```

