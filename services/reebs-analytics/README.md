# REEBS Advanced Analytics

This is an isolated, read-only FastAPI service for dashboard forecasting and operational insights.
It does not connect to the REEBS database and cannot mutate orders, payments, bookings, stock, or customers.
The existing Node API sends it a small organization-scoped aggregate snapshot.

## Local run

```bash
cd services/reebs-analytics
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

Configure the portal backend with:

<<<<<<< Updated upstream
```env
REEBS_ANALYTICS_SERVICE_URL=http://127.0.0.1:8010
REEBS_ANALYTICS_SERVICE_SECRET=replace-with-a-server-only-secret
```
=======
New consumers should use `FAAKO_ANALYTICS_SERVICE_URL` and a scoped entry in
`FAAKO_ANALYTICS_SERVICE_TOKENS`. Values are intentionally omitted from documentation.
Copy `.env.example` for the variable shape only; replace every placeholder privately.
>>>>>>> Stashed changes

Production uses the deployed analytics service by default; the URL remains configurable
for previews and alternate environments. The dashboard uses a deterministic Node
continuity model whenever the isolated service is temporarily unavailable.

## Deployment boundary

- Deploy this directory as its own Railway/Docker service.
- Configure the same strong `REEBS_ANALYTICS_SERVICE_SECRET` in this service and the REEBS Node API.
- Keep the service private where the hosting platform supports private networking.
<<<<<<< Updated upstream
- Do not add `DATABASE_URL`; the service is intentionally unable to read or write the REEBS database.
- Use `/health` for health checks.
=======
- Do not add `DATABASE_URL`; the service is intentionally unable to read or write transactional databases.
- Use `/health` for process liveness only.
- Use `/ready` for deployment health checks. It rejects missing, empty, or malformed
  authentication configuration so an unusable deployment cannot be promoted as ready.
>>>>>>> Stashed changes

## Tests

```bash
python -m unittest discover -s tests
```
