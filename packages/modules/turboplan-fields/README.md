# @wildfires-org/turboplan-fields

Custom project fields for TurboPlan: user-defined key/value fields (text, number, date, …) attached to projects, with CRUD UI, validation, and RBAC-protected API routes.

## Exports

- `./client` — components (`ProjectFields`, `FieldRow`, `FieldValueEditor`, add/edit dialogs, …) and the `useProjectFields` hook
- `./server` — `fieldsRouter` (Hono), `getProjectFieldsForChat` (chat context helper), Zod schemas
- `./types` — `ProjectField` (from `@wildfires-org/turboplan-db`), `ProjectFieldType`, `CreateProjectFieldData`, `UpdateProjectFieldData`

## API Endpoints

`fieldsRouter` is mounted at `/api/projects` in `apps/server` (feature-flag gated), giving project-scoped routes:

- `GET /:id/fields` — list fields (project `READ`)
- `POST /:id/fields` — create a field (project `UPDATE`)
- `PUT /:id/fields/:fieldId` — update a field (project `UPDATE`)
- `DELETE /:id/fields/:fieldId` — delete a field (project `UPDATE`)

Mutations record activity entries via `@wildfires-org/turboplan-timeline-records`.

## Usage

```tsx
import { ProjectFields } from "@wildfires-org/turboplan-fields/client";

<ProjectFields projectId={projectId} />;
```

## Feature Flag

`IS_FIELDS_PACKAGE_ENABLED` / `NEXT_PUBLIC_IS_FIELDS_PACKAGE_ENABLED` (`isFieldsPackageEnabled()` from `@wildfires-org/turboplan-feature-flags`).
