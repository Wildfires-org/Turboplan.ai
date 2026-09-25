---
"@wildfires-org/turboplan-workspace": major
---

Stop exposing the platform's user directory and member emails.

- **Breaking — removed `GET /api/users`**, which returned every user's id and
  email to any signed-in user. Task assignee pickers use the new
  `GET /api/projects/:id/assignable-users` (project read access), which returns
  the project's, office's and organization's members plus existing assignees.
  The AI task tool no longer puts every user's email into its prompt.
- **`GET /api/users/search` now requires exactly one of `organizationId`,
  `officeId` or `projectId`** (400 otherwise) and read access to it. Fuzzy
  matches are limited to people in that organization tree; anyone else is only
  returned on an exact email match, so invite-by-email still works. Global
  search moved to the admin-only `GET /api/admin/users/search`.
- Task and milestone reads by non-members of public government projects no
  longer include assignee emails, and office project lists no longer include
  the creator's email for projects the caller only sees because they are
  public.
