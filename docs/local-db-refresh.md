# Local Database Refresh

Use the shared refresh runner to replace development/local PostgreSQL data with the current production snapshot on a two-week cadence.

The runner discovers workspace apps with PostgreSQL/Prisma dependencies, PostgreSQL Prisma schemas, or database URL env files. In this workspace, that includes:

- `@faako/dev-erp`
- `@faako/faako-api`
- `@faako/faako-website`
- `@faako/reebs-portal`
- `@faako/reebs-website`
- `@faako/stroane-web`

## Environment Contract

Each app should expose:

- Production source: `DATABASE_URL_PRODUCTION`, falling back to `DATABASE_URL`
- Development/local target: `DATABASE_URL_DEVELOPMENT` or `DATABASE_URL_LOCAL`

The runner never uses plain `DATABASE_URL` as the refresh target. It also refuses to run when the source and target resolve to the same database.

## Commands

Preview the refresh without touching any database:

```bash
pnpm run db:refresh:local:dry
```

List discovered apps and whether each one has the required URLs:

```bash
pnpm run db:refresh:local -- --list
```

Run the refresh after checking the dry run:

```bash
pnpm run db:refresh:local -- --yes
```

Run one app:

```bash
pnpm run db:refresh:local -- --app reebs-portal --yes
```

Run only when at least 14 days have passed since the last successful refresh:

```bash
pnpm run db:refresh:local:biweekly
```

If a development target is hosted remotely instead of on localhost, opt in explicitly:

```bash
REFRESH_LOCAL_DBS_ALLOW_REMOTE_TARGETS=1 pnpm run db:refresh:local:biweekly
```

## What It Does

For each ready app, the runner:

1. Creates a custom-format backup of the development/local target.
2. Dumps the production source with `pg_dump`.
3. Drops and recreates the target `public` schema.
4. Restores the production snapshot into the target with `pg_restore`.
5. Writes the last successful run timestamp to `~/.faako/local-db-refresh/state.json`.

Backups are written to `~/.faako/local-db-refresh/backups` by default. Override with:

```bash
REFRESH_LOCAL_DBS_BACKUP_DIR=/path/to/backups pnpm run db:refresh:local -- --yes
```

## Biweekly Automation

Schedule the command to run daily or weekly and let `--due-days 14` enforce the two-week cadence.

Example cron entry:

```cron
0 7 * * * cd /path/to/faako-system && REFRESH_LOCAL_DBS_ALLOW_REMOTE_TARGETS=1 /usr/local/bin/pnpm run db:refresh:local:biweekly >> "$HOME/.faako/local-db-refresh/refresh.log" 2>&1
```

The remote-target flag is only needed when `DATABASE_URL_DEVELOPMENT` points at a remote development database. Omit it for local PostgreSQL targets such as `localhost` or `127.0.0.1`.

## Requirements

The machine running the job needs PostgreSQL client tools on `PATH`:

- `pg_dump`
- `pg_restore`
- `psql`

On macOS with Homebrew:

```bash
brew install libpq
brew link --force libpq
```
