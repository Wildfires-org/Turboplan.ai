---
"@wildfires-org/turboplan-workspace": patch
---

Stop applicants from approving their own project submissions. Reviewing a
submission (`PATCH /api/projects/:id/review`) previously only required
MANAGE_MEMBERS on the project, and submitting only downgraded the submitter, so
a second co-owner account could accept the application into a government
office. Review now requires MANAGE_MEMBERS on the submission's target office
(or target organization for older submissions); submitting requires project
ownership, downgrades every project member and pending owner/editor invitation
to viewer, and forces the project private and non-template. Review also now acts
on the latest pending submission rather than an arbitrary earlier one.
