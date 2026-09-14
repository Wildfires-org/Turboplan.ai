# E2E Tests

Cross-app end-to-end tests using Playwright.

## Quick Start

```bash
# Run all tests (CI-style)
pnpm e2e

# Interactive UI mode (local development)
pnpm e2e:ui
```

## Scripts Reference

All scripts run from **monorepo root**.

| Script         | Purpose                                  | Use Case                              |
| -------------- | ---------------------------------------- | ------------------------------------- |
| `e2e`          | Full cycle: setup → test → teardown      | CI pipelines                          |
| `e2e:ui`       | Setup + Playwright UI                    | Local dev, writing/debugging tests    |
| `e2e:headed`   | Setup + visible browser + teardown       | Quick visual verification             |
| `e2e:debug`    | Setup + Playwright inspector + teardown  | Step-through debugging                |
| `e2e:setup`    | Start all app servers                    | Manual server management              |
| `e2e:teardown` | Stop all servers                         | Cleanup after `e2e:ui` or `e2e:setup` |
| `e2e:test`     | Run tests only (assumes servers running) | Re-run tests without restart          |

## Local Development

```bash
# Start UI mode - best for writing tests
pnpm e2e:ui

# When done, stop servers manually
pnpm e2e:teardown
```

## CI

```bash
pnpm e2e
```

Runs headless tests with automatic server lifecycle.

## Directory Structure

```
e2e/
├── tests/           # Test specs
├── pages/           # Page Object Models
├── config/          # Test credentials, patterns, and constants
├── utils/           # Test utilities (workspace helpers, etc.)
├── scripts/         # Helper scripts (e.g. mint-magic-link.ts for dev logins)
├── logs/            # Server logs (gitignored)
├── storage/         # Auth state storage
└── reports/         # Test reports
```

## Environment

Tests load env from `e2e/.env` — copy `e2e/.env.example` and fill in the values. `check-env.sh` validates required variables in CI.

### Email Testing

To run email tests, you need Ethereal credentials:

1. Create a test account at https://ethereal.email/create
2. Add to `e2e/.env`:
   ```
   ETHEREAL_USER=your-ethereal-username
   ETHEREAL_PASS=your-ethereal-password
   ```

Both the test runner AND the server need these credentials - tests use them to read emails from Ethereal's inbox, and the server uses them to send emails through Ethereal's SMTP.

If not set, email tests will be skipped automatically.

## Database Management

The test database is **automatically cleared** before and after the full test suite:

- **Before tests**: Drops all tables to ensure `db:push` runs without schema conflicts
- **After tests**: Cleans up test data

### Skip Database Clearing

For debugging purposes, you can disable database clearing:

```bash
# Skip clearing to preserve test data between runs
E2E_SKIP_DB_CLEAR=true pnpm e2e

# Or in your e2e/.env file
E2E_SKIP_DB_CLEAR=true
```

This is useful when:
- Debugging a failing test and want to inspect database state
- Running tests repeatedly without waiting for migrations
- Developing new tests against existing data
