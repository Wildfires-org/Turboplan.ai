---
description: Client-side data fetching with SWR and the API client
globs:
  - apps/turboplan/**/*.tsx
  - apps/turboplan/**/*.ts
  - apps/landing-page/**/*.tsx
  - packages/**/client.ts
  - packages/**/*.tsx
alwaysApply: false
---

# Data Fetching

Always prefer SWR with the shared fetchers from `@wildfires-org/turboplan-api-client`. The shared fetchers already handle authentication and error throwing. Avoid manual `useState` for loading/error/success — SWR provides these for free. Only fall back to using `ApiClient` directly or writing inline fetchers if there's no clean way to use the shared ones.

## Queries (useSWR)

```typescript
import useSWR from "swr";
import { fetcher } from "@wildfires-org/turboplan-api-client";

const { data, error, isLoading } = useSWR("/api/projects", fetcher);
```

## Mutations (useSWRMutation)

Use `postFetcher`, `putFetcher`, or `deleteFetcher`:

```typescript
import useSWRMutation from "swr/mutation";
import { postFetcher } from "@wildfires-org/turboplan-api-client";

const { trigger, isMutating, data } = useSWRMutation(
  "/api/projects",
  postFetcher<Project>,
);

// In a handler:
await trigger({ name: "New Project" });
```

## Data Fetching Location

- **Client Components**: Use SWR for data that needs real-time updates or user interaction
- **Server Components**: Fetch data on the server and pass as props for static or initial data

## Cache Invalidation

Use SWR's `mutate` function to invalidate and refetch data after mutations. See existing hooks in `apps/turboplan/hooks/` for patterns.
