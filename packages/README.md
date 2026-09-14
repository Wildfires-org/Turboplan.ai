# TurboPlan Packages

Shared packages used across the TurboPlan monorepo. All packages use the `@wildfires-org/*` namespace and are referenced with the `workspace:*` protocol.

## Layout

- `core/` – Infrastructure packages (database, auth, RBAC, env, API client, shared UI)
- `modules/` – Feature modules (tasks, maps, documents, billing, ...)
- `services/` – Standalone services (non-TypeScript or independently deployed)

## Core Packages (`packages/core/`)

| Package | Description |
| --- | --- |
| `turboplan-admin` | Admin panel — middleware, Hono routers, and admin UI (users, prompts, AI models, webhook logs) |
| `turboplan-ai` | AI prompts, prompt service, model resolution, and image generation |
| `turboplan-api-client` | Authenticated fetch wrapper, SWR fetchers, JWT and PAT utilities |
| `turboplan-auth` | Shared authentication utilities (NextAuth config, session verification) |
| `turboplan-db` | Database schemas, Drizzle client, queries, and migrations |
| `turboplan-env` | Typed environment variable access (never use `process.env` directly) |
| `turboplan-feature-flags` | Env-driven feature toggles for optional modules |
| `turboplan-mail` | Email services with React Email templates (Resend / Ethereal / noop) |
| `turboplan-public` | Public (unauthenticated) API routers and queries |
| `turboplan-rbac` | Role-based access control with Hono and Next.js middleware |
| `turboplan-search` | Cross-entity full-text search (omni-search UI + Hono router) |
| `turboplan-upload` | File uploads to Cloudflare R2 via presigned URLs |
| `turboplan-utils` | Shared shadcn/ui components, Tailwind `cn()`, hooks, and utilities |
| `turboplan-workspace` | Organization / office / project CRUD, members, and invitations |

## Module Packages (`packages/modules/`)

| Package | Description |
| --- | --- |
| `turboplan-billing` | Stripe billing and subscription management |
| `turboplan-chat-actions` | Customizable quick action buttons below the chat input |
| `turboplan-documents` | Document upload and management UI for projects |
| `turboplan-fields` | Custom project fields management |
| `turboplan-gantt-task` | Interactive Gantt chart for React |
| `turboplan-map` | Interactive maps (Leaflet) |
| `turboplan-project-context` | Project context management |
| `turboplan-research-agent-integration` | Research agent integration |
| `turboplan-signing` | Document signing integration via Documenso |
| `turboplan-tasks` | Task and milestone management |
| `turboplan-timeline-records` | Project timeline records (activity log) |

## Services (`packages/services/`)

| Package | Description |
| --- | --- |
| `turboplan-map-server` | GIS file processing service (Python, Cloudflare Container) |

## Export Pattern

TypeScript packages follow a consistent export structure:

- `/client` – React components and hooks (client-side)
- `/server` – Hono routers, services, and queries (server-side)
- `/types` – TypeScript types and Zod schemas

```typescript
import { TaskList } from "@wildfires-org/turboplan-tasks/client";
import { tasksRouter } from "@wildfires-org/turboplan-tasks/server";
import type { Task } from "@wildfires-org/turboplan-tasks/types";
```

## Usage

Add a package as a dependency in an app or another package:

```json
{
  "dependencies": {
    "@wildfires-org/package-name": "workspace:*"
  }
}
```

Then run `pnpm install` from the repo root.

## Building

Build all packages from the repo root:

```bash
pnpm build:packages
```

Or build a single package from its directory with `pnpm build` (most packages use `tsdown`).

## Package Standards

- Written in TypeScript, linted and formatted with Biome
- Database access only through Hono endpoints (`apps/server`) — never directly from Next.js
- Packages document their API in their own README where one exists
