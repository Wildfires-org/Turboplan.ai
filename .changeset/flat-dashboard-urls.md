---
"turboplan": minor
"@wildfires-org/turboplan-utils": minor
"@wildfires-org/turboplan-workspace": minor
"@wildfires-org/turboplan-mcp-server": patch
---

Dashboard URLs are shorter: `/organizations/usfs/offices/my-projects/projects/jackson-creek`
is now `/usfs/my-projects/jackson-creek` (org `/:org`, office `/:org/:office`,
project `/:org/:office/:project`; sub-pages unchanged). Old `/organizations/…`
links from emails, Stripe, MCP output and bookmarks 308 to the new shape,
query string included. Emails, billing return URLs and the MCP
`dashboardUrl` now emit the new shape via the shared `appPaths` builder
(`@wildfires-org/turboplan-utils/app-paths`).

Slugs that would be shadowed by a static route are now reserved
(`RESERVED_SLUGS`, exported from `@wildfires-org/turboplan-utils/slug`): e.g. an org named "Admin" or an office named "Members" gets
a suffixed slug (`members-a1b2c3`), and renaming to a reserved slug is rejected.
Unknown or reserved root paths 404 before any DB lookup. Operators upgrading
should confirm no existing organization, office or project already holds a
reserved slug — such an entity would become unreachable until renamed.

Also fixes auth public-route matching to be segment-aware (an org slug like
`registered-agents` no longer redirect-loops a signed-in user via `/register`).
