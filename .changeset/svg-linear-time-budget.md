---
"@wildfires-org/turboplan-mcp-server": patch
---

Give the 2MB SVG comment-preamble test its own 2 s time budget. It does real
linear work that a busy CI runner can take over 250 ms to finish, so it failed
intermittently; a quadratic regression would still take far longer.
