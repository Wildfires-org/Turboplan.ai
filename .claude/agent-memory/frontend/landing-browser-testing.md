---
name: landing-browser-testing
description: Quirks when measuring the landing page (localhost:3002) in the Claude Browser pane — hidden streamed tree, duplicate IDs, stale screenshots, body zoom
metadata:
  type: project
---

Measuring the landing page in the Browser pane (verified 2026-09-24):

- After `navigate`, the page body stays in a hidden streaming `<div>` (zero-size rects) until the pane paints — take a tiny screenshot (or `tabs_select`) first, then poll for a non-zero element.
- In dev there can be TWO copies of the home tree (one `display:none`), so `getElementById('showcase-tab-N')` may hit the hidden copy. Pick the visible `[role=tablist]` and query inside it.
- Screenshots are often one frame stale; take a throwaway small screenshot before the real one. `zoom` region crop is unsupported.
- `html` has `scroll-smooth`: use `scrollTo({top, behavior:'instant'})` before measuring.
- Body is zoomed by `--ui-scale` (0.9375): rendered px = CSS px x 0.9375, and viewport units inside need `/ var(--ui-scale)` (see globals.css).

**Why:** these cost several wasted rounds of zero-height / wrong-element measurements.
**How to apply:** any JS layout measurement or screenshot check of the landing page.
