---
"@wildfires-org/turboplan-workspace": patch
---

Narrow scoped user search to the scope entity's own branch. A `projectId` or
`officeId` scope on `GET /api/users/search` resolved to the organization and
fuzzy-matched every member of the whole organization tree, so in a government
organization any citizen with a role on their own project could enumerate other
applicants' emails. Project scope now matches only that project's, its office's
and the organization's members; office scope only that office, its projects and
the organization. Exact full-email matches still work for invite-by-email.
