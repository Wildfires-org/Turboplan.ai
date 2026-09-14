---
description: Hono backend routing, RBAC protection, and migration from Next.js
globs:
  - apps/server/**/*.ts
  - packages/**/server/**/*.ts
  - packages/**/server.ts
alwaysApply: false
---

# Backend Guidelines

## Hono as Canonical Backend

All new API endpoints must be created in the Hono server (`apps/server`), not in Next.js. The Hono server is the single source of truth for all business logic that touches the database.

Prefer creating endpoints in packages that export routers, then mounting them in `apps/server/src/router.ts`.

## Avoid Next.js API Routes and Server Actions

Do not create new Next.js API routes (`app/api/`) or server actions (`"use server"`). When touching existing ones, prefer refactoring them toward Hono endpoints.

Existing Next.js routes in `apps/turboplan/app/api/` are legacy and should be migrated when modified.

## RBAC Protection

All mutating endpoints (POST, PUT, PATCH, DELETE) must be RBAC-protected unless explicitly stated otherwise. Use the `requirePermission` middleware from `@wildfires-org/turboplan-rbac/hono`.

The entity hierarchy is: Organization → Office → Project. Roles (Owner, Editor, Viewer) inherit downward.

See `packages/core/turboplan-rbac/examples/hono-protected-routes.ts` for middleware usage patterns.

## Router Structure

Create routers using `new Hono<RBACContext>()` for type-safe access to user and permission context. Mount routers in `apps/server/src/router.ts`.

## Environment Variables

Always use `@wildfires-org/turboplan-env` to access environment variables. Never use `process.env` directly.

```typescript
import { getApiEnv } from "@wildfires-org/turboplan-env";
const env = getApiEnv();
```

Adding a variable means touching four places: the getter in
`packages/core/turboplan-env/src/index.ts`, the relevant `.env.example`, the
`BRIDGE_KEYS` list in `apps/server/src/worker.ts` (or the Worker cannot see it in
production), and the matching `scripts/deploy-*.sh`. `CONFIGURATION.md` at the
repo root is the canonical cross-service reference.
