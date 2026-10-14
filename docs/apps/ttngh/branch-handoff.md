# TTNGH working branch

The Phase 1 refresh, Phase 2 implementation and initial payment foundation are preserved on `feat/ttngh-production-readiness`.

Active checkout: `/Users/Nana/Desktop/Developer/faako-system`.

Open the main `faako-system` folder when editing TTNGH. On 13 October 2026 the user requested that the main checkout switch to this branch. The checkout was clean; no stash or unrelated commit was needed. Its previous `release/workspace-develop-main-20261013` branch remains preserved at `01204d561`. All checked real environment files remained unchanged.

The former `faako-system-ttngh` worktree was subsequently removed at the user's request after checking that it held no unique edits or local configuration. Older report references to it or `/private/tmp/faako-ttngh-phase1` describe historical implementation/testing locations.

On 14 October 2026 the user explicitly requested integration into `develop`. The three TTNGH commits were applied on `integrate/ttngh-develop-20261014`, based on the latest remote develop, preserving the newer REEBS work. The lockfile conflict retained both the water-domain importer and TTNGH additions; existing non-TTNGH importers and dependency resolutions were verified unchanged.

This development integration is an explicit exception to the earlier no-merge instruction, not launch approval. Donation routes, UI, PostgreSQL runtime integration and receipt delivery remain incomplete. Follow `payments-architecture.md` and `production-readiness-plan.md`; P0 blockers still prohibit production activation. No real `.env` files, generated Studio runtime, installed dependencies or build output belong in this checkpoint.
