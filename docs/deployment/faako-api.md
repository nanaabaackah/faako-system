# Faako API deployment

- **Hosting/domain:** Railway service; the public domain is platform/DNS configuration and must match frontend `ALLOWED_ORIGIN`/CORS configuration.
- **Build/runtime:** no frontend build. Generate/deploy Prisma, then `pnpm --filter @faako/faako-api run railway:start` on Node 22.
- **Health/logs:** use the service health endpoint and Railway logs; errors must be user-safe and request/audit data redacted.
- **Preview/production:** use separate databases, email routing, onboarding recipients and webhook secrets. Preview must not send real customer email.
- **Cache/redirects/headers:** API responses are not a static cache target unless a route explicitly declares safe caching. No public-route redirects are owned here.
- **Rollback:** redeploy prior service image/release; preserve forward-compatible schema. Never use a destructive database reset for rollback.
- **Environment names:** `APP_ENV`, `NODE_ENV`, `PORT`, `DATABASE_URL`, `DATABASE_URL_DEVELOPMENT`, `DATABASE_URL_LOCAL`, `DATABASE_URL_PRODUCTION`, `ALLOWED_ORIGIN`, `ALLOW_PRODUCTION_DATABASE_IN_DEV`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `EMAIL_FORCE_TO`, `INTAKE_ADMIN_EMAIL`, `FAAKO_ONBOARDING_ADMIN_EMAIL`, `FAAKO_ONBOARDING_FROM_EMAIL`, `FAAKO_ONBOARDING_FROM_NAME`, `FAAKO_ERP_DEMO_ACCESS_SECRET`, `APP_ACTIVITY_WEBHOOK_URL`, `APP_ACTIVITY_WEBHOOK_SECRET`, `DEV_ERP_API_BASE_URL`, `DEV_ERP_ACTIVITY_WEBHOOK_URL`, `DEV_ERP_ACTIVITY_WEBHOOK_SECRET`, `EXPOSE_DEBUG_ERRORS`.
