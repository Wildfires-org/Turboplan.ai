# TurboPlan

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](./CHANGELOG.md)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

**An extensible, AI-powered project workspace you can self-host.**

TurboPlan combines an AI chat interface with modular project-management features
— tasks, documents, maps, custom fields, billing, document signing — that can be
toggled per deployment via feature flags. Built as a Turborepo monorepo, it is
the core platform of the wildfires.org software ecosystem.

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10 (`corepack enable` or `npm i -g pnpm`)
- A PostgreSQL database (local install, Docker, or a managed provider such as Neon)
- An [OpenRouter](https://openrouter.ai/) API key for AI features (optional — the
  stack boots without one, but every AI route then returns an error)

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/Wildfires-org/turboplan.git
   cd turboplan
   ```

2. Install dependencies

   ```bash
   pnpm install
   ```

3. Set up environment variables

   ```bash
   cp apps/turboplan/.env.example    apps/turboplan/.env.local
   cp apps/server/.env.example       apps/server/.env.local
   cp apps/landing-page/.env.example apps/landing-page/.env.local
   ```

   The target filename matters — `apps/turboplan`'s database scripts load
   `.env.local` by an explicit path. Each `.env.example` documents every
   variable in place; [`CONFIGURATION.md`](./CONFIGURATION.md) has the shortest
   list that boots the stack with no third-party accounts at all.

4. Build the workspace packages

   ```bash
   pnpm build:packages
   ```

   Do this before step 5 — the database scripts import the built packages.

5. Push the database schema

   ```bash
   cd apps/turboplan
   pnpm db:push
   cd ../..
   ```

6. Start the dev stack

   ```bash
   pnpm dev
   ```

   `pnpm dev` starts all apps except the research agent. The web app is at `http://localhost:3000`, the API at `http://localhost:3001`, and the landing page at `http://localhost:3002`.

   Without an email provider configured, magic-link emails are silently
   dropped. Mint a login link directly instead:

   ```bash
   cd apps/turboplan
   pnpm exec tsx --env-file=.env.local ../../e2e/scripts/mint-magic-link.ts you@example.test
   ```

## Repository Structure

```
turboplan/
├── apps/
│   ├── turboplan/        # Main web app — Next.js 15 AI chat + workspace UI (port 3000)
│   ├── server/           # Backend API — Hono, runs on Bun (port 3001)
│   ├── landing-page/     # Marketing site — Next.js (port 3002)
│   ├── mcp-server/       # Model Context Protocol server — Cloudflare Workers
│   └── research-agent/   # Autonomous research agent — Claude Agent SDK (port 3003)
├── packages/
│   ├── core/             # Infrastructure: db, auth, rbac, env, ai, mail, upload, ...
│   ├── modules/          # Feature modules: tasks, documents, billing, signing, maps, ...
│   └── services/         # Standalone services (Python map server)
├── e2e/                  # Playwright end-to-end tests
├── docker/               # Optional external services (Documenso for signing)
└── scripts/              # Deployment scripts (Cloudflare Workers)
```

All internal packages use the `@wildfires-org/*` namespace and `workspace:*` dependencies. See [`packages/README.md`](./packages/README.md) for a full package list, and each app/package README for details.

## Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui, SWR
- **Backend**: Hono (Bun runtime in dev, Cloudflare Workers in production)
- **Database**: PostgreSQL + Drizzle ORM (schemas centralized in `packages/core/turboplan-db`)
- **AI**: Vercel AI SDK with OpenRouter as the model provider; Claude Agent SDK for the research agent
- **Auth**: next-auth v5 with magic-link login, JWT sessions, cross-subdomain cookie support
- **Storage**: Cloudflare R2 (S3-compatible)
- **Email**: Resend (Ethereal or no-op provider for local dev)
- **Billing**: Stripe (optional, feature-flagged)
- **Signing**: Documenso (optional, feature-flagged)
- **Lint/Format**: Biome across the repo (the landing page uses ESLint + Prettier)
- **Testing**: Playwright (E2E), Node test runner / Jest / Vitest (unit, per app)

## Development

```bash
pnpm dev                            # All apps (except research-agent)
pnpm --filter turboplan dev         # Web app only
pnpm --filter turboplan-server dev  # API server only (requires Bun)
pnpm --filter turboplan-landing-page dev  # Landing page only

pnpm build                          # Build everything
pnpm build:packages                 # Build only packages
pnpm typecheck                      # Type-check all apps and packages
```

### Code Quality

This repo uses **Biome** for linting and formatting (configured in `biome.jsonc`):

```bash
pnpm format:write   # Format all files
pnpm lint:fix       # Fix lint issues
```

### Database Workflow

All database scripts run from `apps/turboplan/`:

```bash
pnpm db:push        # Sync schema to your local DB (fast, for development)
pnpm db:generate    # Generate migration files (for production-ready changes)
pnpm db:migrate     # Apply migrations
pnpm db:studio      # Open Drizzle Studio
```

Schemas live in `packages/core/turboplan-db/src/schemas/`, migrations in `packages/core/turboplan-db/src/migrations/`.

### Testing

```bash
# Unit tests
pnpm --filter turboplan test
pnpm --filter turboplan-landing-page test

# End-to-end tests (Playwright) — requires a dedicated test database (TEST_POSTGRES_URL)
pnpm e2e            # Full lifecycle: start servers, run tests, stop servers
pnpm e2e:ui         # Playwright UI mode
pnpm e2e:headed     # Headed browser
```

See [`e2e/README.md`](./e2e/README.md) for E2E setup details.

## Environment Variables

**[`CONFIGURATION.md`](./CONFIGURATION.md) is the canonical reference** — which
file each service reads, the four authentication secrets, the minimum local
setup, the feature-flag matrix, deployment settings and a table of startup
errors. Every `.env.example` documents its own variables in place.

Each app validates its environment through `@wildfires-org/turboplan-env`, so a
missing required variable fails fast with a named error rather than a subtle
runtime bug. The essentials:

| Variable | Apps | Description |
|----------|------|-------------|
| `POSTGRES_URL` | web, server | PostgreSQL connection string |
| `AUTH_SECRET` | web, server, landing | Session cookie (JWE) signing and the analytics email HMAC seed — must match across all three |
| `INTERNAL_API_SECRET` | web, server | Shared secret for the internal magic-link email endpoint — must match across both |
| `JWT_SIGNING_SECRET` | web, server | HS256 key for API tokens — must match across both |
| `ENCRYPTION_KEY` | server | AES-256-GCM key for secrets stored at rest — rotating it is destructive |
| `OPENROUTER_API_KEY` | web, server | Model provider for every AI feature |
| `NEXT_PUBLIC_SERVER_URL` | web, landing | URL of the Hono API server |
| `TURBOPLAN_URL` / `NEXT_PUBLIC_TURBOPLAN_URL` | web, server, landing, mcp | URL of the web app |
| `ALLOWED_ORIGINS` | server | CORS allowlist |
| `SERVER_API_KEY` | server | Service-to-service webhook authentication |
| `R2_*` | web, server | Cloudflare R2 storage credentials (uploads, images) |
| `RESEND_API_KEY` | server | Email delivery — optional; without it mail is silently dropped |
| `NEXT_PUBLIC_APP_NAME` / `APP_NAME` | web, server, landing | Branding: application display name |

Generate each secret separately with `openssl rand -base64 32`. Reusing one
value across the four secrets defeats the per-surface split — see
[`CONFIGURATION.md`](./CONFIGURATION.md#the-four-secrets).

### Feature Flags

Optional modules are toggled per deployment with `IS_<MODULE>_PACKAGE_ENABLED`
(server) and `NEXT_PUBLIC_IS_<MODULE>_PACKAGE_ENABLED` (web): `TASKS`, `FIELDS`,
`MAPS`, `DOCUMENTS`, `TIMELINE_RECORDS`, `PROJECT_CONTEXT`, `BILLING`,
`SIGNING`, `RESEARCH_AGENT_INTEGRATION`. Only the literal string `"true"`
enables a module, and four of them (`TASKS`, `MAPS`, `PROJECT_CONTEXT`,
`RESEARCH_AGENT_INTEGRATION`) must be present (even as `false`) or the app
refuses to start. Enabling some modules requires extra configuration —
the full matrix is in
[`CONFIGURATION.md`](./CONFIGURATION.md#feature-flags).

### AI Model Configuration

Models are organized into four slots, resolved in this order: **database config (admin panel) → environment variable → hardcoded default** (resolution logic in `packages/core/turboplan-ai`, defaults in `packages/core/turboplan-env`).

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_MODEL_PRIMARY` | Chat, reasoning, artifacts, auto-responder |
| `OPENROUTER_MODEL_LITE` | Title generation, suggestions, prompt validation |
| `OPENROUTER_MODEL_IMAGE_PRIMARY` | User-triggered image generation |
| `OPENROUTER_MODEL_IMAGE_LITE` | Auto-generated cover images |

The research agent uses the Anthropic API directly (`ANTHROPIC_API_KEY`, `CLAUDE_MODEL`) — see [`apps/research-agent/README.md`](./apps/research-agent/README.md).

### Error Monitoring (Sentry)

Sentry is fully optional — every integration no-ops when its DSN variable is unset, so deployments without a Sentry account work unchanged. To enable it, create one Sentry project per service and set the DSN for the services you want monitored:

| Variable | App | Notes |
|----------|-----|-------|
| `NEXT_PUBLIC_SENTRY_DSN` | web, landing | Browser + server/edge runtime (inlined at build time) |
| `SENTRY_DSN` | server, mcp, research-agent, map-server | Server-side only |

Errors are captured at each runtime's global hook (Next.js `instrumentation.ts`, Hono `onError`, Cloudflare Worker wrapper, FastAPI middleware) — new routes and components need no instrumentation. All events pass through a PII scrub (`beforeSend`) that strips auth/cookie headers and redacts sensitive query params (magic-link tokens, presigned-URL signatures). Browser events are proxied through the app's own domain (`/monitoring`) to survive ad-blockers.

The GitHub Actions secrets and variables that wire Sentry into CI deployments
are listed in
[`CONFIGURATION.md`](./CONFIGURATION.md#deployment). Releases are tagged with the
deploy commit SHA automatically (`RELEASE_VERSION` / `NEXT_PUBLIC_RELEASE_VERSION`).

## Deployment

GitHub Actions workflows in `.github/workflows/` handle CI (E2E tests on PRs) and deployment to **Cloudflare Workers** — the only supported deployment target — via the `scripts/deploy-*.sh` scripts (web app and landing page through `@opennextjs/cloudflare`, API server and MCP server through Wrangler). The research agent deploys to Modal (sandbox) and Fly.io (app server). Preview deployments are created per pull request and cleaned up automatically.

The GitHub Actions secrets and repository variables each deploy needs — including
the always-required `WORKERS_SUBDOMAIN` and the custom-domain variables — are
documented in [`CONFIGURATION.md`](./CONFIGURATION.md#deployment).

## Customization

### Branding

Each app keeps its name, logo, and OG image behind one config module and one asset directory: `apps/turboplan/lib/brand.ts` + `apps/turboplan/public/brand/`, and `apps/landing-page/src/lib/brand.ts` + `apps/landing-page/public/brand/`. The display name comes from `NEXT_PUBLIC_APP_NAME` (web, landing) / `APP_NAME` (server). Mascot/illustration images under `public/images/` are page content rather than brand config — forks replace those separately if desired.

To rebrand, replace the *contents* of those files at the same paths — do not move or rename them. Favicons stay at their Next.js conventional locations (`apps/turboplan/app/favicon.ico`, `apps/landing-page/public/favicon.ico`) and are replaced in place.

Billing has one more brand-bearing file: `packages/modules/turboplan-billing/catalog/brand.yaml` holds the Stripe `product` key and `meter_event_name`. Both name live Stripe objects and are effectively immutable per Stripe account, so they are kept apart from `pricing.yaml` (which flows upstream → fork freely). See the billing package README before changing either.

The repo ships a `.gitattributes` marking the override surface `merge=ours` so a fork's branding survives upstream merges without conflicts. The attribute is inert until the fork enables the driver — run once per clone (and in CI checkouts that merge), **in the fork clone only**:

```bash
git config --local merge.ours.driver true
```

Never set it with `--global`: the driver would then silently keep "ours" for these paths in every merge in every repository on that machine, including upstream branch merges. Two consequences to know about: the driver keeps the fork's file *verbatim*, so an upstream change to the export shape of `brand.ts` (a new or renamed key) reaches a fork only as a typecheck failure after the merge, to be fixed by hand; and upstream contributors who also maintain a fork should not enable the driver in their upstream clone.

#### Production domains (required for a branded deployment)

Custom domains are configured entirely through GitHub Actions **repository
variables** — no code changes. `WORKERS_SUBDOMAIN` is always required, and
`PRODUCTION_APP_DOMAIN`, `PRODUCTION_API_DOMAIN`, `PRODUCTION_LANDING_DOMAIN`,
`PRODUCTION_MAP_DOMAIN`, `PRODUCTION_MCP_DOMAIN` and `PRODUCTION_COOKIE_DOMAIN`
attach your own hostnames. See
[`CONFIGURATION.md`](./CONFIGURATION.md#github-actions-variables) for the full
table, the DNS prerequisites and the workers.dev fallback behaviour. The runtime
app display name is separate and env-driven (`APP_NAME` /
`NEXT_PUBLIC_APP_NAME`).

## Community

- **Contributing** — see [CONTRIBUTING.md](./CONTRIBUTING.md). Issues and pull
  requests are welcome; review is best-effort.
- **Code of Conduct** — participation is governed by our
  [Code of Conduct](./CODE_OF_CONDUCT.md).
- **Security** — please report vulnerabilities privately. See
  [SECURITY.md](./SECURITY.md); do not open a public issue.
- **Changelog** — release history lives in [CHANGELOG.md](./CHANGELOG.md).
- **CI** — every pull request runs typecheck, lint, format check and unit
  tests; see [ci.yml](./.github/workflows/ci.yml).

Working with an AI coding agent? See [AGENTS.md](./AGENTS.md) for a
tool-agnostic summary of the build commands, conventions, and architecture
rules.

## License

Licensed under the Apache License 2.0 — see [LICENSE](./LICENSE) and
[NOTICE](./NOTICE) for details.
