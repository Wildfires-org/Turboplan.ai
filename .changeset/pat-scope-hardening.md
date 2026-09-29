---
"turboplan-server": patch
---

Limit what personal access tokens can do. A PAT could create, list and revoke
other PATs (so a leaked token could mint a non-expiring replacement that
survived its own revocation), was accepted on `/api/admin/*`, and inherited the
platform-admin RBAC bypass for admin users over REST guards and MCP. PAT
management and admin routes now require a browser session, PATs never receive
the platform-admin bypass in the RBAC guards or the MCP server, and new PATs
always expire: 90 days by default, at most 365 days (the "Never" option is
removed from the token dialog; existing non-expiring tokens keep working).
