# Moving REEBS to a separate Railway project

The safe long-term layout is one dedicated Railway project for REEBS with two
persistent environments:

- `staging`, deployed from `develop`
- `production`, deployed from the approved production branch

Each environment must have its own API deployment, Postgres database,
variables, domains, and provider credentials. Do not copy production secrets
or production data into staging.

## Staging service setup

Create the new project and its `staging` environment without changing or
deleting the existing production service. Add a GitHub-backed API service and
a new Postgres service in staging.

Use the repository root as the source root because REEBS consumes shared
workspace packages and root scripts. Configure:

```text
Trigger branch: develop
Build command: node ./scripts/railway-service.mjs build
Start command: node ./scripts/railway-service.mjs start
Healthcheck path: /ready
```

Set `RAILWAY_WORKSPACE` to `@faako/reebs-portal` before the first build. Also
set `APP_ENV` to `staging` and `NODE_ENV` to `production`. Supply every other
required variable listed in [STAGING.md](./STAGING.md) using staging-specific
values. Reference the new staging Postgres service for `DATABASE_URL`; never
reuse or fall back to the production database URL.

Recommended watch paths for the API service are:

```text
/apps/reebs-portal/**
/packages/**
/scripts/railway-service.mjs
/scripts/workspace-graph.mjs
/package.json
/pnpm-lock.yaml
/pnpm-workspace.yaml
/nixpacks.toml
/turbo.json
```

Generate a temporary Railway domain first. Configure the staging portal and
storefront to use that API origin, then configure the matching staging browser
origins in `REEBS_PORTAL_URL`, `REEBS_WEBSITE_URL`, and
`CORS_ORIGINS_STAGING`. Verify:

1. `/live` returns success.
2. `/ready` returns success and therefore confirms a database `SELECT 1`.
3. `/health/water` reports the standalone Water configuration separately.
4. Login, portal API requests, storefront catalogue/cart/checkout, Paystack
   test mode, and the controlled email sink work.

Only after these checks should the staging API custom domain be attached and
the corresponding Cloudflare staging variables be updated. A healthcheck
protects deployment activation, but it is not continuous monitoring.

## Production isolation check

Before enabling staging autodeploys, confirm manually in the platform UIs:

- the new Railway staging service watches `develop` only;
- the existing Railway production service does not watch `develop`;
- the live Cloudflare projects still use the production branch;
- the staging Cloudflare projects use staging-only API and frontend origins;
- staging has its own Postgres and no production provider credentials;
- no production DNS record points to the new service.

Merging into `develop` then changes staging only. It cannot affect production
unless production is also configured to deploy `develop`, a production domain
is reassigned, or production variables/data are reused.

## Production move after staging approval

Do not move the live service and database during the first staging deployment.
When staging has been accepted:

1. Create the new project's `production` environment and production API
   service without changing the old service.
2. Take and verify a production database backup.
3. Provision the new production Postgres service.
4. Transfer data with a reviewed logical `pg_dump`/`pg_restore` procedure if a
   cross-project database move is required. Railway volume backups are scoped
   to their project/environment and are not the cross-project transfer method.
5. Run the deployed migration path against the new database.
6. Deploy the exact commit already accepted in staging and verify it through a
   temporary Railway domain.
7. Put the old system in the agreed write-control/maintenance window, perform
   the final data sync, and re-run the smoke checks.
8. Attach or repoint the production API domain only after verification.
9. Keep the old service and database intact during the rollback window.

The cutover needs a separate approved runbook because it changes live data and
DNS. Never delete the old service or database as part of the initial cutover.
