---
description: End-to-end testing with Playwright
globs:
  - e2e/**/*.ts
alwaysApply: false
---

# Testing

## E2E Tests

End-to-end tests live in the `e2e/` folder and use Playwright.

## Running Tests

- `pnpm e2e:test` – Run all E2E tests
- `pnpm e2e:debug` – Run tests in debug mode
- `pnpm e2e:ui` – Open Playwright UI
- `pnpm e2e:headed` – Run tests in headed browser

## Test Structure

- `e2e/tests/` – Test files
- `e2e/pages/` – Page object models
- `e2e/config/` – Test configuration and credentials
- `e2e/utils/` – Test utilities

## Writing Tests

Write tests for new features. Tests run automatically in CI before deployment.

See existing tests in `e2e/tests/` for patterns and conventions.

## Test Data

Test credentials and data are configured in `e2e/config/`. Do not hardcode credentials in test files.
