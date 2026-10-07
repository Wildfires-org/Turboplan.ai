---
"@wildfires-org/turboplan-research-agent-integration": patch
"@wildfires-org/research-agent": patch
---

Research setup now advances as soon as the research agent finishes, without a
page refresh. Before, a finished run stayed "running" (setup banner stuck on its
first step, document creation still gated) until the page was reloaded,
sometimes twice. The chat view stopped polling the research status right after
the page loaded, so it never saw the run end; it now keeps polling while a run
is active and fetches the research results once more when the run ends, so the
last batch is not missed. The research agent now also reports how the run ended
(completed, failed or cancelled) with its final progress message, and the web
app marks the run finished from that message instead of waiting up to a minute
for its status check to catch it.

The research agent must be redeployed (`pnpm deploy` in `apps/research-agent`)
for the instant completion; the polling fix works without it, and an agent or
web app on the previous version keeps working with the other side updated.
