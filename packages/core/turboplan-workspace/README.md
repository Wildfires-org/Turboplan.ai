# @wildfires-org/turboplan-workspace

Workspace entities for TurboPlan: organizations, offices, and projects — CRUD, membership management, and invitations.

The entity hierarchy is Organization → Office → Project; roles (Owner, Editor, Viewer) inherit downward (see `@wildfires-org/turboplan-rbac`).

## Exports

| Path | Contents |
| --- | --- |
| `/client` | Member management components and hooks |
| `/server` | Hono routers, queries, and Zod validation per entity (server-only) |
| `/types` | Shared types (`EntityType`, `MemberRole` re-exports, member/invitation types) |

## Server

Routers (mounted in `apps/server`, RBAC-protected):

- `organizationsRouter`, `officesRouter`, `projectsRouter` – Entity CRUD and member endpoints
- `invitationsRouter` / `publicInvitationsRouter` – Email invitations (the public router serves invitation details for the acceptance page before login; accepting requires authentication)
- `projectDocumentsRouter` – Project document endpoints
- `commentsRouter` – Comments
- `organizationSigningConfigRouter` – Signing configuration
- `usersRouter` – User search/lookup

Query and validation modules are exported per entity (e.g. `server/organizations/queries`, `server/projects/validation`) along with personal-workspace and project-submission helpers.

```typescript
import { projectsRouter } from "@wildfires-org/turboplan-workspace/server";

apiRouter.route("/api/projects", projectsRouter);
```

## Client

```tsx
import {
  AddMemberForm,
  MemberListItem,
  PendingInvitationItem,
  useMemberInvitation,
  useMemberManagement,
  useUserSearch,
} from "@wildfires-org/turboplan-workspace/client";
```

Also includes hooks for project module configuration (`useModuleVisibility`, `useModuleOrder`, `useModuleColumns`, `useModulePublicVisibility`) and empty-state suggestions.

## Seeding

Seed demo organizations into the local database:

```bash
pnpm --filter @wildfires-org/turboplan-workspace seed:organizations
```
