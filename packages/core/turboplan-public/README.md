# @wildfires-org/turboplan-public

Public (unauthenticated) API routers and queries for TurboPlan — powers the public catalog of organizations, offices, and projects.

## Exports

| Path | Contents |
| --- | --- |
| `/server` | Public Hono routers |
| `/queries` | Read-only query functions for public data |
| `/types` | Types inferred from the public queries (`PublicOrganization`, `PublicOffice`, ...) |

## Routers

All routers serve only data explicitly marked as public and require no authentication. They are mounted in `apps/server` **before** the auth middleware:

- `publicOrganizationsRouter` / `publicOfficesRouter` / `publicProjectsRouter` – Public catalog by slug
- `publicTemplatesRouter` – Public project templates
- `publicModulesRouter` – Public module data (milestones, tasks) for public projects
- `publicTimelineRouter` – Public project timeline
- `publicCommentsRouter` – Public comments (may trigger the AI auto-responder)
- `publicImagesRouter` – Public image lookups

```typescript
import { publicProjectsRouter } from "@wildfires-org/turboplan-public/server";

apiRouter.route("/api/public/projects", publicProjectsRouter);
```

## Queries

```typescript
import {
  getPublicProjects,
  getActiveGovernmentOrganizations,
} from "@wildfires-org/turboplan-public/queries";
```

Queries only return entities flagged as publicly visible. When adding new queries, keep that invariant — never expose private data through this package.
