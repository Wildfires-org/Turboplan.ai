---
"turboplan-server": patch
---

Redact credential headers in the API request log on Workers. Pino's `redact`
option only works in its Node build; a Worker bundle gets pino's browser build,
which ignores it, so `Authorization` bearer tokens, cookies and API keys reached
the Worker logs verbatim. The hono-pino request and response bindings now
replace every credential, cookie, secret, token and signature header with
`[REDACTED]` before pino sees them.
