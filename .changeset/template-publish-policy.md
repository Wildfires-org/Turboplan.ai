---
"@wildfires-org/turboplan-workspace": patch
---

Close two gaps in the project publishing policy. `POST
/api/projects/:id/create-template` always created a public template, so an
office editor could publish templates; it now only creates a public template
when the caller holds MANAGE_MEMBERS on the office (editors get a private one),
and accepts an optional `isPublic` flag. MCP `create_project` now applies the
same rule as the web route: `isPublic`/`isTemplate` are only honoured for office
owners, and non-citizen projects are created as accepted rather than draft.
