---
"@wildfires-org/turboplan-mcp-server": patch
---

MCP `create_organization` and organization `type`/`status` changes via
`update_organization` now always return "Access denied." These were still
gated on platform-admin status, so a leaked admin personal access token could
create organizations or change an organization's type and status; platform-admin
actions are web-session only.
