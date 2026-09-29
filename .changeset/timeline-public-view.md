---
"@wildfires-org/turboplan-timeline-records": patch
---

Stop the project timeline leaking private data to non-members. A signed-in
user with no role on a public government project (for example a citizen) could
call `GET /api/projects/:id/timeline` and `/timeline/stats` and receive every
record, including ones marked private, author emails, and records from modules
the project hides. Such callers now get the public view: public records only,
no author email or user id, and nothing from hidden or private modules. The
anonymous `/api/public/projects/:org/:office/:project/timeline` route applies
the same module filtering and no longer returns author emails. The timeline
`isPublic` query parameter now only accepts `true` or `false`; previously
`isPublic=false` was coerced to `true`.
