---
name: glass-system-location
description: The turboplan app is being restyled page by page to the landing page's glassmorphism ("Mist") system; where each layer lives
metadata:
  type: project
---

The web app is moving, page by page, to the landing page's glass ("Mist")
style (started 2026-09-24 with the office page, branch feat/glassmorphism-restyle).

**Why:** landing (Tailwind v4, `@utility`) and turboplan (Tailwind v3,
`@layer utilities`) can't share one CSS file, so the system is split:
- Values of record: `apps/landing-page/src/globals.css`.
- turboplan copy of tokens + `glass`/`glass-card`/`glass-inset`/`btn-primary`/`press`: `apps/turboplan/app/globals.css`.
- App recipes (page title, sticky toolbar, chips, skeleton bar, card link): `apps/turboplan/lib/glass.ts` (lib/ was added to Tailwind content globs for this).
- Shared primitives (Dialog, AlertDialog, Input, Textarea, Select, DropdownMenu, Popover, Button `brand`/`glass` variants) use plain-Tailwind constants from `packages/core/turboplan-utils/src/components/ui/glass-classes.ts`, so they compile in both apps and twMerge resolves overrides.

**How to apply:** when restyling the next page, reuse those constants and the
Button `brand`/`glass` variants instead of new one-off classes; keep loading
states built from the same shells (see `office-page-frame.tsx`,
`office-route-loading.tsx`) so they don't shift layout.
