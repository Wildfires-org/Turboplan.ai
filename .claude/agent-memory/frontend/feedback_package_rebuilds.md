---
name: package-rebuilds-while-dev-running
description: Rebuild workspace packages with `tsdown --no-clean` while dev servers run; a plain build crashes the API server
metadata:
  type: feedback
---

When the dev stack is running, rebuild edited packages with
`pnpm --filter <pkg> exec tsdown --no-clean` (what their `dev` script uses),
not `pnpm --filter <pkg> build`.

**Why:** the plain build cleans `dist/` first; the Hono API (`bun run --hot`)
re-imports mid-build, hits ENOENT on `dist/server.js` and exits with code 1
(happened 2026-09-24 during the glass restyle). Nothing runs a package watcher,
so consumers only see package edits after a rebuild.

**How to apply:** any edit under `packages/*/*/src` that the running apps must
pick up. If :3001 refuses connections after a rebuild, restart the `server`
entry from `.claude/launch.json` and tell the user. The same rebuild is needed
before `pnpm --filter turboplan typecheck` picks up a package API change: every
package's `exports` point at `dist/*.d.ts`, so the app typechecks against the
last build, not `src`.
