# Faako Notebook — Source-Controlled Sync Foundation

This directory provides the first **read-only** stage of the Faako Notebook
integration. The [Notion notebook](https://app.notion.com/p/40f53ad7303d817192fdc3a541ff715f)
already exists and holds the manual initial inventory and pilot references.

## Architecture and ownership

- GitHub repository: the authoritative source for code, merged PRs, workflow runs and deployment artifacts.
- Notion: curated technical references, learning guides, change journal and architectural decisions.
- CI impact workflow: reports paths changed between full commit SHAs. It is **not** a Notion publisher.
- Future synchronization: a separately reviewed service using a restricted Notion integration, no raw repository dumps.

Current Notion sections:

| Section | Link |
| --- | --- |
| Home | https://app.notion.com/p/40f53ad7303d817192fdc3a541ff715f |
| Component Registry | https://app.notion.com/p/1f65360859f84451aeaa2d55e5e67321 |
| Development Journal | https://app.notion.com/p/ca3c79c78a804621a06e4bcd2471bf64 |
| Decision Register | https://app.notion.com/p/077fbe4940d54d4c9be0aec6d64fd620 |
| Engineering Academy | https://app.notion.com/p/2df4ed6bb5df4bb9b8dee39e4bac5d14 |

## Read-only change-impact analyzer

`node scripts/notebook/impact.mjs --base <full-40-char-sha> --head <full-40-char-sha>`

Produces deterministic JSON with:

- changed file paths
- affected component paths
- manual review flags and reasons
- `status: impact-analysis-only`, `verified: false` and `syncedToNotion: false`

Shared package changes are not assumed safe for downstream apps. They are explicitly
flagged for a dependent-app review. Directory existence does not prove deployment
or operational success. Unmapped files also force a manual review.

The [Faako Notebook Impact workflow](../../.github/workflows/faako-notebook-impact.yml)
runs classification on PRs and pushes to `develop` or `main`, and supports
manual comparison by full commit SHA. The workflow has `contents: read` permission,
writes a short-lived JSON artifact, and uses no Notion secrets or API permissions.

Test locally:

```bash
node --test scripts/notebook/impact.test.mjs
```

## Baseline currently initialized in Notion

- 38 pnpm workspace members: 15 top-level apps, 21 shared packages, TTNGH Studio and TTNGH API.
- One extra Python analytics service is indexed separately.
- Pilot references: REEBS Portal and Travel With Ease web, portal and API.
- Journal: merged PRs #129 (develop) and #131 (main), **not** assumed deployed.
- Academy: two introductory draft lessons.

This bootstrap was manually entered from the repository on 2026-11-05; it
is **not continuously synchronized yet**. The initial baseline on `develop` was
commit `62a57920a15192416ea704c9a3c8d903d1dedbe0`; the observed `main`
head was `bfe97be3e72f405ba1695afe1b142d9d5773ffa8`.

## Planned write-enabled stages (not implemented)

1. Build a GitHub event collector with immutable event IDs, SHA-scoped evidence
   references and per-component diff extraction.
2. Add deterministic content generation with a strict allowlist of repository
   sources, structural diff, and defense against prompt injection.
3. Add a `Notion` adapter for *targeted* page updates and idempotent journal
   upserts. Store the Notion integration token only in protected GitHub secrets,
   grant access only to the notebook and use least privilege.
4. Add dry-run/test fixtures and a human review gate for code claims, permissions,
   schema, critical financial or tenant data, and deployment claims.
5. Keep CI result, main branch merge, provider deployment and customer acceptance
   as separate provenance states. Deployment must have a provider-issued ID,
   environment and verified artifact SHA.
6. Reconcile periodically from stored SHAs; keep an append-only event log and
   recover safely after partial writes.
7. Only enable live writes after replay, deduplication, concurrency, rollback,
   privacy scan and scoped-access testing.

No secrets, credentials, raw customer records or private operational payloads
belong in generated documentation or CI artifacts.
