---
name: e2e-parallel-agents
description: Running e2e specs while other agents share the same servers/DB - output dir, DB clear flag, data isolation tricks
metadata:
  type: feedback
---

When several agents run Playwright against the same running servers and DB:

- Always pass `E2E_SKIP_DB_CLEAR=true` (global teardown otherwise wipes the shared DB). Global setup still runs migrations even with `--no-deps`; noisy PostgresError lines from concurrent migrations are harmless.
- Pass `--output=<scratchpad>/pw-results`: the default `e2e/test-results/` is wiped by other agents' runs, so error-context files vanish.
- Isolate data instead of searching shared lists: for the gov user, `createTestOrganization` (BUSINESS org) + `createOffice` gives an empty office per test. Do NOT create extra non-government orgs for the citizen user: `getTestUserOrganization` picks the first non-government org and could return yours instead of the personal org.
- Shared paginated lists (submissions) need a unique run-id search term; avoid status words (New/Approved/Rejected) in fixture names when asserting badges with toContainText.
- `fullyParallel: true` means `beforeAll` runs once per worker; module-level random ids differ per worker, which is fine.

**Why:** learned 2026-10-29 while writing tests/office-features alongside 3 other agents.
**How to apply:** any e2e run in a multi-agent session; see [[e2e-app-quirks]].
