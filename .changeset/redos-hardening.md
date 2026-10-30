---
"turboplan-server": patch
"@wildfires-org/turboplan-mcp-server": patch
"turboplan": patch
"turboplan-landing-page": patch
"@wildfires-org/turboplan-analytics": patch
"@wildfires-org/turboplan-map-server": patch
---

Fixes regular expressions that crafted input could make backtrack for seconds
or minutes (ReDoS):

- The unauthenticated `POST /generate-titles`, `/api/public/validate-prompt`
  and `/api/public/enhance-prompt` endpoints (and the authenticated prompt
  routes) ran a cubic "role" filter on the whole request before truncating it:
  8KB took over a second. The filter is now linear, and all five routes reject
  bodies over 10KB with a 413, including chunked requests without a
  `Content-Length` header.
- MCP organization logo validation: a 211-byte SVG hung the SVG root check
  (exponential), and a long `attributeName=` run slowed the active-content
  check. Both are linear now. The root check also no longer lets a comment run
  past `-->`, which let a `SYSTEM` or non-W3C DOCTYPE hidden between two
  comments pass as safe.
- The Sentry URL scrubbers (API, web, landing, map server) and the analytics URL
  redaction were cubic in the URL length: a 4KB URL took 2s (13s on the map
  server). Sensitive query params are now found with a linear name scan, and
  a sensitive param nested in another param's value is still redacted.
