---
name: landing-browser-verification
description: Gotchas when verifying landing-page (port 3002) layout via the Browser pane with DOM measurements, esp. when the pane is hidden
metadata:
  type: feedback
---

When the Browser pane is hidden, screenshots/scroll fail and React's streamed Suspense reveal
(`<div hidden id="S:0">`) can stall, so `main` measures 0x0 for 10-40s after navigation. Poll
until `main .glass-card` has a non-zero rect instead of a fixed sleep; a second hidden copy of the
page in `body > div[hidden]` is streaming residue, not duplicated rendering.

Measured px on the landing page are ~0.9375x of Tailwind values (e.g. 1200px container reads 1125,
px-4 reads 15) because of the UI-scale setting — not a layout bug.

**Why:** cost a lot of retries during the 2026-09 glass restyle of detail/checkout/404 pages.
**How to apply:** any landing-page visual verification via mcp__Claude_Browser__* — check overflow
with scrollWidth vs clientWidth and per-element rects, and state explicitly that it was DOM-only.
