---
name: e2e-admin-users
description: How to get an admin in TurboPlan e2e tests, and which admin pages/endpoints a DB admin can't reach
metadata:
  type: project
---

Admin = super admin (email in `ADMIN_EMAILS`, which the e2e servers don't set) OR a row in `admin_user` (`addAdminUser(userId, null)` from `@wildfires-org/turboplan-db/queries`). Test users are only ever DB admins. So `/admin/users` (super-admin only) redirects them to `/admin`, and POST/DELETE `/api/admin/admin-users` return 403. GET of that list is open to any admin on purpose. Admin status endpoint: `/api/admin-status`. The test DB has no seeded prompts.

**Why:** the plausible assumption that one admin can open every admin page is wrong for `/admin/users`.

**How to apply:** use `createSignedInAdmin` in `e2e/tests/admin/admin-session.ts`. Don't edit shared global admin state (AI model config, real prompts) because other specs' AI calls depend on it. Edit a spec-owned prompt instead, then delete it.
