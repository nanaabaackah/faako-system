# Faako ERP deployment

Faako ERP is currently a React/Vite fixture/demo surface, not an independently approved authoritative ERP backend.

- **Hosting/domain:** static preview/internal host only until product status is approved. Do not present fixture data as production records.
- **Build/runtime:** `pnpm --filter @faako/faako-erp run build`; output `apps/faako-erp/dist`.
- **Health/logs:** static route smoke and hosting health. No backend health is owned by this workspace.
- **Preview/production:** preview is supported; production promotion requires an ADR/product decision and authoritative API boundary.
- **Cache/redirects/headers:** deploy `public/_headers` and `_redirects`; immutable hashed assets, SPA fallback only for its internal routes.
- **Rollback:** redeploy the previous static artifact.
- **Environment names:** `VITE_FAAKO_ERP_DEMO_ACCESS_ENDPOINT`, `VITE_FAAKO_ERP_DEMO_ACCESS_MODE`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_ENABLE_GA_IN_DEV`, `VITE_ENABLE_APP_UPDATE_NOTICE`.

