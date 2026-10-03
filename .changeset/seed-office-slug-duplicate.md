---
"@wildfires-org/turboplan-workspace": patch
"@wildfires-org/turboplan-db": patch
---

The government seed lists the DOT PHMSA office as
`pipeline-and-hazardous-materials-safety` instead of the old slug ending in
`-`. After migration 0003 renamed that office, the seed (which runs on every
deploy and matches offices by current slug) re-inserted an empty duplicate
under the old slug. Migration 0004 removes such duplicates: an office whose
slug ends in `-` is deleted only when its trimmed slug already exists in the
same organization and no project or submission refers to it.
