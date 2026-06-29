
# Faako Git & GitHub Workflow

## Overview

This repository uses Git Flow with protected branches and automated CI/CD.

```
feature/* → develop → main
```

- **feature/*** = Development
- **develop** = Staging
- **main** = Production

---

# Branch Strategy

## Start a new feature

### Stroane

```bash
git stroane supplier-management
```

Creates:

```
feature/stroane-supplier-management
```

### REEBS

```bash
git reebbs payment-reminders
```

### Dev ERP

```bash
git deverp deployment-dashboard
```

### Faako Website

```bash
git faako homepage-redesign
```

### Portfolio

```bash
git portfolio case-study
```

---

# Commit & Push

## Feature

```bash
git feat stroane "add supplier management"
```

Produces:

```
feat(stroane): add supplier management
```

Automatically:

- Stages files
- Creates commit
- Pushes current branch

---

## Fix

```bash
git fix stroane "resolve authentication issue"
```

Produces:

```
fix(stroane): resolve authentication issue
```

---

## Chore

```bash
git chore ci "update monorepo workflow"
```

Produces:

```
chore(ci): update monorepo workflow
```

---

# Pull Requests

Create a Pull Request to **develop**

```bash
git pr
```

Watch GitHub Actions

```bash
git checks
```

Merge the Pull Request

```bash
git merge
```

---

# Release

Promote **develop** to **main**

```bash
git release
```

---

# Development Workflow

## 1. Create feature branch

```bash
git stroane inventory-alerts
```

## 2. Build the feature

Make your code changes.

## 3. Commit

```bash
git feat stroane "add inventory alerts"
```

## 4. Open Pull Request

```bash
git pr
```

## 5. Watch CI

```bash
git checks
```

## 6. Merge into develop

After CI passes:

```bash
git merge
```

## 7. Test on staging

Verify:

- Website
- Portal
- API
- Database

## 8. Release

```bash
git release
```

---

# CI (Continuous Integration)

Every Pull Request automatically runs:

- Install dependencies
- Prisma validation
- ESLint
- Backend tests
- Storefront build
- Portal build

A Pull Request cannot be merged until CI succeeds.

---

# CD (Continuous Deployment)

## Cloudflare Pages

Production

```
main
```

Preview

```
develop
feature/*
```

---

## Railway

Production

```
main
→ Production API
→ Production Database
```

Staging

```
develop
→ Stage API
→ Stage Database
```

Development

```
feature/*
→ Local development or Dev API
→ Dev Database
```

---

# Infrastructure

## APIs

- Production API
- Stage API
- Dev API

## Databases

- Production Database
- Stage Database
- Dev Database

---

# Environment Variables

Each environment uses the same variable names.

Only the values change.

Core variables include:

- APP_ENV
- NODE_ENV
- DATABASE_URL
- APP_AUTH_SECRET
- JWT_SECRET
- REFRESH_TOKEN_SECRET
- AUTH_COOKIE_SECURE
- AUTH_COOKIE_SAME_SITE
- SESSION_COOKIE_SECURE
- SESSION_COOKIE_SAME_SITE
- CORS_ORIGINS
- TRUST_PROXY_HOPS

---

# Long-term Goal

Eventually these Git aliases will become a dedicated **Faako CLI**.

Example:

```bash
faako new stroane supplier-management
faako ship feat "add supplier management"
faako release
faako deploy stage
faako deploy production
faako status
```

The CLI will manage Git, GitHub, Cloudflare, Railway and deployments from a single interface.
