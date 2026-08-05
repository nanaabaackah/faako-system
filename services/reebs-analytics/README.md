# Faako Analytics

This directory hosts the shared, isolated and read-only Python analytics service.
The logical service/package name is `faako-analytics`; the existing directory and
REEBS configuration aliases remain temporarily stable for deployment compatibility.

The service has no transactional database connection. Approved application backends
send tenant-scoped, minimised snapshots through stable analytical contracts. It cannot
mutate orders, payments, bookings, stock, users or operational records.

## Local run

```bash
cd services/reebs-analytics
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

Portal compatibility configuration uses the names
`REEBS_ANALYTICS_SERVICE_URL` and `REEBS_ANALYTICS_SERVICE_SECRET`.

New consumers should use `FAAKO_ANALYTICS_SERVICE_URL` and a scoped entry in
`FAAKO_ANALYTICS_SERVICE_TOKENS`. Values are intentionally omitted from documentation.

Production uses the deployed analytics service by default; the URL remains configurable
for previews and alternate environments. The dashboard uses a deterministic Node
continuity model whenever the isolated service is temporarily unavailable.

## Deployment boundary

- Deploy this directory as its own Railway/Docker service.
- Prefer caller-scoped credentials in `FAAKO_ANALYTICS_SERVICE_TOKENS`.
- `FAAKO_ANALYTICS_SERVICE_SECRET` and `REEBS_ANALYTICS_SERVICE_SECRET` are compatibility aliases for REEBS only.
- Keep the service private where the hosting platform supports private networking.
- Do not add `DATABASE_URL`; the service is intentionally unable to read or write transactional databases.
- Use `/health` for health checks.
- Use `/ready` for authentication-configuration readiness.

## Tests

```bash
python -m ruff check app tests
python -m mypy app
python -m pytest
```
