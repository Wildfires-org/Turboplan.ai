---
"@wildfires-org/turboplan-mcp-server": patch
"turboplan": patch
"@wildfires-org/turboplan-map-server": patch
---

Upgrades dependencies with open security advisories:

- MCP server: `@modelcontextprotocol/sdk` 1.29.0 → 1.32.1, and the server now
  sets `maxToolInputElements: 10_000`. Without that option, which the SDK
  leaves off by default, one request whose tool arguments held enough array
  elements and object keys could exhaust the Worker's memory during validation
  (GHSA-46jr-4wx8-v453).
- Web editor: `prosemirror-view` 1.41 → 1.42.6 (XSS in paste handling,
  GHSA-c8x8-7fp4-3x9w), with `prosemirror-model` raised to 1.25.12 so the
  editor keeps a single model copy. `markdown-it` 14.3.3 and `linkify-it` 5.0.2
  are forced through overrides (quadratic parsing DoS), and so is `mermaid`
  11.17 under `streamdown`. Chat does not enable streamdown's mermaid plugin,
  so mermaid is installed but never runs.
- Map server: `urllib3` 2.5.0 → 2.8.0 (decompression bombs and unbounded chunks
  while streaming caller-supplied URLs, proxy header and TLS issues),
  `requests` 2.32.5 → 2.34.2 and `idna` 3.10 → 3.20.
