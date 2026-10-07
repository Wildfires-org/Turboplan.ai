---
"@wildfires-org/turboplan-research-agent-integration": minor
"@wildfires-org/turboplan-api-client": minor
"@wildfires-org/turboplan-utils": minor
"@wildfires-org/turboplan-ai": minor
"turboplan": minor
---

Project chat next-step chips now stream in one by one instead of appearing
all at once after the whole set was generated (about 15 seconds locally). When
the chips are rebuilt after research items are saved, the current chips stay
on screen until the first new one arrives, with a placeholder pill trailing
while more are coming; the full loading row is only shown for the very first
build.

`POST /api/ai/research-agent/bootstrapper/project/:projectId/suggestions/regenerate`
now answers with newline-delimited JSON (`chip` events, then `done` once the
set is stored, or `error`) instead of a single `{ suggestions }` body; its
pre-check failures (404, 402) are unchanged JSON errors. Generation, credit
metering and storage keep running if the client disconnects mid-stream.
`ApiClient` gains `fetchRaw()` for authenticated requests that return the raw
`Response`, `SuggestionPills` gains an `isStreaming` prop, and
`@wildfires-org/turboplan-ai/server` re-exports `streamText` and `Output`.
