---
name: seed-script-module-resolution
description: How e2e/scripts can use module-package services (tasks, map, fields, timeline, upload) that e2e/package.json does not depend on
metadata:
  type: reference
---

`e2e/` only depends on turboplan-db/env/workspace/billing/api-client. Scripts under `e2e/scripts/` resolve other workspace packages through apps/server (which depends on all of them):
`createRequire(<repo>/apps/server/package.json).resolve("@wildfires-org/turboplan-tasks/server")` then dynamic `import(pathToFileURL(...))`. Same built `dist/` as the running API, same drizzle instance, no `pnpm install` needed. Working example: `e2e/scripts/seed-demo-project.ts`.

Gotchas: timeline records are written by routers, not services (except `createProjectFieldEntry`), so scripts must call `createTimelineRecord` themselves; project progress bar = elapsed time between project `startDate`/`endDate`, not task completion.

Related: [[dev-environment-facts]]
