# Travel With Ease environment contract

Placeholders only; never commit values.

| Variable | Consumer | Required | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `PUBLIC_SITE_URL` | Web build | Production | No | Canonical public origin |
| `PUBLIC_API_BASE_URL` | Web browser | Production | No | Public API origin |
| `VITE_API_BASE_URL` | Portal browser | Production | No | API origin |
| `PORT` | API | No | No | Listen port |
| `APP_ENV` | API | Yes | No | `development`, `test`, `production` |
| `ALLOWED_ORIGINS` | API | Production | No | Comma-separated exact web/portal origins |
| `DATABASE_URL` | API | Production | Yes | PostgreSQL connection URL |
| `TWE_LOCAL_DATA_FILE` | API | Development only | No | Local Phase 1 repository file |
| `TWE_AGENT_API_TOKEN` | API + manually entered in development portal | Development only | Yes | Temporary staff gate; forbidden as production auth |
| `EXCHANGE_RATE_API_BASE_URL` | API | No | No | Provider endpoint override |
| `EXCHANGE_RATE_API_KEY` | API | Provider-dependent | Yes | Server-only provider credential |
| `EXCHANGE_RATE_CACHE_TTL_SECONDS` | API | No | No | Fresh cache duration |
| `EXCHANGE_RATE_TIMEOUT_MS` | API | No | No | Provider request timeout |
| `FIELD_ENCRYPTION_KEY_V1` | Future API | Before sensitive fields | Yes | Versioned application encryption key |
| `PRIVATE_DOCUMENT_BUCKET` | Future API | Before documents | No | Private object bucket name |
| `PAYSTACK_SECRET_KEY` | Future API | Before payments | Yes | Server initialise/verify/webhooks |
| `PAYSTACK_PUBLIC_KEY` | Payment UI | Before payments | No | Paystack client bootstrap only |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_APP_SECRET` | Future API | Before WhatsApp | Yes | Messaging/webhook verification |
| `AI_PROVIDER_API_KEY` | Future API | Before AI | Yes | Sanitised draft-generation requests |

Only variables intentionally prefixed `PUBLIC_` or `VITE_` enter browser builds. Provider secrets are API-only.
