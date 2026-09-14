# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Wildfires.org Open landing page - a Next.js 15 application with App Router. It serves as the marketing/public-facing site for TurboPlan and includes pages for home, contact, user guide, and a catalog section.

Part of a monorepo under `apps/landing-page`. Uses a shared env package: `@wildfires-org/turboplan-env`.

## Commands

```bash
pnpm dev          # Start dev server on port 3002
pnpm build        # Production build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript type checking
pnpm format       # Format with Prettier
pnpm check-format # Check formatting
pnpm test         # Jest unit tests
pnpm e2e          # Playwright E2E tests
```

## Architecture

### Tech Stack

- Next.js 15 with App Router
- React 19
- Tailwind CSS with shadcn/ui components
- SWR for data fetching
- Zod for validation
- react-hook-form for forms

### Path Aliases

`@/*` maps to `./src/*`

### Directory Structure

**`src/app/`** - Next.js App Router pages

- `/` - Home page with hero, partners, planning docs, project tracking sections
- `/projects` - Project catalog with agencies, templates, and projects
- `/contact` - Contact form
- `/docs` - Documentation site (Fumadocs)

**`src/components/`**

- `ui/` - shadcn/ui base components (button, dialog, form, toast, etc.)
- `home/` - Home page sections (hero, carousel, partners, etc.)
- `catalog/` - Catalog page components
- `shared/` - Reusable form inputs and analytics components
- `icons/` - SVG icon components
- `top-bar/` - Navigation header components
- `footer/` - Site footer
- `dialogs/` - Modal dialog components

**Note:** Do not use barrel exports (index.ts re-exports). Import components directly from their files.

**`src/context/`** - React contexts

- `global.tsx` - Global app state (auto-scroll control)

**`src/handlers/`** - API client functions using `@wildfires-org/turboplan-env`

**`src/hooks/`** - Custom React hooks (analytics, breakpoints, scroll behavior)

**`src/lib/`** - Utilities

- `utils.ts` - `cn()` for Tailwind class merging, `fetcher()` for SWR

### Styling Conventions

This app is on **Tailwind v4** (CSS-first configuration). Theme tokens — brand
colors, semantic colors, custom spacing — are defined via `@theme` in
`src/globals.css`, which is the source of truth. A reduced hybrid
`tailwind.config.ts` remains only for a few JS-computed tokens; do not treat it
as the primary theme definition.

Layout constants in `src/consts/layout.ts` define header heights (88px mobile/desktop).

Font: Geist (local font with all weights from 100-900).

### Component Patterns

- UI components use `cva` (class-variance-authority) for variant styling
- Form inputs are wrapped in `Labeled*` components (`src/components/shared/`)
- Use `cn()` from `@wildfires-org/turboplan-utils` for conditional class merging

### Environment Variables

See `.env.example` (copy it to `.env.local`) and `CONFIGURATION.md` at the repo root. Key variables:

- `NEXT_PUBLIC_TURBOPLAN_URL` - Main TurboPlan app URL
- `NEXT_PUBLIC_SERVER_URL` - Backend API URL
- `NEXT_PUBLIC_CATALOG_BASE_URL` - Base URL for E2E tests
