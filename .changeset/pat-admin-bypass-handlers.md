---
"@wildfires-org/turboplan-rbac": patch
---

Finish removing platform-admin powers from personal access tokens. After the
RBAC guards stopped granting the admin bypass to PAT requests, 40 inline
permission checks in request handlers (projects, documents, comments,
invitations, offices, organizations, templates, members, submissions, maps,
billing, AI images) still did; they now use the request-aware RBAC service.
Changing an organization's type or status also no longer honours an admin's PAT
(new `isSessionAdmin(c)` helper).
