---
description: Database access patterns with Drizzle ORM
globs:
  - apps/server/**/*.ts
  - packages/**/server/**/*.ts
  - packages/**/server.ts
alwaysApply: false
---

# Database Access

## DB Access Only Through Hono

Next.js apps must never access the database directly. All database operations go through Hono API endpoints in `apps/server` or package-exported routers.

This ensures consistent authorization, validation, and business logic enforcement.

## Drizzle ORM

Use Drizzle ORM with the centralized db-client:

```typescript
import { eq } from "drizzle-orm";
import { project } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
```

## Schema Location

All schemas live in `packages/core/turboplan-db/src/schemas/`:
- `core/` – User, chat, message, profile, etc.
- `workspace/` – Organization, office, project and their user relations
- `modules/` – Feature-specific schemas (tasks, maps, etc.)

## Queries

Reusable query functions go in `packages/core/turboplan-db/src/queries/`. Import and use these rather than duplicating query logic.

## Database Scripts

All database scripts (migrations, push, pull) are located in `apps/turboplan/package.json` for convenience. Run them from the turboplan app directory.

Two prerequisites, both easy to miss: they read `apps/turboplan/.env.local` by an
explicit hardcoded path (not `.env`), and they import the built workspace
packages — run `pnpm build:packages` from the repo root first.

## Local Development Workflow

For local development, prefer `db:push` to quickly sync schema changes to your local database. This is faster and more iterative than generating migrations.

Only generate migrations (`db:generate`) after local development work is complete and the schema changes are fully thought through. Migrations are for production-ready changes.

## Migrations

Migration files are stored in `packages/core/turboplan-db/src/migrations/`. Generated migrations should be reviewed before committing.
