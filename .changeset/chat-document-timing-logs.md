---
"turboplan": patch
---

The web Worker's CPU limit is raised from the 30-second default to 5 minutes
(`limits.cpu_ms` in `apps/turboplan/wrangler.jsonc`). A chat turn that writes a
document streams two model runs through one request and could hit the old cap
mid-document, which the browser reported as "network error". Chat turns and
document generation now emit structured `[ChatTiming]` logs (per-step time to
first token, tool input and execution times, document time to first token and
duration, token usage, and whether the server finished the run). They contain
sizes, counts and timings only, never message content.
