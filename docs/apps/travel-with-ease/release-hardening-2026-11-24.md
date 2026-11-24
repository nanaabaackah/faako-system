# TWE release hardening — P0-01 database predeployment

Audit baseline: 2026-11-24. Staging release candidate `613e0bf65f3c2c6b3aeefb5ee47e789ad108ceb7`. Work remains on the readiness branch; no live changes or release approval.

## Observed evidence

- Railway production deployment `d2482a3a-cc3e-46c3-ad4e-0a5c1fa2ba8d` built its image but failed `db:deploy` during phase `migrations`, reporting `database_unavailable`. The hook advances to this phase only after SELECT 1 and migration-login validation, so an initial TLS/network/login failure is not established by this record.
- The production and staging API services have the same predeploy and start commands. Both define DATABASE_URL, TWE_MIGRATION_DATABASE_URL, TWE_DATABASE_CA, TWE_DATABASE_TLS and migration approval/identity settings. Values were not read; presence is not correctness.
- Production build override is install-only (`pnpm --filter @faako/travel-with-ease-api... install --frozen-lockfile`), whereas staging uses `pnpm --filter @faako/travel-with-ease-api railway:build`. The latter embeds the CMS. Correct the production build override during the approved infrastructure release; do not create duplicate provider settings.
- Production has API and PostgreSQL services; staging also has notification and publication workers. Production API variable names do not include TWE_PAGES_ACCOUNT_ID, TWE_PAGES_API_TOKEN, TWE_PAGES_BRANCH, TWE_PAGES_PROJECT or TWE_TURNSTILE_SECRET_KEY; verify the effective environment and worker requirements before provisioning anything. No secrets or values are included here.

## Branch work

The predeploy classifier now recognizes the exact existing runtime-role guard messages, plus PostgreSQL cancellation/lock/deadlock SQLSTATEs, using fixed guidance only. Regression cases cover these classifications. This is diagnostic hardening, not proof of the original root cause or a change to the migration policy.

## Controlled release checklist (not executed)

1. Confirm backup/restore evidence and intended environment/database identity.
2. Check existing private reference endpoints and effective runtime/migrator roles in the Railway environment; preserve distinct least-privilege credentials. Check runtime role attributes, membership, ownership and CREATE privilege before adjusting anything. Do not use an admin or migration role as the runtime role.
3. Inspect migration ledger checksums, migration order and any lock contention. Do not edit applied migrations or reset the database.
4. Keep verified TLS enabled; reuse the existing trusted CA or Node trust where valid. Do not create or duplicate Railway-provided URL variables merely to change their names.
5. Align the production build command to the existing staging railway:build command. Retain db:deploy and the start command.
6. After explicit release authorization, rerun a controlled predeploy and verify runtime readiness and the embedded CMS. Record the exact safe diagnostic if it fails; no automatic reset or blind retries.

## Gate

P0-01 is open until a production predeploy and runtime readiness check succeed. Branch CI and isolated database tests do not close the live gate. P0-02 through P0-05 remain open. Trello: https://trello.com/c/Hri5RyJ4 and https://trello.com/c/uMtsq7vq.
