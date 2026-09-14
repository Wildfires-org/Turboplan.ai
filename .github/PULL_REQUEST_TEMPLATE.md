## What and why

<!-- What changes, and what problem it solves. Link an issue if there is one. -->

## Changeset

<!-- Every PR that changes behaviour needs one: `pnpm changeset`
     (or `pnpm changeset --empty` for docs/tests/refactors with no user impact).
     Bump guidance: .claude/skills/release-versioning/SKILL.md -->

- [ ] Added a changeset, or this PR needs no release note

## Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` and `pnpm format` pass
- [ ] Tests added or updated, and `pnpm test` passes
- [ ] New/changed env vars documented in the relevant `.env.example` and `CONFIGURATION.md`
- [ ] Mutating endpoints are RBAC-protected

## Breaking changes

<!-- Required env var, incompatible migration, removed route/export?
     Say so here AND in the changeset summary, with the migration step. -->

None.
