---
"turboplan": patch
"@wildfires-org/turboplan-research-agent-integration": patch
---

The research panel now shows a research run that starts automatically with the
first message of a project's initial chat, for example a project created from
the landing page. Before, the panel stayed on "Start research" until the browser
window was refocused, even though the run had already started. The chat view
now polls the research status for up to 30 seconds after that first message,
until the run appears.
