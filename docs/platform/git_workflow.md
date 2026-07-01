
# Git Workflow

This document describes the standard development and deployment workflow for the Stroane platform.

---

# Branch Strategy

| Branch        | Purpose                          | Deployment                          |
| ------------- | -------------------------------- | ----------------------------------- |
| `main`      | Production                       | Automatically deploys to Production |
| `develop`   | Staging                          | Automatically deploys to Staging    |
| `feature/*` | New features, fixes, experiments | Local development only              |

---

# Environment Mapping

| Environment | Website                            | Portal                                    | API                                      | Database            |
| ----------- | ---------------------------------- | ----------------------------------------- | ---------------------------------------- | ------------------- |
| Development | localhost                          | localhost                                 | Local API                                | Development         |
| Staging     | https://stage.stroanesolutions.com | https://portal-stage.stroanesolutions.com | https://api-staging.stroanesolutions.com | Stage Database      |
| Production  | https://stroanesolutions.com       | https://portal.stroanesolutions.com       | https://api.stroanesolutions.com         | Production Database |

---

# Starting a Feature

Always start from the latest develop branch.

```bash
git checkout develop
git pull origin develop
```

Create a feature branch.

```bash
git new stroane supplier-management
```

Example:

```text
feature/stroane-supplier-management
```

---

# Development

Make your changes locally.

Run the application.

```bash
pnpm run dev
```

Commit changes.

```bash
git ship feat "add supplier management"
```

Examples:

```bash
git ship feat "add purchase orders"

git ship fix "correct inventory quantities"

git ship chore "update dependencies"
```

---

# Open a Pull Request

Create a PR to **develop**.

```bash
git pr
```

Watch GitHub Actions.

```bash
git checks
```

---

# Merge to Staging

Once CI passes:

```bash
git prmerge
```

Sync local develop.

```bash
git checkout develop
git pull origin develop
```

Cloudflare and Railway will automatically deploy:

- stage.stroanesolutions.com
- portal-stage.stroanesolutions.com
- api-staging.stroanesolutions.com

---

# Test in Staging

Before every release verify:

## Storefront

- Homepage
- Search
- Product catalogue
- Cart
- Checkout
- Customer login

## Portal

- Admin login
- Dashboard
- Inventory
- Catalogue
- Customers
- Orders

## API

Health endpoint

```
https://api-staging.stroanesolutions.com/health
```

---

# Release to Production

When staging has been approved:

```bash
git release
```

This creates a PR:

```
develop
      │
      ▼
     main
```

Review the Release PR.

Merge it using GitHub (or GitHub CLI).

Production automatically deploys:

- stroanesolutions.com
- portal.stroanesolutions.com
- api.stroanesolutions.com

---

# After Release

Sync local branches.

```bash
git checkout main
git pull origin main

git checkout develop
git pull origin develop
```

---

# Hotfixes

If Production has a critical issue:

Create a branch from **main**.

```bash
git checkout main
git pull origin main

git checkout -b hotfix/login-timeout
```

After approval:

Merge into:

- main
- develop

so both remain synchronized.

---

# Database Changes

Never apply migrations directly to Production.

Workflow:

1. Create migration locally
2. Deploy migration to Stage
3. Verify functionality
4. Deploy migration to Production

---

# Seeding

Development

```bash
pnpm run db:seed
```

Staging

```bash
pnpm run db:seed:catalogue:stage
pnpm run db:sync:inventory:stage
```

Production

Only after approval.

---

# Deployment Flow

```
feature/*
      │
      ▼
 Pull Request
      │
      ▼
 develop
      │
      ▼
 Stage Deployment
      │
 Smoke Testing
      │
      ▼
 Release PR
      │
      ▼
 main
      │
      ▼
 Production Deployment
```

---

# Rules

✅ Never develop directly on `main`

✅ Never develop directly on `develop`

✅ Always use feature branches

✅ Every feature must pass CI

✅ Test every release in Staging first

✅ Production data must never be used for testing

✅ Stage and Production databases remain completely separate

---

# Quick Reference

## Start Feature

```bash
git checkout develop
git pull origin develop
git new stroane feature-name
```

## Commit

```bash
git ship feat "description"
```

## Create PR

```bash
git pr
```

## Watch CI

```bash
git checks
```

## Merge

```bash
git prmerge
```

## Release

```bash
git release
```

---

_Last Updated: June 2026_
