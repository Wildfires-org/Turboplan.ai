# @wildfires-org/turboplan-admin

Admin panel for TurboPlan — Hono middleware, routers, and React admin UI.

## Exports

| Path | Contents |
| --- | --- |
| `.` | Types: `AdminRole`, `AdminStatusResponse` |
| `/server` | `adminMiddleware`, `superAdminMiddleware`, `adminRouter`, `adminMeRouter` |
| `/client` | Admin UI components and hooks |

## Server

`adminRouter` bundles the admin sub-routes and is mounted at `/api/admin` in `apps/server`, behind `adminMiddleware`:

- `/prompts` – Manage AI prompts stored in the database
- `/admin-users` – Manage admin users
- `/webhook-logs` – Inspect webhook logs
- `/ai-models` – Configure AI model selection

`adminMeRouter` is mounted separately (outside `/api/admin/*`) so any authenticated user can check their own admin status.

## Client

```tsx
import {
  AddAdminUserForm,
  AdminUsersList,
  AiModelsSettings,
  CatalogerAdminView,
  PromptsSplitView,
  WebhookLogsView,
  useAdminStatus,
  useAdminUsers,
} from "@wildfires-org/turboplan-admin/client";
```

Components fetch data via SWR from the `/api/admin/*` endpoints. Use `useAdminStatus()` to gate admin-only UI.
