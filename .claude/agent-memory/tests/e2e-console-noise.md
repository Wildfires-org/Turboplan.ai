---
name: e2e-console-noise
description: Which browser console errors in TurboPlan e2e runs are harmless noise vs real, and how to collect them without false positives
metadata:
  type: project
---

Console-error assertions in e2e specs hit two harmless sources:

- A server `redirect()` inside the `(dashboard)` route group (e.g. `/my-submissions` for non-citizens, `/[project]/chat`, `/[project]/overview`) cancels the sidebar's in-flight API calls; the api-client logs `API request error: TypeError: Failed to fetch` / `Error fetching offices: Error: Failed to fetch`. Explained in `apps/turboplan/app/page.tsx`.
- Re-using one `page` across `goto`s attributes the previous page's aborted fetches to the next URL. Use a fresh page (or a new page after a magic-link sign-in) for each checked navigation.

**Why:** both look like real failures and cost a debugging round in the route smoke work (2026-10-29).

**How to apply:** allowlist the redirect noise only per redirecting route (see `ABORTED_BY_DASHBOARD_REDIRECT` in `e2e/tests/smoke/route-health.ts`); never globally. A "Failed to load resource 404" usually means a page of a disabled feature package called an unmounted API router (signing, project context) — see [[e2e-feature-flag-pages]].
