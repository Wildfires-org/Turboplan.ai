---
name: turboplan-glass-gotchas
description: Non-obvious traps hit while restyling turboplan project views (module package CSS not shipped, feature-flag hydration, package rebuilds, pane measurement)
metadata:
  type: project
---

Learned 2026-09-24 while restyling the project view (`/projects/[projectSlug]/*`) to the glass system:

- **Module packages' own .css is NOT shipped**: tsdown extracts e.g. `turboplan-map/.../map-styles.css` to a hashed dist file that no chunk imports. Global overrides (Leaflet zoom/popup glass) must live in `apps/turboplan/app/globals.css`.
- **Feature flags differ server vs client** (`isSigningPackageEnabled` etc.), so SSR-rendering `SidebarProjectContent` caused a Radix useId hydration mismatch in NavUser. The sidebar's project-nav fallback is client-only (`useIsClient`).
- **Rebuilding packages**: tsdown packages → `pnpm exec tsdown --no-clean`; `turboplan-gantt-task` uses Vite → `pnpm exec vite build --emptyOutDir false`. Apps consume `dist/`, so any package edit needs a rebuild before the browser shows it.
- **Next dev ChunkLoadError / "reading 'call'"** right after edits is recompile churn (ERR_INCOMPLETE_CHUNKED_ENCODING); reload before debugging.
- **Browser pane**: the app resets the emulated viewport often — put `resize_window` at the start of every batch. `layout-shift` entries are only recorded while the pane is displayed; buffered PerformanceObserver after a hard load gives CLS. In dev, client nav between project sub-routes doesn't show `loading.tsx` (no prefetch), so measure loading states via hard loads.
- Turboplan body is zoomed like the landing (measured px ≈ 0.9375 × CSS px).

**Why:** each cost several rounds. **How to apply:** any turboplan restyle touching module packages, sidebar, or loading-state verification.
