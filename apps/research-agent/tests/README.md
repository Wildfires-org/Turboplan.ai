# research-agent tests

This directory contains all tests for `research-agent` (Vitest).

## Test profiles

- `pnpm test` – API lifecycle tests (`tests/vitest.config.ts` includes only `tests/e2e/`; same suite as `test:e2e`)
- `pnpm test:unit` – fast unit contracts for handlers, engine store, and HTTP contracts (`tests/unit/`)
- `pnpm test:e2e` – deterministic API lifecycle tests with an in-memory repository (`tests/e2e/`)
- `pnpm test:watch` – watch mode for the same suite as `pnpm test`

No extra environment variables are required; the test env values come from `tests/helpers/test-app.ts`, and `tests/helpers/setup.ts` resets `process.env` between tests.

## Layout

- `tests/unit/` – domain rules and API contracts
- `tests/e2e/` – HTTP lifecycle tests against the real router
- `tests/contracts/` – test fakes for external boundaries (`in-memory-run-repository`, `scripted-runner`)
- `tests/helpers/` – shared setup, test app factory, wait utilities

## Waiting strategy

Use `tests/helpers/wait-for-terminal.ts` as the single source of truth for status polling:

- `waitForTerminalStatus(app, runId, { timeoutMs, intervalMs })`

## Business-first testing rules

- Keep tests minimal and focused on business-critical outcomes.
- Use real production classes where possible (`RunManager`, `RunEngine`, `RunEngineStore`, handlers/router).
- Mock only external boundaries (runner, repository, external APIs) via the fakes in `tests/contracts/` — do not create clone-mocks of internal business logic.
