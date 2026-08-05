# Dev ERP deployment

- **Hosting/domain:** Cloudflare/static host for the Vite frontend and Railway for Express/Prisma. The authoritative custom domains are configured in hosting/DNS; use `APP_BASE_URL`, `VITE_API_BASE` and `CORS_ORIGINS` rather than hard-coding platform URLs.
- **Build/runtime:** `pnpm --filter @faako/dev-erp run build`; API start `pnpm --filter @faako/dev-erp run server:with-migrate`. Node 22. Run Prisma deploy/status before traffic.
- **Health/logs:** `/healthz`; structured logs carry request IDs. Railway/activity events may enter the distinct audit path.
- **Preview/production:** separate database, cookie domain, CORS origins, webhook secrets, email rerouting and analytics ID. Never use production DB credentials in preview.
- **Cache/redirects/headers:** hashed Vite assets are immutable; route HTML is revalidated. Deploy `public/_headers` and `_redirects` with the frontend.
- **Rollback:** redeploy the previous frontend/API release; only roll back schema after a reviewed backward migration. Keep the previous release compatible during additive migrations.
- **Environment names:** `APP_ENV`, `NODE_ENV`, `PORT`, `API_PORT`, `DATABASE_URL`, `DATABASE_URL_DEVELOPMENT`, `DATABASE_URL_PRODUCTION`, `JWT_SECRET`, `AUTH_COOKIE_NAME`, `REFRESH_COOKIE_NAME`, `AUTH_CSRF_COOKIE_NAME`, `AUTH_COOKIE_MAX_AGE_MS`, `AUTH_COOKIE_SAME_SITE`, `AUTH_COOKIE_SECURE`, `CORS_ORIGINS`, `TRUST_PROXY_HOPS`, `VITE_API_BASE`, `VITE_AUTH_CSRF_COOKIE_NAME`, `VITE_DEFAULT_ORG_SLUG`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_ENABLE_GA_IN_DEV`, `RESEND_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `OAUTH_TOKEN_ENCRYPTION_KEY`, `MONITORING_CHANNEL_ENCRYPTION_KEY`, `RAILWAY_WEBHOOK_SECRET`, `APP_ACTIVITY_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

