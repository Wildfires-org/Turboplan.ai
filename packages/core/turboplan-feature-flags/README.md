# @wildfires-org/turboplan-feature-flags

A lightweight feature flags system that controls which optional TurboPlan packages are loaded.

## Overview

Simple env-driven boolean flags, evaluated at runtime:

- **Package-level granularity** – Flags enable/disable entire packages, not individual features
- **Dynamic imports** – Optional packages are only loaded when their flag is enabled
- **No external services** – Just environment variables

## Available Flags

Each flag reads two environment variables — `NEXT_PUBLIC_IS_*` (for Next.js client-side usage) or the plain `IS_*` variant (server-side). A flag is enabled if either is set to `true`. **All flags default to `false` when unset.**

| Package key | Environment variable | Helper |
| --- | --- | --- |
| `tasks` | `IS_TASKS_PACKAGE_ENABLED` | `isTasksPackageEnabled()` |
| `map` | `IS_MAPS_PACKAGE_ENABLED` | `isMapPackageEnabled()` |
| `documents` | `IS_DOCUMENTS_PACKAGE_ENABLED` | `isDocumentsPackageEnabled()` |
| `fields` | `IS_FIELDS_PACKAGE_ENABLED` | `isFieldsPackageEnabled()` |
| `researchAgent` | `IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED` | `isResearchAgentPackageEnabled()` |
| `timelineRecords` | `IS_TIMELINE_RECORDS_PACKAGE_ENABLED` | `isTimelineRecordsPackageEnabled()` |
| `projectContext` | `IS_PROJECT_CONTEXT_PACKAGE_ENABLED` | `isProjectContextPackageEnabled()` |
| `signing` | `IS_SIGNING_PACKAGE_ENABLED` | `isSigningPackageEnabled()` |
| `billing` | `IS_BILLING_PACKAGE_ENABLED` | `isBillingPackageEnabled()` |

There is also a generic `isPackageEnabled(packageName)` that throws on unknown package names.

## Setup

Add the dependency:

```json
{
  "dependencies": {
    "@wildfires-org/turboplan-feature-flags": "workspace:*"
  }
}
```

Configure flags in your app's `.env.local` (use the `NEXT_PUBLIC_` prefix for anything read in client components):

```bash
NEXT_PUBLIC_IS_TASKS_PACKAGE_ENABLED=true
NEXT_PUBLIC_IS_FIELDS_PACKAGE_ENABLED=true
NEXT_PUBLIC_IS_MAPS_PACKAGE_ENABLED=false
```

For hosted deployments, set the same variables in your platform's project settings per environment.

## Usage

### Client-side (React components)

Use `React.lazy` to load flagged components only when enabled:

```tsx
import { isMapPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import { lazy, Suspense } from "react";

const MapComponent = lazy(() =>
  import("@wildfires-org/turboplan-map/client").then((m) => ({
    default: m.SimpleMap,
  })),
);

export function TaskDetail() {
  return (
    <div>
      {isMapPackageEnabled() && (
        <Suspense fallback={<div>Loading map...</div>}>
          <MapComponent />
        </Suspense>
      )}
    </div>
  );
}
```

See [examples/client-component-example.tsx](./examples/client-component-example.tsx).

### Server-side

Use dynamic imports so disabled packages are never loaded:

```typescript
import { isMapPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

export const getTaskById = async (taskId: string) => {
  const task = await getTask(taskId);

  if (isMapPackageEnabled() && task.mapLayerId) {
    const { someMapRelatedFunction } = await import(
      "@wildfires-org/turboplan-map/server"
    );
    return { ...task, mapData: await someMapRelatedFunction() };
  }

  return task;
};
```

See [examples/server-api-example.ts](./examples/server-api-example.ts).
