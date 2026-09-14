# @wildfires-org/turboplan-tasks

Task and milestone management for TurboPlan: table, card, and Gantt views, AI-assisted task creation via the chat artifact system, assignee resolution, and email notifications.

## Exports

| Entry | Contents |
|-------|----------|
| `./client` | All components and hooks (barrel of `./components` + `./hooks`) |
| `./server` | `tasksRouter`, `milestonesRouter`, `usersRouter` (Hono), `TaskService`, `MilestoneService`, `AssigneeService`, `getTaskNotificationService`, Drizzle repositories |
| `./types` | Task/milestone types and component prop types |
| `./components` | React components (`TasksContainer`, `TasksView`, `GanttChart`, modals, …) |
| `./hooks` | `useProjectTasks`, `useTaskActions`, Gantt/table UI hooks |
| `./providers` | `TasksProvider` React context |
| `./services` | Client-side `TaskDataService` / `taskDataService` (API-backed) |
| `./artifact/server` | `taskDocumentHandler` — AI artifact handler (create/update tasks from chat) |
| `./artifact/client` | `tasksArtifact` — client artifact definition |
| `./prompts` | AI prompts for task creation/analysis |

## Integration

### API routes

Routers are mounted in `apps/server/src/routes/privateRoutes.ts` when the tasks feature flag is enabled:

```typescript
import {
  milestonesRouter,
  tasksRouter,
  usersRouter,
} from "@wildfires-org/turboplan-tasks/server";

router.route("/api/tasks", tasksRouter);
router.route("/api/milestones", milestonesRouter);
router.route("/api/users", usersRouter);
router.route("/api/projects", milestonesRouter); // project-scoped milestone routes
```

### Database

Schemas live in `@wildfires-org/turboplan-db` (`schemas/modules/tasks.ts`), not in this package. Run migrations from `apps/turboplan` (`pnpm db:push` locally, `pnpm db:generate` + `pnpm db:migrate` for production changes).

### Artifact

Register `taskDocumentHandler` (server) and `tasksArtifact` (client) with TurboPlan's artifact system to let the AI create and update tasks from chat.

### Feature flag

Gated by `IS_TASKS_PACKAGE_ENABLED` / `NEXT_PUBLIC_IS_TASKS_PACKAGE_ENABLED` (`isTasksPackageEnabled()` from `@wildfires-org/turboplan-feature-flags`).

## Styling

Components use Tailwind CSS classes and are processed by the consuming app's Tailwind configuration — no Tailwind setup is needed in this package. The Gantt view renders with `@wildfires-org/turboplan-gantt-task`.

## Development

```bash
pnpm build       # Build the package (tsdown)
pnpm dev         # Watch mode
pnpm typecheck   # Type check
```

Task and milestone mutations record activity entries via `@wildfires-org/turboplan-timeline-records`, and assignee changes trigger email notifications via `@wildfires-org/turboplan-mail`.
