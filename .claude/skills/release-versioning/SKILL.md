---
name: release-versioning
description: Record a changeset for a user-facing change, and cut releases for the TurboPlan monorepo. Use whenever code under apps/ or packages/ has been changed and no changeset exists yet, when the user asks to "add a changeset", "bump the version", "cut a release", "update the changelog", or "release 1.1.0", and when a CI changeset check or the pre-push hook has failed. Also use when deciding whether a change is major, minor or patch.
---

# Release & Versioning

TurboPlan versions the **whole platform as one unit**. All 33 workspace packages
share a single version number and move together — there is no independent
package versioning, because nothing here is published to npm and the packages
are only consumable as a set.

Tooling: [Changesets](https://changesets.org), configured in
`.changeset/config.json`.

## The rule

**Every pull request that changes behaviour carries a changeset.** No changeset
means no CHANGELOG entry, which means the release notes lie.

Changes that do NOT need a changeset — and should be marked as such rather than
skipped silently:

- documentation, comments, README/CONFIGURATION edits
- tests that do not change shipped behaviour
- formatting, lint fixes, dependency bumps with no user-visible effect
- internal refactors that are genuinely invisible to a user or operator

When in doubt, write one. A redundant changelog line is cheap; a missing one is
discovered by a user.

## Adding a changeset

```bash
pnpm changeset
```

Interactive. It asks for the bump type and a summary, then writes a markdown
file into `.changeset/`. Commit that file with the code it describes.

Because every package is in one `fixed` group, selecting **any** package bumps
all of them. Select the package you actually changed — the entry reads better in
the changelog even though the version bump is repo-wide.

To record "this needs no release", create an empty changeset:

```bash
pnpm changeset --empty
```

### Writing the summary

The summary becomes a CHANGELOG line read by people who did not make the change.

- Lead with the user-visible effect, not the implementation.
- Name the surface: which app, module, endpoint or flag.
- For a fix, say what was broken.
- For anything breaking, state the required migration in the summary itself.

```
Good: Magic-link emails now reject a `magicLinkUrl` pointing outside the app
      origin, closing a phishing vector on the internal email endpoint.
Bad:  fix routes.ts
```

## Choosing the bump

Semantic versioning, judged from the perspective of someone **self-hosting or
forking** this repo — that is who a version number speaks to here.

| Bump | When |
|---|---|
| **major** | A deployment breaks unless the operator acts. New required env var, renamed/removed env var, a migration that is not backward compatible, removed or renamed API route, changed auth/session/token semantics, removed package export, dropped Node/pnpm version. |
| **minor** | New capability, backward compatible. New feature module or flag, new endpoint, new optional env var, new package export. |
| **patch** | Bug fix, security fix, performance work, dependency bump — no operator action needed. |

Two rules that matter more than the table:

1. **A new required env var is a major bump.** The app throws on boot without
   it. Every one of `AUTH_SECRET`, `INTERNAL_API_SECRET`, `JWT_SIGNING_SECRET`
   and `ENCRYPTION_KEY` fails closed by design, so adding a fifth is breaking.
2. **A database migration that is not backward compatible is a major bump**,
   even when no code signature changed. Say so in the summary and name the
   migration file.

Security fixes are patch unless the fix itself forces operator action — then
major, and say why in the summary.

## Cutting a release

1. Confirm what is pending:

   ```bash
   pnpm changeset status
   ```

2. Apply the bumps and rewrite the changelogs. This consumes every file in
   `.changeset/`, updates all 33 `package.json` versions and prepends to
   `CHANGELOG.md`:

   ```bash
   pnpm changeset version
   ```

3. Reconcile the lockfile and verify the tree:

   ```bash
   pnpm install --lockfile-only
   pnpm typecheck && pnpm lint && pnpm test
   ```

4. Review the generated `CHANGELOG.md` **by hand** before committing. Changesets
   concatenates summaries; it does not edit them. Merge duplicates, fix ordering
   so breaking changes lead, and confirm every breaking entry states its
   migration.

5. Commit as `chore(release): v<version>`, tag `v<version>`, push the tag.

Never hand-edit a version in a `package.json`, and never hand-write a released
section of `CHANGELOG.md`. Both are generated; manual edits are silently
overwritten by the next `changeset version`.

## Enforcement

Three layers, deliberately redundant:

- **`.husky/pre-push`** — refuses a push that changes `apps/` or `packages/`
  with no changeset on the branch. Bypass with `--no-verify` only for a genuine
  docs-only branch, and prefer `pnpm changeset --empty`.
- **`.github/workflows/ci.yml`** — a `changeset status` check on every pull
  request. Advisory on forks (external contributors should not be blocked on
  release mechanics), enforced on branches in this repo.
- **This skill** — when you change code under `apps/` or `packages/` and no
  changeset exists for it, add one before reporting the work finished.

## Version 1.0.0

`CHANGELOG.md` has a hand-written `1.0.0` section covering the initial public
release. That entry predates Changesets and is the one section not generated by
it — leave it alone. Everything from 1.0.1 / 1.1.0 onward is generated above it.
