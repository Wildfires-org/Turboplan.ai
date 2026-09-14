# Changesets

This folder holds **unreleased** change descriptions. Each `.md` file here is one
pending changelog entry, written by whoever made the change.

TurboPlan versions the whole platform as one unit — every workspace package shares
a single version and bumps together. Nothing is published to npm; the release is
the repository itself, tagged `v<version>`.

## Adding one

```bash
pnpm changeset            # describe a user-facing change
pnpm changeset --empty    # record that a change needs no release note
```

Commit the generated file alongside the code it describes.

## Releasing

```bash
pnpm changeset status     # what is pending
pnpm release:version      # apply bumps, rewrite CHANGELOG.md, sync the lockfile
```

Then review `CHANGELOG.md` by hand, commit as `chore(release): v<version>`, and tag.

Full guidance, including how to choose major vs minor vs patch:
[`.claude/skills/release-versioning/SKILL.md`](../.claude/skills/release-versioning/SKILL.md).

More on the tool: [changesets.org](https://changesets.org).
