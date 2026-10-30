---
name: e2e-shared-workspace-pitfalls
description: Hazards when e2e specs touch the shared citizen/gov workspaces, plus environment quirks (feature flags, timeouts, test-results) seen while writing workspace specs
metadata:
  type: project
---

Shared-state hazards in `e2e/` (verified 2026-10-29):

- `getTestOffice(orgId)` returns the NEWEST office (`createdAt desc, limit 1`), and `/` redirects to the newest office too. Creating offices in the shared citizen/gov orgs changes what `getCitizenWorkspace()`/`getGovWorkspace()` resolve for other specs. Create a fresh org instead: `createTestOrganization({ ownerId: gov.userId })` (BUSINESS type; `getTestGovernmentOrganization` only picks GOVERNMENT orgs, so gov stays stable).
- Do not add the citizen user to new BUSINESS orgs: `getTestUserOrganization` picks the first non-government org, so it can drift. Use a fresh user (`createNamedTestUser` + `createTestUserWithMagicLink`, then open the link with `&redirectTo=/path` to skip onboarding).
- `createOffice()` makes the creator a DIRECT office owner, so they show as a direct member, not inherited.
- Never sign out or edit the profile of the shared users; use a fresh user.

**Why:** Several agents and specs run in parallel against one remote Neon DB.

**How to apply:**
- E2E `.env` sets `NEXT_PUBLIC_IS_PROJECT_CONTEXT_PACKAGE_ENABLED=false`, so `/:org/context` renders the 404 page (HTTP 200 because of streaming). Gate on `isEnvValueTruthy` from `@wildfires-org/turboplan-env`.
- Remote DB is slow under load: org settings save sometimes takes more than 10s. Use about 20s waits and `test.describe.configure({ timeout: 60000 })` for multi-reload tests. `test.fail()` does not accept a TIMEOUT, so make expected-fail tests fail fast on an assertion.
- Pass `--output=<scratchpad>` when running in parallel with others, because they wipe the shared `test-results/`.
- `e2e/tsconfig` has no DOM lib, so `page.evaluate(() => document...)` fails typecheck. Assert with locators or attributes instead.

Known app bugs (marked `test.fail()` in `tests/workspace/`): cleared profile fields and a cleared org short name are not saved (`|| undefined` passed to Drizzle) (the `/profile` signed-out redirect was fixed 2026-10-30).
