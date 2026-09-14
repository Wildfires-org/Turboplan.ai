# @wildfires-org/turboplan-timeline-records

Project activity log (timeline records) for TurboPlan. Other modules record entity changes — projects, tasks, milestones, map layers, fields, comments, context, documents, members, dependencies — with field-level diffs, and this package serves and renders them.

## Exports

- `./server` — `createTimelineRecord` / `createTimelineRecordOrThrow`, `configureRecorder` (global error handler, call once at server startup), `computeChanges` (field-level diff), per-entity field definitions, `timelineRouter` (Hono), service functions (`getTimeline`, `getTimelineStats`, `softDeleteRecord`), Zod schemas
- `./client` — `ReadOnlyTimelineContent` component and `transformTimelineRecord` (maps records to display entries)
- `./types` — `TimelineRecord`, `EnrichedTimelineRecord`, `EntityType`, `Action`, `ValueType`, `FieldChange`, `ResourceUrl`

## Recording Changes

```typescript
import {
  computeChanges,
  createTimelineRecord,
  taskFieldDefs,
} from "@wildfires-org/turboplan-timeline-records/server";

await createTimelineRecord({
  projectId,
  userId,
  entityType: "task",
  entityId: task.id,
  entityName: task.title,
  action: "updated",
  changes: computeChanges(previousTask, updatedTask, taskFieldDefs),
});
```

`createTimelineRecord` never throws — failures are forwarded to the handler registered with `configureRecorder`, so recording cannot break business operations. Use `createTimelineRecordOrThrow` when the caller must know about failures.

## API Endpoints

`timelineRouter` is mounted at `/api/projects` in `apps/server` (feature-flag gated):

- `GET /:id/timeline` — paginated timeline for a project (project `READ`, or public government projects)
- `GET /:id/timeline/stats` — activity summary (project `READ`, or public government projects)
- `POST /:id/timeline` — manually create a record (project `UPDATE`)
- `PATCH /:id/timeline/:recordId/visibility` — toggle record public visibility (project `UPDATE`)
- `DELETE /:id/timeline/:recordId` — soft-delete a record (project `UPDATE`)

## Feature Flag

`IS_TIMELINE_RECORDS_PACKAGE_ENABLED` / `NEXT_PUBLIC_IS_TIMELINE_RECORDS_PACKAGE_ENABLED` (`isTimelineRecordsPackageEnabled()` from `@wildfires-org/turboplan-feature-flags`).

## Tests

```bash
node --import tsx --test tests/diff.test.ts
```
