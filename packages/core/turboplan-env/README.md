# @wildfires-org/turboplan-env

Typed environment variable access for TurboPlan. This package is the single source of env values — **never use `process.env` directly** elsewhere in the codebase.

## Exports

| Path | Contents |
| --- | --- |
| `.` | Typed env getters and helpers |
| `/crypto` | `encryptSecret()`, `decryptSecret()`, `isEncrypted()` for encrypted secret values |

## Usage

Each app context has its own getter that validates and returns the variables it needs:

```typescript
import { getApiEnv } from "@wildfires-org/turboplan-env";

const env = getApiEnv();
env.POSTGRES_URL;
env.SERVER_API_KEY;
```

Available getters:

- `getCommonEnv()` – Shared basics (`AUTH_SECRET`, `POSTGRES_URL`, `TURBOPLAN_URL`, feature flags)
- `getApiEnv()` – Hono backend (`apps/server`): CORS origins, service API keys and URLs, per-surface secrets (`INTERNAL_API_SECRET`, `ENCRYPTION_KEY`, `JWT_SIGNING_SECRET`), mail, R2, OpenRouter, Stripe billing (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RECONCILE_SECRET`), ...
- `getWebEnv()` – Next.js web app (adds server-only `INTERNAL_API_SECRET` and `JWT_SIGNING_SECRET`, blank in the client bundle)
- `getLandingPageEnv()` – Landing page
- `getDbEnv()` – Database URLs only (`POSTGRES_URL`, `TEST_POSTGRES_URL`)
- `getR2Env()` – Cloudflare R2 storage credentials
- `getOpenRouterEnv()` – OpenRouter API key and model IDs
- `getResearchAgentEnv()` – Research agent service config
- `getReleaseInfo()` – Release version/date/branch

Plus focused helpers: `getServerUrl()`, `getLocalTunnelUrl()`, `getAppName()`, `getAppEnv()`, `getAdminEmails()`, `getSupportEmail()`, `getAuthCookieName()`, `getAuthCookieDomain()`, `isEnvValueTruthy()`, `isExternalPromptsEnabled()`, `resetEnvCache()`, `logReleaseInfo()`.

Getters cache their results; call `resetEnvCache()` in tests when mutating `process.env`.

## Notes

- Missing required variables cause getters to throw at first access, failing fast on misconfiguration.
- The package has zero runtime dependencies, so anything can depend on it.
