---
"@wildfires-org/turboplan-utils": patch
---

Reject `javascript:` and other non-http(s) URLs in stored links. Research-agent
documents, project context entries, timeline resource links (web, MCP and the
AI context tool) accepted any URL that parsed, and the documents UI opened them
with `window.open`, so a stored `javascript:` link ran script when clicked.
These fields now only accept http(s) URLs, and the documents, preview, research
and signing UIs refuse to open unsafe URLs.
