# @wildfires-org/turboplan-rbac

Entity-based Role-Based Access Control (RBAC) system for TurboPlan.

## Features

- **Entity-based permissions** – Assign roles per organization, office, or project
- **Permission inheritance** – Organization roles apply to child offices and projects
- **Hierarchical entities** – Organization → Office → Project structure
- **Role system** – Owner, Editor, Viewer with clear permission boundaries
- **Framework integrations** – Middleware for both Hono and Next.js
- **Type-safe** – Full TypeScript support

## Exports

| Path | Contents |
| --- | --- |
| `.` | Client-safe types and constants: `EntityType`, `MemberRole`, `Action`, role helpers, admin utils |
| `/hono` | `requirePermission()`, `requireEntityPermission()`, `requireProjectReadOrPublicGov()`, `requireEntityReadOrPublicGov()`, `resolveProjectIdFromRow()`, `RBACContext` types |
| `/server` | `getRBACService()`, `RBACService`, `permissionsRouter`, `isAdmin()` (server-only, requires DB) |
| `/hooks` | `useEntityPermission()` React hook (SWR-based) |
| `/nextjs` | `requirePermission()` / `checkPermission()` for Next.js route handlers (legacy — prefer Hono) |

Do not import `/server` in client components — it bundles database code.

## Core Concepts

### Entity Types

Three hierarchical entity types:

- **`ORGANIZATION`** – Top-level entity
- **`OFFICE`** – Mid-level entity (belongs to an organization)
- **`PROJECT`** – Leaf entity (belongs to an office)

```typescript
import { EntityType } from "@wildfires-org/turboplan-rbac";

EntityType.ORGANIZATION; // 'organization'
EntityType.OFFICE; // 'office'
EntityType.PROJECT; // 'project'
```

### Member Roles

- **`VIEWER`** – Read-only access
- **`EDITOR`** – Read + write access (create, update)
- **`OWNER`** – Full control (including delete and member management)

### Actions

- **`CREATE`**, **`READ`**, **`UPDATE`**, **`DELETE`**, **`MANAGE_MEMBERS`**

### Permission Matrix

| Role | CREATE | READ | UPDATE | DELETE | MANAGE_MEMBERS |
| --- | --- | --- | --- | --- | --- |
| **VIEWER** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **EDITOR** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **OWNER** | ✅ | ✅ | ✅ | ✅ | ✅ |

### Permission Inheritance

**Downward inheritance:**

- Organization roles apply to all child offices and projects
- Office roles apply to all child projects
- Higher roles always take precedence

**Upward read access:**

- Members of child entities can read (but not edit) parent entities

**Example:**

```
Organization (Alice = Owner)
└── Office (Bob = Editor)
    └── Project (Charlie = Viewer)

Alice: Full control of org, office, and project
Bob: Full control of office and project, read-only for org
Charlie: Read-only for project, office, and org
```

Admin users (see `isAdmin()`) bypass entity permission checks.

## Usage

### Protect Hono routes

```typescript
import { Hono } from "hono";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";

// RBACContext gives typed access to user and permission context
const app = new Hono<RBACContext>();

// Auth middleware must set `user` in context first (done in apps/server)

app.get(
  "/organizations/:orgId",
  requirePermission(EntityType.ORGANIZATION, Action.READ, (c) =>
    c.req.param("orgId"),
  ),
  async (c) => {
    const user = c.get("user");
    const permissionResult = c.get("permissionResult"); // includes effective role
    return c.json({ data: "organization data" });
  },
);
```

All mutating endpoints (POST, PUT, PATCH, DELETE) must be RBAC-protected. See `examples/hono-protected-routes.ts` for full patterns.

#### Which Hono middleware

| Middleware | Use when |
| --- | --- |
| `requirePermission(entityType, action, getEntityId)` | The entity id is in the request (URL param, query string) and can be read synchronously |
| `requireEntityPermission(entityType, action, resolveEntityId)` | The entity id must be looked up first — e.g. resolving the owning project of a row keyed by its own id |
| `requireProjectReadOrPublicGov(getProjectId, { moduleName })` | Project READ route that citizens may also read when the project is public and government-owned |
| `requireEntityReadOrPublicGov(resolveProjectId, { moduleName })` | Same fallback, but the project id must be looked up first |
| `resolveProjectIdFromRow(table, idColumn, projectColumn, paramName)` | Builds the resolver for the two async guards: read the row id from a URL param, return the owning project id |

The two async guards answer an unresolvable id (missing param, no matching row) with the **same** 403 body as a permission denial — `{ error: "Forbidden", reason: "No permission found" }` — never a 400 or 404. A distinguishable response would turn the route into an existence oracle for row ids. Handlers behind these guards never reach their own "not found" branch.

### Check permissions in React

```tsx
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";

const { hasPermission, isChecking } = useEntityPermission({
  userId: session?.user?.id,
  entityType: EntityType.ORGANIZATION,
  entityId: orgId,
  action: Action.MANAGE_MEMBERS,
});
```

The hook calls `GET /api/permissions` — served by `permissionsRouter` from `/server`, mounted in `apps/server`.

### Check permissions on the server

```typescript
import { Action, EntityType, MemberRole } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";

const rbac = getRBACService(); // uses the shared DB connection by default

const result = await rbac.checkPermission(
  userId,
  entityId,
  EntityType.ORGANIZATION,
  Action.UPDATE,
);

if (result.allowed) {
  console.log(`User has ${result.effectiveRole} role`);
}
```

### Manage memberships

Membership operations live directly on `RBACService`:

```typescript
const rbac = getRBACService();

await rbac.addMembership(userId, orgId, EntityType.ORGANIZATION, MemberRole.EDITOR);
await rbac.updateMembershipRole(userId, orgId, EntityType.ORGANIZATION, MemberRole.OWNER);
await rbac.removeMembership(userId, orgId, EntityType.ORGANIZATION);

const members = await rbac.getEntityMembers(orgId, EntityType.ORGANIZATION);
const memberships = await rbac.getUserMemberships(userId);

// Guard against removing/demoting the last owner (call inside a transaction)
await rbac.ensureNotLastOwner(userId, orgId, EntityType.ORGANIZATION);
```

Hierarchy helpers: `getAncestors()`, `getAncestorsBatch()`, `getEffectiveRole()`.

See `MEMBERSHIP_GUIDE.md` for membership rules in depth.

## Database Schema

There is no dedicated RBAC table. The system reads the workspace tables from `@wildfires-org/turboplan-db`:

- **Hierarchy** is derived from foreign keys: `office.organizationId` and `project.officeId`
- **Memberships** live in `organization_users`, `office_users`, and `project_users`, each with a unified `role` column (`owner` | `editor` | `viewer`)

## Error Responses

The Hono middleware returns standardized responses:

- **401 Unauthorized** – No authenticated user
- **400 Bad Request** – Entity ID not found in request (sync guards only)
- **403 Forbidden** – User lacks the required permission, or an async guard could not resolve the entity id (`reason: "No permission found"`)
- **500 Internal Server Error** – Permission check threw

## TypeScript Types

```typescript
import type {
  ActionType, // 'create' | 'read' | 'update' | 'delete' | 'manage_members'
  EntityTypeType, // 'organization' | 'office' | 'project'
  MemberRoleType, // 'owner' | 'editor' | 'viewer'
  PermissionCheckResult, // { allowed: boolean, effectiveRole?: string, reason?: string }
} from "@wildfires-org/turboplan-rbac";
```

## Examples

- `examples/hono-protected-routes.ts` – Hono API examples (canonical pattern)
- `examples/nextjs-protected-routes.ts` – Next.js App Router examples (legacy routes only)
