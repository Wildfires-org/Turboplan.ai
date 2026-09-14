#!/usr/bin/env bash
# Fails when the current branch changes shipped code but records no changeset.
#
# Used by .husky/pre-push, by .github/workflows/ci.yml, and by the Claude Code
# Stop hook in .claude/settings.json. See .claude/skills/release-versioning/.
#
# Exit codes: 0 = satisfied (or not applicable), 1 = changeset missing.
set -uo pipefail

BASE_BRANCH="${CHANGESET_BASE_BRANCH:-main}"

# Not a git repo yet (e.g. a fresh export before `git init`) — nothing to check.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# Resolve the comparison point. Prefer the remote base, fall back to a local
# branch, then to the empty tree so a repo with no base branch still works.
if git rev-parse --verify --quiet "origin/${BASE_BRANCH}" >/dev/null; then
  BASE_REF="origin/${BASE_BRANCH}"
elif git rev-parse --verify --quiet "${BASE_BRANCH}" >/dev/null; then
  BASE_REF="${BASE_BRANCH}"
else
  exit 0
fi

MERGE_BASE="$(git merge-base HEAD "${BASE_REF}" 2>/dev/null)" || exit 0

# Committed work on this branch, plus anything still in the working tree —
# staged, unstaged and untracked. The working tree matters when this runs
# mid-session (the Claude Code Stop hook) rather than at push time.
CHANGED="$(
  {
    git diff --name-only "${MERGE_BASE}"...HEAD
    git diff --name-only HEAD
    git diff --name-only --cached
    git ls-files --others --exclude-standard
  } 2>/dev/null | sort -u
)"

# Nothing changed anywhere — e.g. sitting clean on the base branch.
if [ -z "${CHANGED}" ]; then
  exit 0
fi

# Does the branch touch shipped code? Docs, tests and CI config do not count.
SHIPPED="$(printf '%s\n' "${CHANGED}" \
  | grep -E '^(apps|packages)/' \
  | grep -vE '(^|/)(tests?|unit-tests|__tests__|e2e)/' \
  | grep -vE '\.(md|mdx)$' \
  | grep -vE '\.env\.example$' || true)"

if [ -z "${SHIPPED}" ]; then
  exit 0
fi

# Any changeset added on this branch satisfies the check, including an empty one.
ADDED_CHANGESETS="$(printf '%s\n' "${CHANGED}" \
  | grep -E '^\.changeset/.*\.md$' \
  | grep -v '^\.changeset/README\.md$' || true)"

if [ -n "${ADDED_CHANGESETS}" ]; then
  exit 0
fi

cat >&2 <<EOF

  Missing changeset.

  This branch changes shipped code under apps/ or packages/ but adds no
  changeset, so the release notes would omit it:

$(printf '%s\n' "${SHIPPED}" | sed 's/^/    /' | head -20)

  Record it:

    pnpm changeset            # describe the change (bump + summary)
    pnpm changeset --empty    # if it genuinely needs no release note

  Guidance on choosing the bump: .claude/skills/release-versioning/SKILL.md

EOF
exit 1
