# Membership & RBAC System Guide

## Overview

The RBAC system provides entity-based role management with permission inheritance and role precedence.

## Roles

- **owner**: Full access to everything within the entity and its children + can manage members
- **editor**: Can create, read, and update within the entity
- **viewer**: Read-only access

## Membership Rules

### Permission Inheritance (Downward)

- Organization roles apply to all child offices and projects
- Office roles apply to all child projects
- Higher roles always take precedence (owner > editor > viewer)

### Upward Read Access

- Users with any role in a project can read (but not edit) the parent office and organization
- Users with any role in an office can read (but not edit) the parent organization

## Usage Examples

### API Route Protection (Hono)

```typescript
import { EntityType, Action } from "@wildfires-org/turboplan-rbac";
import { requirePermission } from "@wildfires-org/turboplan-rbac/hono";

app.get(
  "/organizations/:orgId",
  requirePermission(EntityType.ORGANIZATION, Action.READ, (c) =>
    c.req.param("orgId")
  ),
  async (c) => {
    // Your route handler
  }
);
```

### Direct Permission Check

```typescript
import { EntityType, Action } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";

const result = await getRBACService().checkPermission(
  userId,
  entityId,
  EntityType.PROJECT,
  Action.UPDATE
);

if (result.allowed) {
  // User has permission
}
```

### Managing Members

```typescript
import { EntityType, MemberRole } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";

const rbac = getRBACService();

// Add member
await rbac.addMembership(
  "user-123",
  "org-456",
  EntityType.ORGANIZATION,
  MemberRole.EDITOR
);

// Update role
await rbac.updateMembershipRole(
  "user-123",
  "org-456",
  EntityType.ORGANIZATION,
  MemberRole.OWNER
);

// Remove member
await rbac.removeMembership("user-123", "org-456", EntityType.ORGANIZATION);
```

## Database Schema

The role enums are unified across all entities:

- Organization: owner, editor, viewer
- Office: owner, editor, viewer
- Project: owner, editor, viewer

Default role for new members is `viewer` (except projects which default to `editor`).
