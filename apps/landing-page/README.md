# TurboPlan Landing Page

Marketing and public-facing site for TurboPlan — a Next.js 15 (App Router) app with Tailwind CSS and shadcn/ui components. Includes the home page, public project catalog, contact page, and documentation.

## Running Locally

```bash
# From the monorepo root
pnpm install
pnpm build:packages

cp apps/landing-page/.env.example apps/landing-page/.env.local
# Fill in values (see below)

# Start the dev server (port 3002)
pnpm --filter turboplan-landing-page dev
```

Open [http://localhost:3002](http://localhost:3002).

## Environment Variables

See `.env.example` for the full annotated list.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_NAME` | Display name used in metadata and UI |
| `NEXT_PUBLIC_TURBOPLAN_URL` | Main web app URL (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_SERVER_URL` | API server URL (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_LINKEDIN_URL` | LinkedIn company link in the footer |
| `NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED` | Toggles the pricing/checkout view |
| `AUTH_SECRET` | Must match the web app's secret — enables session awareness |
| `AUTH_COOKIE_DOMAIN` | Optional cookie domain for cross-app session sharing |

## Structure

- `src/app/` – App Router pages (`/`, `/catalog`, `/contact`, `/docs`)
- `src/components/` – UI components (import directly, no barrel exports)
- `src/handlers/` – API client functions
- Path alias: `@/*` → `./src/*`

## Testing and Checks

```bash
pnpm --filter turboplan-landing-page test        # Jest unit tests
pnpm --filter turboplan-landing-page e2e         # Playwright tests (app-local, in e2e/)
pnpm --filter turboplan-landing-page typecheck
```

## Build and Deploy

```bash
pnpm --filter turboplan-landing-page build
```

Deploys to Cloudflare Workers via OpenNext (`open-next.config.ts`, `wrangler.jsonc`). See `scripts/deploy-landing.sh` at the repo root.
