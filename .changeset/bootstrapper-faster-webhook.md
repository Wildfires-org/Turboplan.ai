---
"@wildfires-org/turboplan-research-agent-integration": minor
---

Speed up research-agent bootstrapper runs from the app side. The documents
webhook now replies as soon as the documents are saved and probes extensionless
document URLs for downloadability in the background (kept alive with
`waitUntil`), writing the result back onto the saved documents; until it lands,
documents fall back to URL-shape detection. Previously the agent's POST waited
up to about 20 seconds per batch for those probes. Uploaded project documents
now get 12,000 characters of the research start prompt instead of 3,600, and the
prompt cap is 20,000 characters to match the research agent, so a Scope of
Services actually reaches the agent. Uploaded documents that do not fit are
listed as omitted rather than silently dropped.
