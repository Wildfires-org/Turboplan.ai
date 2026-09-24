---
name: fumadocs-docs-theming
description: How /docs (Fumadocs 15.8) is themed to the site's Mist glass system, and the non-obvious traps (ui-scale zoom, fixed chrome, client-module constants)
metadata:
  type: project
---

/docs is restyled to the glass "Mist" system (2026-09-24). Chrome lives in `src/components/docs/*`; tokens + id/data-attr overrides in `src/styles/fumadocs.css` (imported by globals.css right after the fumadocs imports).

Non-obvious constraints:
- Body children are zoomed by `--ui-scale` (0.9375). Any `100vh` inside must be `100vh/var(--ui-scale)`; measured px are ~0.94x the CSS px.
- Fumadocs' default sidebar/TOC are `position: fixed` (overlap floating navbar + footer). We make the layout a grid and the columns sticky; their max-height is capped by `--docs-chrome-max-h` (footer + padding clearance) or a sticky box gets pushed up under the navbar at page end.
- Fumadocs merges passed classNames with tailwind-merge, so `className` props replace stock classes; inline styles need `!` utilities.
- MDX content imports `Card`/`Cards` directly, so the components map can't override them — CSS only.
- Don't export constants from a `"use client"` file for server components (they become client references) — use `docs-classes.ts`.
- `--font-heading` is `@theme inline` (no runtime var); plain CSS must use `var(--font-geist)`.

**Why:** these caused real bugs during the restyle. **How to apply:** check these first when touching /docs layout or styles.
