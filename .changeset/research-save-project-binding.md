---
"@wildfires-org/turboplan-research-agent-integration": patch
---

Bind research-agent save endpoints to their project. Saving fields, context,
documents, timeline entries or milestones looked up the research message by id
alone, so an editor of one project who knew a message id from another project
could copy that project's research output into their own and mark the other
project's suggestions as saved. The message must now belong to the project in
the request path.
