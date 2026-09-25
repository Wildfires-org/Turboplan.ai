# Configuration

The single reference for configuring TurboPlan. Every `.env.example` in the repo
documents its own variables in place; this file covers what would otherwise be
repeated across seven of them — which file each service reads, the four
authentication secrets, the smallest setup that boots, the feature-flag matrix,
deployment, and how to read the startup errors.

- [Which file goes where](#which-file-goes-where)
- [The four secrets](#the-four-secrets)
- [Minimum viable local setup](#minimum-viable-local-setup)
- [Feature flags](#feature-flags)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

Every variable is read through `@wildfires-org/turboplan-env`
(`packages/core/turboplan-env/src/index.ts`) — never `process.env` directly. That
module is the authority on what is required; the tables here mirror it.

## Which file goes where

Copy each `.env.example` to the name in the second column, **in the same
directory**. The names differ per service and are not interchangeable.

| Service | Copy `.env.example` to | Why that name | What it configures |
| --- | --- | --- | --- |
| `apps/turboplan` (web app, :3000) | `.env.local` | Next.js reads it, and `drizzle.config.ts` / `lib/db/db-push.ts` / `lib/db/migrate.ts` load `.env.local` by hardcoded path | The whole UI, NextAuth, and every `db:*` script |
| `apps/server` (Hono API, :3001) | `.env.local` | `pnpm dev` runs on Bun, which auto-loads `.env` **and** `.env.local`; `pnpm start` reads `.env.local` explicitly | All business logic, RBAC, mail, billing, signing |
| `apps/landing-page` (:3002) | `.env.local` | Next.js reads it | Marketing site and the public project catalog |
| `apps/research-agent` (:3003) | `.env.local` | The dev script is `tsx watch --env-file=.env.local` and fails if the file is missing | Optional autonomous research agent |
| `e2e` | `.env` | `pnpm e2e:test` runs `dotenv -e .env`; `e2e/load-env.sh` sources the same file | The entire Playwright suite **and** the three servers it starts |
| `packages/services/turboplan-map-server` | `.env` | Python `load_dotenv()` reads `.env` from the working directory | Optional GIS processing service (:9000) |
| `docker/documenso` | `.env` | `docker compose` reads `.env` next to `docker-compose.yml` | Optional self-hosted signing stack (:3004) |
| `apps/mcp-server` (Workers) | `.dev.vars` — copy from **`.dev.vars.example`** | Runs on Cloudflare Workers; `wrangler dev` reads `.dev.vars` only, and `wrangler.toml` declares no `[vars]` block | MCP tool server for AI agents, authenticated by Personal Access Token |

The MCP server is the one exception to the rule above: it has no
`.env.example`, because a `.env` file would be ignored. Copy
`.dev.vars.example` to `.dev.vars` instead. It also needs no
`JWT_SIGNING_SECRET` or `INTERNAL_API_SECRET` — it authenticates by PAT hash
lookup against the database, so `AUTH_SECRET` and `POSTGRES_URL` must match
the web app or the tokens you mint there will not be found.

Two extra file names exist and are easy to miss:

- `packages/modules/turboplan-billing`'s `sync:stripe` script reads
  **`apps/server/.env`** (not `.env.local`). If you use it, copy the server file
  under that name too.
- `apps/research-agent`'s `deploy:agent` script reads **`.env.deploy`**.

`apps/mcp-server` has no `.env.example`: it runs only on Cloudflare Workers and
takes its configuration from `wrangler.toml` plus `scripts/deploy-mcp.sh`.

`.gitignore` already covers `.env` and `.env.local` everywhere. Never commit
either.

## The four secrets

Authentication is split across four independent secrets so that compromising one
surface does not compromise the others. All four are validated at startup and
throw when missing — there are no fallbacks and no defaults.

Generate **four different values**, one per row:

```bash
openssl rand -base64 32
```

Reusing a single value for all four defeats the entire point of the split: the
value that signs browser session cookies would also be the value that decrypts
stored third-party credentials, so one leak becomes four.

| Secret | What it protects | Services that need it | Must match across services? | Consequence of rotating |
| --- | --- | --- | --- | --- |
| `AUTH_SECRET` | The NextAuth session cookie (JWE) and the analytics email HMAC seed | web app, API server, landing page | **Yes** — byte-identical in all three | Every signed-in user is logged out; historical analytics email hashes stop lining up with new ones |
| `INTERNAL_API_SECRET` | The `X-Internal-Secret` header on the internal magic-link email call | web app, API server | **Yes** — byte-identical in both | None, as long as both sides are updated together. If they drift, login emails are rejected with 401 and nobody can sign in |
| `JWT_SIGNING_SECRET` | HS256 signing and verification of API tokens (the web app mints, the server verifies) | web app, API server | **Yes** — byte-identical in both | All outstanding API tokens become invalid; clients get 401 until they get a fresh token |
| `ENCRYPTION_KEY` | AES-256-GCM encryption of secrets at rest (per-organisation third-party keys) | API server **only** | No — nothing else uses it | **Destructive.** Every already-encrypted value becomes permanently unreadable. There is no recovery path; the affected organisations must re-enter their credentials |

The e2e suite is the one place where a single file supplies all four to every
service at once (`e2e/.env`, exported by `e2e/start-servers.sh`), which is why
they cannot drift there.

Two more shared secrets behave the same way but are not part of the split:
`SERVER_API_KEY` (service-to-service webhook calls into the API) and
`MAP_SERVICE_API_KEY` (API server to the Python map service).

## Minimum viable local setup

This is the shortest honest configuration that boots the whole stack with **no
third-party accounts at all** — no Cloudflare, no Stripe, no Resend, no
OpenRouter. You need only Node 22+, pnpm 10 and a PostgreSQL database.

```bash
pnpm install
pnpm build:packages          # required before any db:* script — they import built packages
cp apps/turboplan/.env.example    apps/turboplan/.env.local
cp apps/server/.env.example       apps/server/.env.local
cp apps/landing-page/.env.example apps/landing-page/.env.local
```

Then set these, and nothing else:

**`apps/turboplan/.env.local`**

```dotenv
POSTGRES_URL=postgresql://user:password@localhost:5432/turboplan
AUTH_SECRET=<openssl rand -base64 32>
INTERNAL_API_SECRET=<a different one>
JWT_SIGNING_SECRET=<a different one>
NEXT_PUBLIC_TURBOPLAN_URL=http://localhost:3000
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_IS_TASKS_PACKAGE_ENABLED=true
NEXT_PUBLIC_IS_MAPS_PACKAGE_ENABLED=false
NEXT_PUBLIC_IS_PROJECT_CONTEXT_PACKAGE_ENABLED=false
NEXT_PUBLIC_IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED=false
```

**`apps/server/.env.local`** — the same `POSTGRES_URL`, the same three secrets
byte for byte, plus:

```dotenv
ENCRYPTION_KEY=<a fourth, different one>
TURBOPLAN_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
SERVER_API_KEY=<openssl rand -base64 32>
NODE_ENV=development
IS_TASKS_PACKAGE_ENABLED=true
IS_MAPS_PACKAGE_ENABLED=false
IS_PROJECT_CONTEXT_PACKAGE_ENABLED=false
IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED=false
```

> The four flags above are only the **presence-checked** ones — the shortest
> list that boots. Copying `.env.example` instead gives you a fuller default:
> fields, documents, timeline records and project context are also `true` there,
> since none of them need extra configuration. Maps, the research agent, billing
> and signing stay `false` in both, because enabling any of them makes further
> variables required and the API server throws at startup without them.

**`apps/landing-page/.env.local`** — only needed because `pnpm dev` starts it
too:

```dotenv
AUTH_SECRET=<the same AUTH_SECRET as above>
NEXT_PUBLIC_TURBOPLAN_URL=http://localhost:3000
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_LINKEDIN_URL=https://www.linkedin.com
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.test
```

Then:

```bash
cd apps/turboplan && pnpm db:push && cd ../..
pnpm dev
```

### Logging in without an email provider

With no `RESEND_API_KEY` and no `ETHEREAL_USER`/`ETHEREAL_PASS`, mail falls back
to a **no-op provider**: it logs one warning at startup, then every `sendEmail`
returns success without sending anything. The login screen will happily say the
magic link was sent — it was not, and the link is not printed anywhere.

Mint a login link directly against the database instead:

```bash
cd apps/turboplan
pnpm exec tsx --env-file=.env.local ../../e2e/scripts/mint-magic-link.ts you@example.test
```

It prints JSON containing `magicLinkUrl`; open that in a browser. Re-running it
for the same address reuses the same user.

### What is dark in this state

| Area | Status without third-party accounts |
| --- | --- |
| Accounts, organisations, offices, projects, RBAC | Fully working |
| Tasks and milestones | Working (`IS_TASKS_PACKAGE_ENABLED=true`) |
| AI chat, titles, suggestions, artifacts | **Dark.** No `OPENROUTER_API_KEY`, so the first AI call throws and that route returns 500. The rest of the app is unaffected |
| File uploads, project documents, avatars | **Dark.** No R2 credentials, so upload and delete routes return 500 |
| Project cover images | **Dark, silently.** The auto-generation runs in the background and its failure is caught and logged, so project creation still succeeds — just without a cover |
| Rendering existing R2 images | **Dark.** Without `R2_PUBLIC_URL` the `next/image` allowlist rejects them; the page renders with broken images rather than failing |
| Email (magic links, invitations, notifications) | **Dark.** No-op provider — see the section above |
| Billing | Off by feature flag |
| Signing | Off by feature flag |
| Maps | Off by feature flag |
| Research agent | Off by feature flag |
| Analytics (PostHog, GA) and error monitoring (Sentry) | Off — every integration no-ops without its key |

To light up AI, add one key: `OPENROUTER_API_KEY` from
<https://openrouter.ai/keys>, in **both** `apps/turboplan/.env.local` and
`apps/server/.env.local`. That single addition is what most local development
actually needs.

## Feature flags

Optional modules are toggled per deployment. Each has two names — the server
reads `IS_<MODULE>_PACKAGE_ENABLED`, the browser bundle reads
`NEXT_PUBLIC_IS_<MODULE>_PACKAGE_ENABLED` — and a module counts as enabled when
**either** name is truthy.

### Truthiness rules

- Only the literal string `"true"` (case-insensitive) enables a module.
  `1`, `yes`, `on` and `enabled` all evaluate to **off**
  (`isEnvValueTruthy` in `packages/core/turboplan-env/src/index.ts`).
- Five flags are additionally **presence-checked at startup**. They must be set
  to *something* — `false` is fine, empty or absent is not — or the app throws
  ``Missing `IS_X_PACKAGE_ENABLED` or `NEXT_PUBLIC_IS_X_PACKAGE_ENABLED` env
  variable`` before serving anything. The other flags simply default to off when
  absent.
- The two names are OR-ed, so a server value of `false` does **not** override a
  `NEXT_PUBLIC_` value of `true`. Set both to the same value, always.

### The matrix

| Module | Flag (`IS_…_PACKAGE_ENABLED`) | Presence-checked? | What enabling it turns on | Extra variables it then requires |
| --- | --- | --- | --- | --- |
| Tasks | `IS_TASKS_PACKAGE_ENABLED` | **Yes** | Tasks, milestones, Gantt view, task routers | — |
| Maps | `IS_MAPS_PACKAGE_ENABLED` | **Yes** | Leaflet maps, GIS file upload | `MAP_SERVICE_API_KEY`, `MAP_SERVICE_URL` (API server throws at startup without them) plus a running map service |
| Project context | `IS_PROJECT_CONTEXT_PACKAGE_ENABLED` | **Yes** | Per-project context entries fed to the AI | — |
| Research agent | `IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED` | **Yes** | Launching and polling autonomous research runs | `RESEARCH_AGENT_SERVICE_URL`, `RESEARCH_AGENT_SERVICE_API_KEY` (API server throws at startup without them) plus a running `apps/research-agent` |
| Fields | `IS_FIELDS_PACKAGE_ENABLED` | No | Custom project fields | — |
| Documents | `IS_DOCUMENTS_PACKAGE_ENABLED` | No | PDF/Word upload per project | Working `R2_*` credentials, or every upload returns 500 |
| Timeline records | `IS_TIMELINE_RECORDS_PACKAGE_ENABLED` | No | Project activity log | — |
| Billing | `IS_BILLING_PACKAGE_ENABLED` | No | Stripe plans, checkout, seat reconciliation, `/setup/plan` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (API server throws at startup without them). Optional: `RECONCILE_SECRET`, `LANDING_URL` |
| Signing | `IS_SIGNING_PACKAGE_ENABLED` | No | Documenso signature requests | `DOCUMENSO_API_URL`, `DOCUMENSO_API_KEY`, `DOCUMENSO_WEBHOOK_SECRET` (API server throws at startup without them) plus a running Documenso |

Prices for the billing module are **not** environment variables. They resolve at
runtime from catalog lookup keys in
`packages/modules/turboplan-billing/catalog/pricing.yaml`; create the matching
Stripe objects with
`pnpm --filter @wildfires-org/turboplan-billing sync:stripe -- --apply`.

## Deployment

Cloudflare Workers is the only supported deployment target.

`.github/workflows/cloudflare-deploy.yml` runs on pushes to `main` and `develop`
and on every pull request. It detects which parts of the tree changed and calls
the matching script in `scripts/`:

| Script | Deploys | Mechanism |
| --- | --- | --- |
| `scripts/deploy-web.sh` | `apps/turboplan` | `@opennextjs/cloudflare` build + deploy |
| `scripts/deploy-landing.sh` | `apps/landing-page` | `@opennextjs/cloudflare` build + deploy |
| `scripts/deploy-api.sh` | `apps/server` | `wrangler deploy` |
| `scripts/deploy-mcp.sh` | `apps/mcp-server` | `wrangler deploy` |
| `scripts/deploy-map.sh` | `packages/services/turboplan-map-server` | Cloudflare Container |
| `scripts/cleanup-preview.sh` | Per-PR preview workers | Invoked by `cloudflare-cleanup.yml` |

Each script takes an environment (`production`, `staging` or `preview`) and, for
previews, a PR number. Non-sensitive values are passed as Worker `--var`s;
secrets go through `wrangler secret bulk`, so they are never printed in logs.

Every script requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Beyond
that, see the "Environment variables required" header comment at the top of each
script — it is kept in step with the code.

### Hyperdrive

The API Worker and the web Worker both bind a Cloudflare Hyperdrive config
(binding name `HYPERDRIVE`), which pools and multiplexes Postgres connections at
the edge. The workflow creates or updates one config per environment and passes
its id to the deploy script as `HYPERDRIVE_ID`; the script substitutes it for the
`HYPERDRIVE_ID_PLACEHOLDER` in the app's `wrangler.jsonc`. At runtime both
Workers prefer the Hyperdrive connection string over `POSTGRES_URL` and fall back
to the raw secret when the binding is absent (local dev, or a deploy run without
`HYPERDRIVE_ID`), so `POSTGRES_URL` stays required either way.

### GitHub Actions secrets

Set under **Settings → Secrets and variables → Actions → Secrets**. The deploy
scripts abort with `<NAME> env var is required` when one of the mandatory ones is
missing.

| Secret | Required for | Notes |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Every deploy | Must belong to the account owning the DNS zone |
| `CLOUDFLARE_ACCOUNT_ID` | Every deploy | |
| `AUTH_SECRET` | web, landing, api, mcp | One value shared by all four |
| `INTERNAL_API_SECRET` | web, api | Same value on both |
| `JWT_SIGNING_SECRET` | web, api | Same value on both |
| `ENCRYPTION_KEY` | api | API only |
| `POSTGRES_URL` | web, api, mcp | |
| `OPENROUTER_API_KEY` | web, api, mcp | |
| `SERVER_API_KEY` | api | |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | web, api, mcp | |
| `MAP_SERVICE_API_KEY` | api, map | Same value on both |
| `RESEND_API_KEY` | api | Optional — no-op mail without it |
| `EXA_API_KEY` | web | Optional — web search is a chat tool in the Next.js app; the API server never reads it |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | api | Required only when billing is enabled |
| `DOCUMENSO_API_KEY`, `DOCUMENSO_WEBHOOK_SECRET` | api | Required only when signing is enabled; pair with the `DOCUMENSO_API_URL` variable |
| `RESEARCH_AGENT_SERVICE_API_KEY` | api | Required only when the research agent is enabled |
| `SENTRY_AUTH_TOKEN` | web, landing builds | Optional — enables sourcemap upload |
| `NEON_API_KEY` | Preview deploys | Optional — used with the `NEON_PROJECT_ID` variable to create and reset a per-PR database branch |
| `VERCEL_TOKEN` | Build step | Optional — this is the **Turborepo remote cache** token (`TURBO_TOKEN`), not a deploy target |

### GitHub Actions variables

Set under **Settings → Secrets and variables → Actions → Variables**. These are
not secret.

`WORKERS_SUBDOMAIN` (your `<account>.workers.dev` subdomain) is **always
required** — the fallback URLs baked into the client bundles are built from it,
so leaving it unset produces malformed URLs even when you use custom domains.

Custom domains are configured entirely through these variables; no code changes.
Without them, production deploys stay on `workers.dev` hostnames and auth cookies
scope to the workers subdomain.

| Variable | Example | Used for |
| --- | --- | --- |
| `WORKERS_SUBDOMAIN` | `my-account.workers.dev` | Always required — fallback URL construction |
| `PRODUCTION_APP_DOMAIN` | `app.example.com` | Web app route |
| `PRODUCTION_API_DOMAIN` | `api.example.com` | API route |
| `PRODUCTION_LANDING_DOMAIN` | `example.com` | Landing page route |
| `PRODUCTION_MAP_DOMAIN` | `map.example.com` | Map service route |
| `PRODUCTION_MCP_DOMAIN` | `mcp.example.com` | MCP server route |
| `PRODUCTION_COOKIE_DOMAIN` | `.example.com` (leading dot) | Auth cookie scope shared across subdomains |

The DNS zone must already exist in the Cloudflare account the API token belongs
to. Wrangler creates each Custom Domain (DNS record plus certificate) on deploy,
so do **not** pre-create them by hand — a pre-existing attachment conflicts with
the deploy.

The remaining variables mirror the `.env.example` files and are read straight
into the Worker environment: `APP_NAME`, `APP_ENV`, `ADMIN_EMAILS`,
`SUPPORT_EMAIL`, `SYSTEM_USER_EMAIL`, `RESEND_FROM_EMAIL`,
`R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `POSTHOG_API_KEY`,
`NEXT_PUBLIC_POSTHOG_KEY`, `OPENROUTER_MODEL_*`,
`DISABLE_AUTO_PROJECT_IMAGE_GENERATION`, `RESEARCH_AGENT_SERVICE_URL`,
`NEON_PROJECT_ID`, the Sentry `SENTRY_DSN_*` / `SENTRY_ORG` / `SENTRY_PROJECT_*`
set, and the feature flags — which are named `FF_IS_<MODULE>_PACKAGE_ENABLED`
and `FF_USE_EXTERNAL_PROMPTS` in the workflow to keep them out of the runner's
ambient environment.

The research agent is not part of this pipeline: it deploys to Modal (sandbox)
and Fly.io (app server) via its own `pnpm deploy` script.

## Troubleshooting

Every message below is thrown by `packages/core/turboplan-env/src/index.ts` at
startup, with the exception of the two marked otherwise.

| Error | Fix |
| --- | --- |
| ``Missing database URL: set `POSTGRES_URL` or `TEST_POSTGRES_URL` env variable`` | Set `POSTGRES_URL` in the failing service's env file. Check you copied to the right filename for that service |
| ``Missing `AUTH_SECRET` env variable`` | Generate one and set it in the web app, API server **and** landing page — byte-identical |
| ``Missing `AUTH_SECRET` env variable (required for session verification)`` | Same value, missing specifically from `apps/landing-page/.env.local` |
| ``Missing `INTERNAL_API_SECRET` env variable`` | Set it in `apps/server/.env.local` |
| ``Missing `INTERNAL_API_SECRET` env variable (required for internal API calls)`` | Set the same value in `apps/turboplan/.env.local` |
| ``Missing `ENCRYPTION_KEY` env variable`` | Set it in `apps/server/.env.local` only. Never change it once data exists |
| ``Missing `JWT_SIGNING_SECRET` env variable`` / ``… (required for API token signing)`` | Set the same value in both `apps/server/.env.local` and `apps/turboplan/.env.local` |
| ``Missing `TURBOPLAN_URL` or `NEXT_PUBLIC_TURBOPLAN_URL` env variable`` | Set `TURBOPLAN_URL` on the server, `NEXT_PUBLIC_TURBOPLAN_URL` in the Next.js apps |
| ``Missing `NEXT_PUBLIC_SERVER_URL` env variable`` | Set it in the web app and the landing page (`http://localhost:3001` locally) |
| ``Missing `NEXT_PUBLIC_LINKEDIN_URL` env variable`` | Landing page only. Any valid URL works; it is validated but not currently rendered |
| ``Missing `ALLOWED_ORIGINS` env variable`` | Set it on the API server (`http://localhost:3000` locally) |
| ``Missing `SERVER_API_KEY` env variable`` | Generate one for the API server |
| ``Missing `IS_<MODULE>_PACKAGE_ENABLED` or `NEXT_PUBLIC_IS_<MODULE>_PACKAGE_ENABLED` env variable`` | One of the four presence-checked flags is absent or empty. Set it explicitly to `true` or `false` — empty does not count |
| ``Missing `MAP_SERVICE_API_KEY` / `MAP_SERVICE_URL` env variable`` | Maps are enabled. Either configure the map service or set the maps flag to `false` on both sides |
| ``Missing `RESEARCH_AGENT_SERVICE_URL` / `RESEARCH_AGENT_SERVICE_API_KEY` env variable`` | The research agent module is enabled. Configure it or set the flag to `false` on both sides |
| ``Missing `DOCUMENSO_API_URL` / `DOCUMENSO_API_KEY` / `DOCUMENSO_WEBHOOK_SECRET` env variable`` | Signing is enabled. Start `docker/documenso` and fill these in, or set the signing flag to `false` |
| ``Missing `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` env variable`` | Billing is enabled. Add test-mode Stripe keys or set the billing flag to `false` on both sides |
| ``Missing `OPENROUTER_API_KEY` env variable`` | Thrown lazily on the first AI call, not at startup — the route returns 500. Add the key to the web app and the API server |
| ``Missing `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_ACCOUNT_ID` / `R2_PUBLIC_URL` env variable`` | Thrown lazily on the first storage call — the upload or image route returns 500. Configure all five together |
| ``Missing `AGENT_API_KEY` env variable`` | `apps/research-agent` only. Must match `RESEARCH_AGENT_SERVICE_API_KEY` on the API server |
| ``Missing required Modal env variables: …`` | `apps/research-agent` only. Set `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`, or `AGENT_LOCAL=true` for local development |
| ``Missing model provider key: set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.`` | `apps/research-agent` only. Set one of the two, or `AGENT_LOCAL=true` |
| ``E2E tests require NODE_ENV=test, but got …`` | Thrown by `e2e/global-setup.ts`. Set `NODE_ENV=test` in `e2e/.env` |
| ``NEXT_PUBLIC_SUPPORT_EMAIL (or SUPPORT_EMAIL) must be set …`` | Thrown while prerendering the landing page's `/contact` route, so it fails `next build`. Set a real support address |
| `Invalid src prop … hostname is not configured` | `R2_PUBLIC_URL` is unset or was changed without a rebuild. It is baked into `next/image` `remotePatterns` at build time |
| `[Mail] No email provider configured…` (a warning, not an error) | Expected without `RESEND_API_KEY` or Ethereal credentials. Emails are silently dropped — mint magic links directly, see [Minimum viable local setup](#minimum-viable-local-setup) |
| A module-not-found error for `@wildfires-org/turboplan-env` or `…-db` while running `db:push` / `db:migrate` | Run `pnpm build:packages` from the repo root first — the database scripts import the built `dist/` output, which does not exist on a fresh clone |
