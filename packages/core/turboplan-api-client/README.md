# @wildfires-org/turboplan-api-client

Authenticated API client and utilities for communicating with the TurboPlan Hono server.

## Exports

| Path | Contents |
| --- | --- |
| `.` | `ApiClient`, SWR fetchers, JWT utilities, PAT utilities, `publicFetcher` |
| `/server` | `optionalAuthMiddleware` (Hono) and the `AuthContext` type |

## SWR Fetchers (preferred)

Data fetching in client components should use SWR with these shared fetchers — they handle authentication and error throwing:

```typescript
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { fetcher, postFetcher } from "@wildfires-org/turboplan-api-client";

// Query
const { data, error, isLoading } = useSWR("/api/projects", fetcher);

// Mutation (also: putFetcher, patchFetcher, deleteFetcher)
const { trigger, isMutating } = useSWRMutation("/api/projects", postFetcher);
await trigger({ name: "New Project" });
```

`publicFetcher` is the unauthenticated variant for public endpoints.

## ApiClient

Lower-level authenticated client for the Hono server. Handles token refresh internally and returns a structured result instead of throwing:

```typescript
import { ApiClient } from "@wildfires-org/turboplan-api-client";

const client = new ApiClient(); // base URL resolved from env (getServerUrl)
const { data, error, code, status } = await client.get<Project[]>("/api/projects");
```

Use it only when the SWR fetchers don't fit.

## JWT Utilities

`createToken()`, `createUploadToken()`, `verifyToken()`, `extractTokenFromHeader()` — signing and verification of the short-lived JWTs used between the Next.js app and the Hono server (via `jose`).

## Personal Access Tokens

`generatePAT()`, `hashPAT()`, `isPATToken()` — `tc_pat_`-prefixed tokens used by the MCP server. Only the hash is stored in the database.

## Hono Middleware

```typescript
import { optionalAuthMiddleware } from "@wildfires-org/turboplan-api-client/server";
```

Sets the `user` context variable when a valid bearer token is present but does not require authentication — for public routes with optional user-specific content.
