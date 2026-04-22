# Stroane Web

Workspace package: `stroane-web`

Stroane Web is a full-stack e-commerce store. It pairs a React/TypeScript frontend with an Express 5 backend and a Prisma-managed PostgreSQL database for product browsing and purchasing.

## What Lives Here

- `src/`: React 19 + TypeScript frontend (pages, components, API client, types)
- `backend/`: Express 5 API server, route handlers, and middleware
- `prisma/`: Prisma schema and migrations
- `vite.config.ts`: Vite dev server and build config
- `.env.example`: environment variable reference

## Run It Locally

Install from the repo root first:

```bash
pnpm install
```

Start both frontend and backend together:

```bash
pnpm --filter stroane-web run dev:with-backend
```

Or run each side separately:

```bash
# Terminal 1 — frontend (port 5175)
pnpm --filter stroane-web run dev:frontend

# Terminal 2 — backend (port 3000)
pnpm --filter stroane-web run server:dev
```

## Database

```bash
pnpm --filter stroane-web run db:migrate:dev
pnpm --filter stroane-web run db:studio
pnpm --filter stroane-web run db:status:dev
pnpm --filter stroane-web run db:status:prod
```

## Build and Deploy

```bash
pnpm --filter stroane-web run build
pnpm --filter stroane-web run db:deploy:prod
pnpm --filter stroane-web run server:prod
```

## Configuration

Use `apps/stroane-web/.env.example` to create an untracked local env file.

| Variable | Description | Example |
| --- | --- | --- |
| `PORT` | Backend server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost/stroane` |
| `VITE_BACKEND_BASE_URL` | Frontend API base URL | `http://localhost:3000` |

Only browser-safe values should use the `VITE_*` prefix.

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/api/products` | List products |
| `GET` | `/api/products/:id` | Single product |
