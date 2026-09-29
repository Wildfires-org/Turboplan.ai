---
"@wildfires-org/turboplan-workspace": patch
---

`GET /api/invitations/entity/:type/:id` now requires a real role on the
organization or office (direct, inherited or platform admin). Previously a
member of a single child project could list the parent's pending invitations,
including invitee emails and roles, through the upward read grant.
