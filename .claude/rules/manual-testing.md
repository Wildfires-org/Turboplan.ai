# Manual / Interactive Feature Testing

When asked to manually test a feature in the running app, drive the browser via the **Playwright MCP server** rather than clicking through by hand. Log in using a minted magic link — never wait for or read real emails.

## Workflow

1. **Start the dev stack** (if not already running):

   ```bash
   pnpm dev
   ```

   Wait for `turboplan:dev: ✓ Ready` on `http://localhost:3000`.

2. **Check for an existing session first** — before minting anything, navigate to `http://localhost:3000` with `mcp__playwright__browser_navigate` and take a `browser_snapshot`. If the page shows the authenticated app (sidebar, workspace, project list), skip steps 3 and 4 entirely — the browser already has a valid session cookie from a prior MCP run. Only continue to the magic-link flow if you land on `/login` or an unauthenticated marketing page.

3. **Mint a magic link** against the dev database:

   ```bash
   cd apps/turboplan && pnpm exec tsx --env-file=.env.local ../../e2e/scripts/mint-magic-link.ts
   ```

   The script (`e2e/scripts/mint-magic-link.ts`) prints JSON containing `user` and `magicLinkUrl`. The default email is `mcp-test@turboplan.test` — pass a custom email as the first arg only if a test needs a fresh user.

   Run it from `apps/turboplan`, not from `e2e`: `tsx` resolves from the web app's
   `node_modules` (the `e2e` package does not depend on it), and `--env-file=.env.local`
   points the script at the same database as the running dev server.

4. **Open the magic link in Playwright MCP**:

   ```
   mcp__playwright__browser_navigate(url: <magicLinkUrl>)
   ```

   First-time users land on `/setup/personal` (onboarding). Returning users land on the authenticated app and skip onboarding entirely — that is why we reuse the same test email across sessions.

5. **Drive the feature** with `mcp__playwright__browser_snapshot`, `_click`, `_fill_form`, etc. Prefer `browser_snapshot` over `browser_take_screenshot` — the accessibility tree is cheaper and more reliable for assertions.

6. **Close the browser** with `mcp__playwright__browser_close` when done.

## Standard Test Users

These are conventional addresses, not seeded fixtures — nothing in the repo
creates them ahead of time. The mint script creates the user on first use with a
personal organization and no `user_role` set, so the FIRST run for one of these
addresses still lands on `/setup/personal`. Reusing the same address afterwards
is what lets you skip onboarding, which is the point of keeping the list stable.

| Email | Role to select during onboarding (`user_role` enum) |
| --- | --- |
| `citizen-mcp@turboplan.test` | `citizen` |
| `gov-mcp@turboplan.test` | `environmental_planning` (government environmental planner) |
| `gov-worker-mcp@turboplan.test` | `government_agency` (government agency worker) |

Pass the email as the first arg to the magic-link script, e.g.:

```bash
cd apps/turboplan && pnpm exec tsx --env-file=.env.local ../../e2e/scripts/mint-magic-link.ts citizen-mcp@turboplan.test
```

Pick whichever role matches the feature under test. Only mint a brand-new email when you specifically need a clean onboarding run.

## Conventions

- Use fake domains like `@turboplan.test` or `@example.test` for test users. Never use real personal emails or real company domains.
- If onboarding state gets in the way of a test, mint a fresh user by passing a unique email (e.g. a timestamp suffix).
- For flows that require a workspace or project, reuse helpers in `e2e/utils/workspace-helpers.ts` rather than clicking through setup manually.
- If a manual test reveals a bug, write or extend a proper Playwright e2e test in `e2e/tests/` — don't rely on the manual MCP flow as a regression net.
