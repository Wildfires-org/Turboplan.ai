---
"@wildfires-org/turboplan-workspace": patch
---

Turning `isPublic` or `isTemplate` on via `PUT /api/projects/:id` or MCP
`update_project` now requires MANAGE_MEMBERS on the project's office, the same
bar as project creation. Previously any office role sufficed, so an office
editor could create a project (publish flags dropped) and then publish it with
a second request. The "Make project public" control is hidden from users who
lack that permission.
