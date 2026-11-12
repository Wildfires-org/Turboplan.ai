---
"turboplan": minor
"@wildfires-org/turboplan-ai": patch
"@wildfires-org/turboplan-env": patch
---

Chat web search and page reading now use Firecrawl instead of Exa. Set
`FIRECRAWL_API_KEY` (from https://www.firecrawl.dev/app/api-keys) in place of
`EXA_API_KEY`, which is no longer read; without it, chat still works and web
search says it is unavailable.

The `webSearch` tool no longer takes `searchType`, and its `category` is now
one of `government` (.gov sites), `pdf` or `research`. Search highlights are a
short snippet per result. `getContents` returns each page's summary and
opening by default, and only the page text when asked for `maxCharacters`.
Pages that cannot be read (including 404 pages) are left out.

Deployments with `USE_EXTERNAL_PROMPTS` on must reseed or update the
`research-mode`, `tool-desc-web-search` and `tool-desc-get-contents` prompts to
pick up the change.
