---
description: Package export patterns and catalog of available packages
globs:
alwaysApply: false
---

# Packages

## Export Pattern

Packages follow a consistent export structure:

- `/client` or `client.ts` – React components, hooks (client-side)
- `/server` or `server.ts` – Hono routers, services (server-side)
- `/types` or `types.ts` – TypeScript types and Zod schemas

Example imports:
```typescript
import { TaskList } from "@wildfires-org/turboplan-tasks/client";
import { tasksRouter } from "@wildfires-org/turboplan-tasks/server";
import type { Task } from "@wildfires-org/turboplan-tasks/types";
```

## Core Packages (`packages/core/`)

- **turboplan-db** – Database schemas, Drizzle client, migrations
- **turboplan-rbac** – Role-based access control, Hono/Next.js middleware
- **turboplan-env** – Environment variable management (never use process.env)
- **turboplan-api-client** – Authenticated fetch wrapper, JWT handling
- **turboplan-utils** – Shared shadcn/ui components, Tailwind utilities
- **turboplan-ai** – AI prompts, image generation service
- **turboplan-auth** – Shared authentication utilities (sessions, magic links)
- **turboplan-admin** – Admin panel: middleware, routers, admin UI
- **turboplan-workspace** – Organization/office/project CRUD
- **turboplan-upload** – File upload handling
- **turboplan-feature-flags** – Feature toggles for optional modules
- **turboplan-mail** – Email services with React Email templates (Resend)
- **turboplan-public** – Public API routes (no authentication required)
- **turboplan-search** – Cross-entity full-text search

## Module Packages (`packages/modules/`)

- **turboplan-tasks** – Task and milestone management with Gantt charts
- **turboplan-map** – Interactive maps with Leaflet
- **turboplan-chat-actions** – Quick action buttons for chat
- **turboplan-documents** – Project document uploads (PDF, Word) with drag-and-drop
- **turboplan-gantt-task** – Gantt chart component library
- **turboplan-fields** – Custom project fields management
- **turboplan-billing** – Stripe billing and subscription management
- **turboplan-signing** – Document signing integration (Documenso)
- **turboplan-project-context** – Project context management
- **turboplan-timeline-records** – Project timeline records (activity log)
- **turboplan-research-agent-integration** – Integration with the research agent app

## Services (`packages/services/`)

- **turboplan-map-server** – Python/FastAPI service for GIS processing

For detailed documentation on specific packages, check their README files in the package directories.
