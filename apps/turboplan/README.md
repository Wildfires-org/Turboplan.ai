# TurboPlan Web App

The main TurboPlan application — a Next.js 15 (App Router) web app with an AI chat interface and project workspaces (organizations → offices → projects). Feature modules (tasks, maps, documents, fields, etc.) come from `packages/` under the `@wildfires-org/*` namespace.

Business logic and database access live in the Hono API server (`apps/server`). The routes under `app/api/` are legacy and are being migrated to Hono — do not add new ones.

## Running Locally

```bash
# From the monorepo root
pnpm install
pnpm build:packages

# Configure environment
cp apps/turboplan/.env.example apps/turboplan/.env.local
# Fill in at least: POSTGRES_URL, AUTH_SECRET, INTERNAL_API_SECRET,
# JWT_SIGNING_SECRET, OPENROUTER_API_KEY, R2_* credentials

# Start the dev server (port 3000)
pnpm --filter turboplan dev
```

The app expects the API server (`apps/server`) to be running on port 3001. Run everything at once with `pnpm dev` from the root.

## Environment Variables

See `.env.example` for the full annotated list. Key groups:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Session cookie (JWE) + analytics email HMAC seed (`openssl rand -base64 32`) |
| `INTERNAL_API_SECRET` | Internal magic-link email call — must match the API server |
| `JWT_SIGNING_SECRET` | API token signing — must match the API server |
| `OPENROUTER_API_KEY` | AI provider access (chat, image generation) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ACCOUNT_ID`, `R2_PUBLIC_URL` | Cloudflare R2 file storage |
| `NEXT_PUBLIC_IS_*_PACKAGE_ENABLED` | Feature flags toggling optional modules |

## Database

Schemas live in `packages/core/turboplan-db`, but the Drizzle scripts run from this directory:

```bash
cd apps/turboplan
pnpm db:push       # Sync schema to local DB (development)
pnpm db:generate   # Generate migrations (production-ready changes)
pnpm db:migrate    # Run migrations
pnpm db:studio     # Open Drizzle Studio
```

## Testing

```bash
# Unit tests (Node test runner, files in unit-tests/)
pnpm --filter turboplan test

# Single test file
cd apps/turboplan && node --import tsx --test unit-tests/path/to/file.test.ts
```

Cross-app end-to-end tests live in `e2e/` at the repo root (`pnpm e2e`).

## Linting and Formatting

Biome, run from the monorepo root:

```bash
pnpm format:write
pnpm lint:fix
```

## Build and Deploy

```bash
pnpm --filter turboplan build
```

The app deploys to Cloudflare Workers via OpenNext (`open-next.config.ts`, `wrangler.jsonc`). See `scripts/deploy-web.sh` at the repo root.
