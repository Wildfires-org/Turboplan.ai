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
last batch is not missed. The web app also marks the run finished as soon as the
agent's final progress message arrives, instead of waiting up to a minute for
its status check to catch it.

This works before the research agent is redeployed: when a progress message
does not say how the run ended, the web app asks the agent for the run's status,
which the agent records before it sends its final message. The research agent
now also reports the outcome (completed, failed or cancelled) with that final
message; once it is redeployed (`pnpm deploy` in `apps/research-agent`), the web
app takes the outcome from the message and skips the extra status check for it.
An agent or web app on the previous version keeps working with the other side
updated.
