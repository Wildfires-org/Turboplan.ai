# Contributing to TurboPlan

Thank you for your interest in contributing to TurboPlan! This document provides guidelines and instructions for contributing to this project.

## Development Environment

### Prerequisites

- Node.js 22.0.0 or higher
- pnpm 10 (`corepack enable` or `npm i -g pnpm`)
- A PostgreSQL database for local development
- Bun (only if you run the API server, `apps/server`)

### Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/turboplan.git`
3. Install dependencies: `pnpm install`
4. Set up environment variables by copying the example files. The target
   filename differs per service — `apps/turboplan`'s database scripts load
   `.env.local` by an explicit path:
   ```bash
   cp apps/turboplan/.env.example    apps/turboplan/.env.local
   cp apps/server/.env.example       apps/server/.env.local
   cp apps/landing-page/.env.example apps/landing-page/.env.local
   ```
5. Build the packages: `pnpm build:packages` (the database scripts import them,
   so this has to come first)
6. Push the database schema: `cd apps/turboplan && pnpm db:push`

See [CONFIGURATION.md](./CONFIGURATION.md) for every environment variable, the
four authentication secrets, and the shortest setup that boots the stack with no
third-party accounts.

## Development Workflow

1. Create a new branch for your feature or bugfix:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the code style and guidelines

3. Run the development server:

   ```bash
   pnpm dev
   ```

4. Verify your changes:

   ```bash
   pnpm typecheck       # Type-check all apps and packages
   pnpm lint:fix        # Lint with Biome
   pnpm format:write    # Format with Biome
   pnpm test            # Unit tests
   pnpm e2e             # End-to-end tests (needs TEST_POSTGRES_URL, see e2e/README.md)
   ```

5. Commit your changes following the [Conventional Commits](https://www.conventionalcommits.org/) format:

   ```bash
   git commit -m "feat: add new feature"
   ```

6. Push your branch and create a Pull Request against the `main` branch

## Code Style and Guidelines

- TypeScript everywhere; prefer `type` over `interface`
- **Biome** is the primary linter and formatter (configured in `biome.jsonc`) — do not introduce ESLint or Prettier (the landing page is the sole exception)
- File and directory names use kebab-case; React components export PascalCase names
- Write tests for new functionality
- Use the monorepo structure properly:
  - Place shared code in `packages/` (core infrastructure in `packages/core/`, feature modules in `packages/modules/`)
  - Keep applications in `apps/`
  - Use workspace references (`workspace:*`) for internal dependencies
- New API endpoints belong in the Hono server (`apps/server`) or in package-exported routers — not in Next.js API routes or server actions
- Next.js apps never access the database directly; all DB access goes through the Hono API
- Mutating endpoints must be RBAC-protected (see `packages/core/turboplan-rbac`)

## Changesets

TurboPlan versions the whole platform as one unit: all workspace packages share
a single version and bump together. Releases are driven by
[Changesets](https://changesets.org).

**Every PR that changes behaviour needs a changeset.** Without one the release
notes silently omit your change.

```bash
pnpm changeset            # describe the change (bump type + summary)
pnpm changeset --empty    # docs, tests or refactors with no user-visible effect
```

Commit the generated `.changeset/*.md` file with your code. CI checks for it, and
so does the `pre-push` hook.

Choosing the bump, from the perspective of someone self-hosting this repo:

| Bump | When |
|---|---|
| **major** | A deployment breaks unless the operator acts — new required env var, incompatible migration, removed route or export. |
| **minor** | New capability, backward compatible. |
| **patch** | Bug fix, security fix, performance, dependency bump. |

Write the summary for someone who did not make the change: lead with the effect,
name the surface, and for anything breaking state the migration step.

## Pull Request Process

1. Ensure `pnpm typecheck`, `pnpm lint`, and tests pass
2. Add a changeset (see above), or `pnpm changeset --empty` if none is needed
3. Update documentation if your change affects setup, configuration, or public APIs
   — new or changed env vars go in the relevant `.env.example` **and** `CONFIGURATION.md`
4. Keep PRs focused — one feature or fix per PR
5. Your PR will be reviewed by maintainers who may request changes

## License

By contributing to TurboPlan, you agree that your contributions will be licensed under the project's Apache 2.0 license.
