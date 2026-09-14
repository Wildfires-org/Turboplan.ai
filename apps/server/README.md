# TurboPlan API Server

Hono API server — the canonical backend for all TurboPlan business logic and database access. The Next.js apps never touch the database directly; they call this server.

All new API endpoints belong here (or in package-exported routers mounted here), not in Next.js API routes.

## Structure

| Path | Purpose |
| --- | --- |
| `src/index.ts` | App entry — builds the router, default export for Bun/Vercel |
| `src/local.ts` | Node entry (`@hono/node-server`) for reproducing the Vercel runtime locally |
| `src/worker.ts` | Cloudflare Workers entry — bridges Worker env vars and Hyperdrive to the app |
| `src/router.ts` | Mounts public, private (auth), and webhook routes with middleware |
| `src/middleware/` | Auth (JWT), CORS, API-key middleware |
| `src/routes/` | Route registration, mostly mounting routers exported by `@wildfires-org/*` packages |

Mutating endpoints must be RBAC-protected via `requirePermission` from `@wildfires-org/turboplan-rbac/hono`.

## Running Locally

Dev mode runs on [Bun](https://bun.sh):

```bash
# From the monorepo root
pnpm install
pnpm build:packages

cp apps/server/.env.example apps/server/.env.local
# Fill in at least: POSTGRES_URL, AUTH_SECRET, INTERNAL_API_SECRET,
# JWT_SIGNING_SECRET, ENCRYPTION_KEY, APP_NAME, OPENROUTER_API_KEY,
# R2_* credentials, SERVER_API_KEY

pnpm --filter turboplan-server dev
```

The server listens on `http://localhost:3001` (override with `PORT`).

To run the built output on Node instead (simulates the Vercel runtime):

```bash
pnpm --filter turboplan-server start   # tsdown build + node dist/local.js
```

## Environment Variables

See `.env.example` for the full annotated list. Highlights:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Session cookie (JWE) + analytics email HMAC seed — must match the web app |
| `INTERNAL_API_SECRET` | Guards the internal magic-link email endpoint — must match the web app |
| `JWT_SIGNING_SECRET` | API token verification — must match the web app |
| `ENCRYPTION_KEY` | AES-256-GCM key for secrets stored at rest (server only) |
| `APP_NAME` | Display name used in emails and metadata |
| `TURBOPLAN_URL` | Web app URL (referer headers, links in emails) |
| `OPENROUTER_API_KEY` | AI provider access |
| `R2_*` | Cloudflare R2 file storage credentials |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist |
| `SERVER_API_KEY` | Service-to-service auth for webhook routes |
| `IS_*_PACKAGE_ENABLED` | Feature flags (non-`NEXT_PUBLIC_` variants) |

Access env vars only through `getApiEnv()` from `@wildfires-org/turboplan-env`, never `process.env`.

## Build

```bash
pnpm --filter turboplan-server build      # tsdown → dist/
pnpm --filter turboplan-server typecheck
```

## Deploy

Two supported targets:

- **Vercel** — `vercel.json` (`framework: hono`), entry `src/index.ts`.
- **Cloudflare Workers** — `wrangler.jsonc`, entry `src/worker.ts`, with a Hyperdrive binding for Postgres. Deployed via `scripts/deploy-api.sh` at the repo root (replaces the Hyperdrive ID placeholder at deploy time).
