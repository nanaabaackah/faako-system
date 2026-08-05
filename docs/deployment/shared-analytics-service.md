# Shared analytics service deployment

## Runtime and build

- **Logical service:** `faako-analytics`
- **Compatibility source path:** `services/reebs-analytics`
- **Runtime:** Python 3.12 container; code supports Python 3.11+
- **Build:** Dockerfile or `python -m pip install .`
- **Start:** Uvicorn `app.main:app`
- **Health:** `/health`
- **Readiness:** `/ready`
- **Network:** private/internal service networking preferred; never directly exposed to browsers

## Environment-variable names

Service:

- `PORT`
- `FAAKO_ANALYTICS_SERVICE_TOKENS`
- `FAAKO_ANALYTICS_SERVICE_SECRET`
- `FAAKO_ANALYTICS_LOG_LEVEL`
- `REEBS_ANALYTICS_SERVICE_SECRET`
- `REEBS_ANALYTICS_TENANT_IDS`

Consumer aliases:

- `FAAKO_ANALYTICS_SERVICE_URL`
- `FAAKO_ANALYTICS_SERVICE_SECRET`
- `REEBS_ANALYTICS_SERVICE_URL`
- `REEBS_ANALYTICS_SERVICE_SECRET`

Do not configure transactional database, payment or browser-public secrets in this service.

## Deployment sequence

1. Build/test the image with isolated Python dependencies.
2. Configure caller-scoped credentials and private network route.
3. Deploy the service while legacy REEBS endpoint/configuration remains active.
4. Verify `/health`, `/ready`, one authorised tenant request and one denied tenant request.
5. Deploy consumer adapters and observe fallback/error rates.
6. Rotate/remove legacy aliases only in a later verified migration.

## Monitoring

Monitor readiness, latency, 4xx/5xx rate, quality warning/blocked rate and fallback use
by application. Logs use request IDs and metadata only. Add release identifiers before
external error monitoring is enabled.

## Rollback

Rollback the consumer first to `/v1/dashboard/insights` or its safe local fallback,
then restore the prior service image. The service is stateless and introduces no data
migration/backfill in this phase.

