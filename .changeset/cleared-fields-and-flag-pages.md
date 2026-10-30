---
"turboplan": patch
"@wildfires-org/turboplan-workspace": patch
"@wildfires-org/turboplan-map": patch
---

Fix five app bugs found by new end-to-end coverage:

- Clearing an optional profile field, or an organization's short name or country, now saves; the old value used to come back.
- `my-submissions` shows a rejected proposal as Rejected (it showed New), so the Rejected filter works.
- With signing off, `/:org/my-signatures` and a project's `/signing` page return not found instead of an empty list backed by a missing API.
- With project context off, a project's Context page no longer shows a Notes section that cannot load.
- The empty map's "Back to project" link opens the project instead of an access error.
