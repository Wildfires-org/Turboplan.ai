---
"@wildfires-org/turboplan-utils": patch
"@wildfires-org/turboplan-db": patch
---

Fix slugs that ended in a hyphen. Names longer than 40 characters were cut
after their edge hyphens were trimmed, so a cut between words left a trailing
`-` (for example the DOT office `pipeline-and-hazardous-materials-safety-`).
The public API rejects such slugs, so those catalog pages returned "not found".
Slugs are now trimmed after the cut, and migration `0003` renames existing
organizations, offices and projects with a trailing hyphen, keeping the old slug
in `slug_history`. A row whose trimmed slug is already taken in its scope is left
unchanged.
