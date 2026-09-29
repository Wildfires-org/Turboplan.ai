---
"@wildfires-org/turboplan-mcp-server": patch
---

Close MCP bulk-tool amplification. Bulk tools (`upload_documents_from_urls`,
`create_timeline_events`, `add_project_fields`, `add_project_context_entries`,
`create_milestone`) cost one write rate-limit token per call regardless of item
count, and `upload_documents_from_urls` downloaded up to three 50 MB files at
once with two in-memory copies each, enough to exceed the Worker's 128 MB memory
limit. Bulk calls are now charged one token per item (capped at 30), a request
may contain at most one `upload_*` tool call, URL downloads run one at a time
within a 60 MB per-call budget, and downloads are buffered without the extra
copy.
