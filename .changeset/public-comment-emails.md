---
"@wildfires-org/turboplan-db": patch
---

Stop exposing commenters' email addresses to non-members. Public project
comments (`/api/public/projects/:org/:office/:project/comments`) and the
authenticated comment list for non-members of public government projects
returned each author's email and the target user id of auto-responses. These
responses now omit both; project members still see emails. Comments by users
without a profile name show "Unknown user".
