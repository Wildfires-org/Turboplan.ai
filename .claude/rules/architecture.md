---
description: Monorepo structure, apps vs packages, and when to create new packages
globs:
alwaysApply: false
---

# Project Architecture

## Monorepo Structure

This is a pnpm monorepo managed by Turborepo:

- `apps/turboplan` – Main Next.js 15 web application (AI chat interface)
- `apps/server` – Hono backend API server (canonical backend for all business logic)
- `apps/landing-page` – Marketing website (Next.js)
- `apps/mcp-server` – Model Context Protocol server (Cloudflare Workers, PAT auth)
- `apps/research-agent` – Autonomous research agent (Claude Agent SDK, Hono)
- `packages/core/` – Core infrastructure packages (db, auth, rbac, env, api-client, utils, ...)
- `packages/modules/` – Feature modules (tasks, maps, documents, billing, signing, ...)
- `packages/services/` – Standalone services (Python map-server)
- `e2e/` – End-to-end tests (Playwright)

## Package Namespace

All packages use the `@wildfires-org/*` namespace. Use `workspace:*` for internal dependencies.

## When to Create a New Package

Before hardcoding a new concept into an app or existing package, consider whether it should be a dedicated package. Propose a new package when:

- The functionality is reusable across multiple apps or packages
- It has a clear single responsibility (e.g., a new integration, a distinct feature module)
- It would benefit from independent versioning or could be extracted later

Ask the user before creating a new package to confirm the approach.
