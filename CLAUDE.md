# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For detailed conventions and architecture, see the rule files in `.claude/rules/`.
For environment variables, the four authentication secrets, feature flags and
deployment, see [`CONFIGURATION.md`](./CONFIGURATION.md).

## CRITICAL: No Autonomous Git Commits

**NEVER run `git commit`, `git add`, or any git staging/committing commands unless the user explicitly asks you to commit.** This is the highest-priority rule. Do not commit after completing a task, do not commit "for convenience", do not commit as part of a workflow. Only commit when directly requested by the user.

## Design Principles

Always follow these principles when writing and modifying code:

- **YAGNI** - You Aren't Gonna Need It
- **KISS** - Keep It Simple, Stupid
- **DRY** - Don't Repeat Yourself - but prefer duplication over bad abstraction
- **SOLID**

## Delegation

For frontend/backend/tests/ai tasks, delegate to appropriate subagents FIRST

## Interactive Testing

When manually testing features in the running app, use the **Playwright MCP server** with the magic-link helper described in `.claude/rules/manual-testing.md`. Do not click through flows by hand or wait on real emails.

## Build and Run Commands

```bash
# Root commands (run from monorepo root)
pnpm dev                # Run all apps in dev mode
pnpm build              # Build all apps and packages
pnpm build:packages     # Build only packages (useful before running apps)
pnpm typecheck          # Type check all apps and packages
pnpm format:write       # Format all files with Biome
pnpm lint:fix           # Fix linting issues with Biome

# E2E tests (Playwright)
pnpm e2e                # Full E2E: setup, test, teardown
pnpm e2e:debug          # Run E2E tests in debug mode
pnpm e2e:ui             # Open Playwright UI
pnpm e2e:headed         # Run tests in headed browser

# Database (run from apps/turboplan; needs apps/turboplan/.env.local and
# a prior `pnpm build:packages` at the repo root)
pnpm db:push            # Sync schema to local DB (use during development)
pnpm db:generate        # Generate migrations (for production-ready changes)
pnpm db:migrate         # Run migrations
pnpm db:studio          # Open Drizzle Studio
```

### Running Individual Apps

```bash
# Main web app (port 3000)
pnpm --filter turboplan dev

# Hono API server (uses Bun)
pnpm --filter turboplan-server dev

# Landing page (port 3002)
pnpm --filter turboplan-landing-page dev
```

### Running Tests

```bash
# Unit tests for an app
pnpm --filter turboplan test
pnpm --filter turboplan-landing-page test

# Single test file (turboplan uses Node test runner)
cd apps/turboplan && node --import tsx --test unit-tests/path/to/file.test.ts
```
