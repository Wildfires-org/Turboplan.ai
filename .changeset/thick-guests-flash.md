---
---

E2E: open truly anonymous browser contexts for invitee and public-visitor
scenarios. `browser.newContext()` inherits the project's stored citizen
session, so these tests were running signed in and relied on invitations being
acceptable by the wrong account.
