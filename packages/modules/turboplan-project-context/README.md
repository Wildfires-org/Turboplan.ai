# @wildfires-org/turboplan-project-context

Project context entries for TurboPlan: short labeled notes (label, content, optional URL) attached to a project. Entries are managed in the dashboard and injected into the AI chat's system prompt so the assistant knows project-specific background.

## Exports

- `./client` — `ProjectContextList`, `ContextEntryCard`, `ContextFormDialog` components and the `useProjectContext` hook
- `./server` — `contextRouter` (Hono), `getProjectContextForChat` (system-prompt block), `insertProjectContext`, Zod schemas
- `./types` — `ProjectContext` (from `@wildfires-org/turboplan-db`), `ContextEntryWithCreator`, create/update input types

## API Endpoints

`contextRouter` is mounted at `/api/projects` in `apps/server` (feature-flag gated), giving project-scoped routes:

- `GET /:id/context` — list entries with creator metadata (project `READ`, or public government projects)
- `POST /:id/context` — add an entry (project `UPDATE`)
- `PATCH /:id/context/:contextId` — update an entry (project `UPDATE`)
- `DELETE /:id/context/:contextId` — delete an entry (project `UPDATE`)

## Usage

```tsx
import { ProjectContextList } from "@wildfires-org/turboplan-project-context/client";

<ProjectContextList projectId={projectId} readOnly={false} />;
```

On the server, `getProjectContextForChat(projectId)` returns the project's context entries formatted as a markdown block for the chat system prompt (or `undefined` when there are none).

## Feature Flag

`IS_PROJECT_CONTEXT_PACKAGE_ENABLED` / `NEXT_PUBLIC_IS_PROJECT_CONTEXT_PACKAGE_ENABLED` (`isProjectContextPackageEnabled()` from `@wildfires-org/turboplan-feature-flags`).
