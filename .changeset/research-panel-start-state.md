---
"turboplan": patch
"@wildfires-org/turboplan-research-agent-integration": patch
---

The research panel no longer offers "Start research" for a run that already
started automatically. After the first message of a project's initial chat, the
panel now shows "Starting research…" straight away instead of the idle
placeholder with a Start button, and switches to the live run as soon as it
appears. Status polling now starts when the message is sent rather than when the
reply begins streaming, and re-renders no longer reset the poll timer, which
could delay picking up the run by 40 seconds or more. The step text in the
research panel now follows the latest progress update instead of lagging behind
the progress list, and the research status endpoint answers from the database
instead of waiting on the external agent on every poll (the missed-webhook check
now runs in the background, only after a minute without updates, with a 10s
timeout).
