---
"@wildfires-org/turboplan-workspace": patch
---

Stop non-members from publishing projects inside a government office. A user
without CREATE on a government office could previously create a project there
with `isPublic`/`isTemplate` set and, if their role was unset, in the ACCEPTED
state — making it appear in the public catalog under the agency's name — and
then read the organization's full member list. Such applications are now always
private, non-template drafts; `isPublic`/`isTemplate` can only be turned on by
someone with a real role on the office (web `PUT /api/projects/:id`, MCP
`update_project`); SUBMITTED and REJECTED projects are excluded from every
public read path (catalog, templates, public-gov read, search); and
`GET /api/organizations/:id/members` and `GET /api/offices/:id/members` no
longer answer callers whose only access comes from a child project.
