# REEBS Analytics compatibility deployment

The logical service is now Faako Analytics. Use
[`shared-analytics-service.md`](./shared-analytics-service.md) as the deployment
source of truth. This document records the temporary REEBS-compatible boundary.

- **Hosting/domain:** private Railway/container service; no public custom domain is required. Allow only approved backend/network paths.
- **Build/runtime:** build `services/reebs-analytics/Dockerfile`; run Uvicorn from the image. Python requirement is 3.11+; CI uses 3.12.
- **Health/logs:** `GET /health` is non-sensitive. Dashboard insights require the bearer service secret and fail closed if absent. Use container logs; do not log snapshots containing customer/business detail.
- **Preview/production:** use separate service secrets and network endpoints. Preview snapshots must be synthetic/non-production.
- **Cache/redirects/headers:** insights are request-specific and not publicly cached. No redirects/static headers are owned by the service.
- **Rollback:** redeploy the prior image. The service is read-only and owns no database migration.
- **Compatibility environment names:** `REEBS_ANALYTICS_SERVICE_SECRET`, `REEBS_ANALYTICS_TENANT_IDS`.
