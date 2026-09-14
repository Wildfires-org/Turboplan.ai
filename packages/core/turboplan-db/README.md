# @wildfires-org/turboplan-db

Centralized database schemas and client for TurboPlan.

## Overview

This package consolidates all database schemas, migrations, queries, and the Drizzle client configuration. It provides a singleton PostgreSQL connection with pooling and organizes schemas into logical groups.

## Structure

```
turboplan-db/
├── drizzle.config.ts    # Centralized Drizzle configuration (consumed by apps/turboplan)
├── src/
│   ├── db-client/       # Database client and connection management
│   ├── schemas/         # All database schemas
│   │   ├── core/        # Core app schemas (user, chat, message, prompt, etc.)
│   │   ├── workspace/   # Workspace schemas (organization, office, project + memberships)
│   │   └── modules/     # Module-specific schemas (tasks, maps, etc.)
│   ├── migrations/      # Generated SQL migrations
│   ├── queries/         # Reusable database query functions
│   ├── types/           # Client-safe TypeScript types (no Drizzle imports)
│   ├── utils/           # Client-safe helper functions
│   └── constants/       # Shared constants
```

## Exports

| Path | Contents |
| --- | --- |
| `.` / `/schemas` | Drizzle table definitions (server-only) |
| `/db-client` | `db`, `getDB()`, `closeDB()`, `runWithWorkerConnection()`, `createTestDB()`, `isUniqueViolation()` |
| `/queries` | Reusable query functions (users, profiles, prompts, comments, ...) |
| `/types` | Pure TypeScript types — safe to import in client components |
| `/utils` | Client-safe helpers |
| `/constants` | Shared constants |
| `/drizzle-config` | `createDrizzleConfig()` for drizzle-kit |
| `/migrate` | `runMigrations()` for programmatic migrations |

## Usage

### Database client

```typescript
import { eq } from "drizzle-orm";
import { project } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

const rows = await db.select().from(project).where(eq(project.id, id));
```

Client components must not import schemas or the db client — use `/types` and `/utils` instead. Next.js apps never access the database directly; all DB operations go through Hono endpoints in `apps/server`.

### Drizzle configuration

```typescript
import { createDrizzleConfig } from "@wildfires-org/turboplan-db/drizzle-config";
import { getCommonEnv } from "@wildfires-org/turboplan-env";

const ENV = getCommonEnv();
export default createDrizzleConfig(ENV.POSTGRES_URL);
```

The configuration uses relative paths from the app directory to this package's schemas and migrations, so run drizzle-kit from `apps/turboplan` (where `drizzle.config.ts` consumes it and env vars are loaded).

### Run migrations programmatically

```typescript
import { runMigrations } from "@wildfires-org/turboplan-db/migrate";
import { getCommonEnv } from "@wildfires-org/turboplan-env";

await runMigrations(getCommonEnv().POSTGRES_URL);
```

## Database Operations

Run all database scripts from `apps/turboplan`, where environment variables are loaded:

- `pnpm db:push` – Sync schema changes directly to the local DB (preferred during development)
- `pnpm db:generate` – Generate migrations (for production-ready changes)
- `pnpm db:migrate` – Run migrations
- `pnpm db:studio` – Open Drizzle Studio
- `pnpm db:check` – Check for schema drift

Generated migrations land in `src/migrations/` in this package and should be reviewed before committing.

## Dependencies

- `drizzle-orm` – ORM
- `postgres` – PostgreSQL client
- `@wildfires-org/turboplan-env` – Environment configuration
