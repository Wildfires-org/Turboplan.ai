---
name: e2e-feature-flag-pages
description: Known app gaps the smoke specs mark test.fail — signing/project-context pages render while their package is off; middleware never redirects signed-out visitors
metadata:
  type: project
---

In `e2e/.env` billing, signing and project context packages are OFF. The Hono server mounts their routers only when enabled. `/[org]/billing` and `/[org]/context` call `notFound()` when off, but `/[org]/my-signatures`, `/[project]/signing` and `/[project]/context` still render and 404 against the unmounted API (found 2026-10-29, marked `test.fail` in `e2e/tests/smoke/gov-routes.spec.ts`).

**Why:** a smoke test that expects "no console errors" fails on these pages for a flag reason, not a regression.

**How to apply:** read flags in specs from `process.env` (`NEXT_PUBLIC_IS_<NAME>_PACKAGE_ENABLED` or `IS_<NAME>_PACKAGE_ENABLED`). Make `test.fail` conditional on the flag being off so the test turns green if the package is enabled or the bug is fixed. Related: [[e2e-console-noise]].

Fixed 2026-10-30: `authorized()` in `app/(auth)/auth.config.ts` now returns a login redirect `Response` instead of `false`. next-auth v5 ignores `false` when middleware.ts passes its own handler to `auth()`, so a bare `false` never redirected. The middleware leaves `/api`, `/monitoring`, `/invite` and static files alone.
