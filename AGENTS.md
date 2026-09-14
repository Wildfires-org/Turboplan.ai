# AGENTS.md

Guidance for AI coding agents (and human contributors) working in this repository. This is a tool-agnostic summary; Claude Code users also have `CLAUDE.md` and `.claude/rules/*.md` with more depth.

## Project overview

TurboPlan is a pnpm + Turborepo monorepo: an AI chat interface plus modular project-management features (tasks, documents, maps, fields, billing, signing) toggled per deployment via feature flags. All internal packages use the `@wildfires-org/*` namespace and `workspace:*` dependencies.

```
apps/turboplan       Next.js 15 web app (port 3000)
apps/server          Hono API — the canonical backend, runs on Bun (port 3001)
apps/landing-page    Next.js marketing site (port 3002)
apps/mcp-server      Model Context Protocol server (Cloudflare Workers)
apps/research-agent  Autonomous research agent, Claude Agent SDK (port 3003)
packages/core        Infrastructure: db, auth, rbac, env, ai, mail, upload, ...
packages/modules     Feature modules: tasks, documents, billing, signing, maps, ...
packages/services    Standalone services (Python map server)
e2e                  Playwright end-to-end tests
```

## Setup

- Node.js 22+ and pnpm 10 (`corepack enable`). A PostgreSQL database is required; an OpenRouter API key is needed for AI features but the stack boots without one.
- Install: `pnpm install`
- Configure env: **`CONFIGURATION.md` is the canonical reference.** The copy-to filename differs per service — `apps/turboplan`, `apps/server`, `apps/landing-page` and `apps/research-agent` use `.env.local`; `e2e`, `packages/services/turboplan-map-server` and `docker/documenso` use `.env`. At minimum set `POSTGRES_URL`, `AUTH_SECRET`, `INTERNAL_API_SECRET`, `JWT_SIGNING_SECRET`, `ENCRYPTION_KEY`, plus the five presence-checked feature flags and the URL variables listed in `CONFIGURATION.md`.
- Build packages BEFORE the database scripts — they import built packages: `pnpm build:packages`
- Sync the schema: `cd apps/turboplan && pnpm db:push`
- With no mail provider configured, magic-link emails are silently dropped. Mint a login link instead: `cd apps/turboplan && pnpm exec tsx --env-file=.env.local ../../e2e/scripts/mint-magic-link.ts you@example.test`

## Commands

Run from the repo root unless noted:

```bash
pnpm dev             # all apps except research-agent
pnpm build           # build everything
pnpm build:packages  # build only packages
pnpm typecheck       # type-check all apps and packages
pnpm lint:fix        # lint (Biome)
pnpm format:write    # format (Biome)
pnpm test            # unit tests (turbo)
pnpm e2e             # Playwright E2E (needs TEST_POSTGRES_URL)
```

Database scripts run from `apps/turboplan/`: `db:push`, `db:generate`, `db:migrate`, `db:studio`.
Target one workspace with `--filter`, e.g. `pnpm --filter turboplan dev`.

## Conventions

- **Biome 2.1.4** is the linter and formatter at the repo root — never introduce ESLint or Prettier. (`apps/landing-page` is the one exception: it uses ESLint + Prettier in its own toolchain.) Style: 2-space indent, double quotes, semicolons and trailing commas always, 80-col width.
- **TypeScript everywhere.** Prefer `type` over `interface`. Prefer `const` arrow functions over `function` declarations. Always use curly braces and a newline for `if` bodies. Use early returns.
- **Naming:** files and directories in kebab-case; React components export PascalCase from kebab-case files; hooks are `use-` prefixed; event handlers `handle*`.
- Keep comments to what the code can't say itself. Avoid adding new markdown docs unless asked.

## Architecture rules

- **Hono is the canonical backend.** All new API endpoints go in `apps/server` (or a package-exported router mounted in `apps/server/src/router.ts`) — not in Next.js API routes or server actions.
- **Next.js never touches the database directly.** All DB access goes through the Hono API. Existing `apps/turboplan/app/api/*` routes are legacy.
- **RBAC on every mutation.** Protect POST/PUT/PATCH/DELETE with `requirePermission` from `@wildfires-org/turboplan-rbac/hono`. Entity hierarchy: Organization → Office → Project (roles inherit downward).
- **Database:** Drizzle ORM + PostgreSQL. Schemas live in `packages/core/turboplan-db/src/schemas/`, migrations in `.../src/migrations/`. Use `db:push` for local iteration, `db:generate` for production-ready migrations.
- **Environment variables:** access them through `@wildfires-org/turboplan-env` (typed, fail-fast) — never read `process.env` directly. Adding a variable means updating that module, the relevant `.env.example`, and — if it must reach a deployed Worker — the `BRIDGE_KEYS` list in `apps/server/src/worker.ts` and the matching `scripts/deploy-*.sh`.
- **Data fetching (client):** use SWR with the shared fetchers from `@wildfires-org/turboplan-api-client`.
- **Packages** follow a `/client`, `/server`, `/types` export convention (not every package exposes all three — check its `exports` map).

## Testing

- Unit tests: `pnpm --filter <app> test`. `apps/turboplan` uses the Node test runner (`node --import tsx --test`), `apps/landing-page` uses Jest, `apps/research-agent` uses Vitest.
- E2E: `pnpm e2e` runs the full Playwright lifecycle (start servers → test → stop) and needs a dedicated `TEST_POSTGRES_URL`. See `e2e/README.md`.
- Write or extend tests for new functionality; CI runs E2E on PRs.

## Before opening a PR

- `pnpm typecheck`, `pnpm lint:fix`, and relevant tests must pass.
- **Add a changeset for any behaviour change**: `pnpm changeset` (or `pnpm changeset --empty` for docs/tests/invisible refactors). All packages share one version and bump together. A `pre-push` hook and a CI job both enforce this; bump guidance is in `.claude/skills/release-versioning/SKILL.md`.
- New or changed env vars must be documented in the relevant `.env.example` **and** `CONFIGURATION.md`.
- **Do not create git commits unless explicitly asked to.** Branch off `main`; PRs target `main`. Use [Conventional Commits](https://www.conventionalcommits.org/).

## More detail

- `CONFIGURATION.md` — every environment variable, the four auth secrets, feature flags, deployment and startup errors.
- `CONTRIBUTING.md` — contribution workflow.
- `.claude/rules/*.md` — in-depth conventions (architecture, backend, database, frontend, styling, testing, packages, mcp-server).
- Each app and package has its own `README.md`.
