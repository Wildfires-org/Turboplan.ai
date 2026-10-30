---
name: dist-typecheck-gotcha
description: turboplan app typecheck reads workspace packages' types from dist; rebuild changed packages with tsdown --no-clean before tsc
metadata:
  type: project
---

`apps/turboplan` resolves `@wildfires-org/turboplan-db`, `-workspace` etc. through their `dist/*.d.ts` exports, so a type change in a package is invisible to `pnpm --filter turboplan typecheck` until that package is rebuilt. Unit tests (tsx + module mocks) do not need the rebuild.

**Why:** stale dist gives false typecheck errors/passes; parallel agents often share the checkout, and plain `pnpm build` (tsdown clean) wipes dist under their running processes.

**How to apply:** after editing a package that the app imports, run `pnpm exec tsdown --no-clean` in that package dir, then typecheck the app. Related: createDocument reference letterhead flow [[reference-letterhead-research-source]].
