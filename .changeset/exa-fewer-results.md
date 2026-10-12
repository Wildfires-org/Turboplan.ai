---
"turboplan": patch
"@wildfires-org/turboplan-ai": patch
---

Chat web search now always asks Exa for 5 results instead of the 10 the
research prompts told the assistant to request, halving the search results and
highlight text sent to the model on each research turn. The `webSearch` tool no
longer takes a `numResults` argument, and the `research-mode` and
`tool-desc-web-search` prompts no longer mention it.

Deployments with `USE_EXTERNAL_PROMPTS` on must reseed or update the
`research-mode` and `tool-desc-web-search` prompts to pick up the change.
