# Enable Faako Notebook’s controlled GitHub → Notion synchronization

**Current stage:** code is on draft PR #132, targeting `develop`. No Notion token
is stored in GitHub and write-enabled synchronization is **off by default**.

This integration updates **only** the existing Faako Notebook Component Registry
and Development Journal:

- Component Registry source ID: `1128a226-113d-4be0-80d7-df8df99f374f`
- Development Journal source ID: `88e12d00-eb97-4d0d-a745-1f5b6faf94fc`
- Notebook root: `40f53ad7-303d-8171-92fd-c3a541ff715f`

It does not modify the public websites, databases, customer data, finance,
permissions, production deployment, detailed reference text or decisions.

## 1. Create a dedicated private Notion integration

Use the Notion web app in the workspace containing
[Faako Notebook](https://app.notion.com/p/40f53ad7303d817192fdc3a541ff715f).

1. In Notion, open **Settings → Connections**. Enable **Developer Mode** if
   prompted. Open developer connections/personal access tokens, then create a
   new internal connection named **Faako Notebook Sync** (the exact labels may
   differ slightly by workspace).
2. Choose the workspace that contains Faako Notebook.
3. Give it **Read content**, **Insert content**, and **Update content** only.
   Do not grant destructive/admin permissions.
4. Open the notebook and use its **••• → Connections** menu to connect it to
   **Faako Notebook Sync**. Check that the integration can also access the
   **Component Registry** and **Development Journal** databases; share those
   pages explicitly if inherited access does not suffice.
5. Copy the integration token into your password manager, not into a public
   issue, Notion document, repository file or ChatGPT conversation.

The ChatGPT Notion connector is not this standalone GitHub Actions integration.
The two integrations have independent authentication.

Official Notion guide:
https://www.notion.com/help/create-integrations-with-the-notion-api

## 2. Configure the GitHub Action securely

Open
[faako-system](https://github.com/nanaabaackah/faako-system) → **Settings** →
**Secrets and variables** → **Actions**.

Under **Repository secrets**, create:

- Name: `FAAKO_NOTEBOOK_NOTION_TOKEN`
- Value: the private Notion integration token

Under **Repository variables**, create:

- Name: `FAAKO_NOTEBOOK_SYNC_ENABLED`
- Initial value: `false` (or leave the variable absent)

The write step will refuse to run until the variable equals `true` and the
secret is present. No secret value appears in an Actions artifact.

## 3. Review and merge the draft integration PR

[PR #132](https://github.com/nanaabaackah/faako-system/pull/132)
contains the isolated sync implementation and test suite.

Review the diff and CI reports before merging into `develop`. The existing
production branch (`main`) and application code remain unchanged. The first
merge/push event generates a dry-run report with write mode disabled.

For a manual workflow run, GitHub requires the workflow to be present on the
repository's default branch. Until the workflow is promoted to `main`,
normal `develop` pushes/merged PR events are the path to dry-run validation.

## 4. Enable controlled writes

Only after verifying Notion's database access, the green sync tests and the
dry-run report, set the repository variable
`FAAKO_NOTEBOOK_SYNC_ENABLED` to `true`.

The next verified merged PR pushed to `develop` or `main` will:

1. Re-query GitHub for a merged PR number, merged time, target branch, merge SHA
   and changed filenames (never trust PR description text as instructions).
2. Verify that the merge SHA is an ancestor of the target branch.
3. Resolve affected components to unique existing Registry entries.
4. Look up the Journal's **Sync Key** to prevent duplicate PR rows.
5. Append a code-change review note to affected component pages if the event
   marker is not already present. The note explicitly does not claim CI or
   deployment success.
6. Preserve all existing technical references, learning guides and decisions.

GitHub Actions uses a repository-wide concurrency group; it will not run two
Notion writer jobs in parallel. An ambiguous API failure stops the job. A retry
re-queries the journal and page markers before creating/appending.

## 5. Disable and recover

To stop all automated writes immediately, set
`FAAKO_NOTEBOOK_SYNC_ENABLED=false` or delete the repository secret.
Run dry-run in Actions to observe verification without a Notion write.

If a job fails partway, **do not delete or duplicate pages manually**.
Read the job log for the PR number and Sync Key. After diagnosing credentials,
permissions or Notion API availability, re-run the failed job. The adapter
checks stored Sync Keys and page markers before writing.

If duplicates were created outside this serialized workflow, or if a component
has an ambiguous registry path, the sync fails closed and requires manual
cleanup/review. Notion writes here are append-only.

## What is and is not automated

| Capability | Current implementation |
| --- | --- |
| Identify affected apps and packages | Yes; review shared-package effects manually |
| GitHub merged PR journal | Code ready; requires activation |
| Component activity/change notes | Code ready; requires activation |
| Idempotent retry | Automated safeguards; no transactional cross-API guarantee |
| Change documentation reference text | No, intentionally preserves curated sections |
| CI result history | Not yet automatic |
| Provider deployment status | Not yet automatic |
| Nightly full-history reconciliation | Not yet automatic |
| Engineering Academy lesson generation | Not yet automatic |
| AI-written engineering explanations | Not yet automatic |

**Security invariant:** a merged PR is **code evidence**, not evidence of successful
tests, hosted deployment, production acceptance or a user-visible feature launch.

## Technical testing

```bash
node --test scripts/notebook/*.test.mjs
node scripts/notebook/impact.mjs --base <40-char-sha> --head <40-char-sha>
```

In GitHub Actions, `Faako Notebook Sync (controlled)` produces a GitHub-only
preview even when write mode is disabled.

Source: `scripts/notebook/sync-core.mjs`, `notion-adapter.mjs` and
`sync-cli.mjs`; `.github/workflows/faako-notebook-sync.yml`.

Notion REST API version used: `2025-09-03`, with
`POST /v1/data_sources/{id}/query`, `POST /v1/pages`, and
`PATCH /v1/blocks/{id}/children`. Upgrade separately after reviewing Notion's
version changes; never silently switch schemas.
