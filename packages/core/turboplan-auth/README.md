# @wildfires-org/turboplan-auth

Shared authentication utilities for the TurboPlan monorepo, built on NextAuth v5 with magic-link (email) sign-in.

## Exports

| Path | Contents |
| --- | --- |
| `.` | Types re-exported for convenience |
| `/server` | NextAuth building blocks: `authCallbacks`, `createMagicLinkProvider()`, `getCookieConfig()` (requires DB) |
| `/session` | Lightweight `getSession()` for Next.js server components — no DB dependency |
| `/client` | `SessionProvider`, `useSession()`, and re-exported `signIn` / `signOut` |
| `/hono` | `verifySessionCookie()` — session verification without any Next.js dependency |
| `/types` | `Session`, `SessionUser`, `AuthUser`, `JWTPayload`, `Profile` |

Pick the entry point by context:

- **Next.js app with full auth setup** → `/server` (callbacks fetch the user profile)
- **Next.js app that only reads the session** (e.g. landing page) → `/session`
- **Hono / Bun backends** → `/hono`

## Usage

### Server component

```tsx
import { getSession } from "@wildfires-org/turboplan-auth/session";

export default async function Page() {
  const session = await getSession();
  if (!session) {
    return <p>Not logged in</p>;
  }
  return <p>Welcome, {session.user.email}</p>;
}
```

### Client components

```tsx
// layout.tsx (server component)
import { SessionProvider } from "@wildfires-org/turboplan-auth/client";
import { getSession } from "@wildfires-org/turboplan-auth/session";

// wrap children with <SessionProvider session={await getSession()}>

// any client component
import { useSession } from "@wildfires-org/turboplan-auth/client";

const session = useSession();
```

### Hono server

```typescript
import { verifySessionCookie } from "@wildfires-org/turboplan-auth/hono";

const session = await verifySessionCookie(cookieValue); // Session | null
```

## Notes

- The session cookie is configured for cross-domain sharing via `getCookieConfig()`; the cookie name/domain come from `@wildfires-org/turboplan-env`.
- `next` and `next-auth` are peer dependencies — only needed by consumers using the Next.js entry points.
