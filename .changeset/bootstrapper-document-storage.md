---
"@wildfires-org/turboplan-research-agent-integration": patch
---

Harden how research-agent documents are downloaded and stored. The bootstrapper
document preview and save paths stored whatever Content-Type the remote server
sent (including HTML and SVG) in public storage, built storage keys from the
URL-decoded filename (so `%2F` added extra key segments), and buffered
downloads without a streaming size cap. Both paths, and the cataloger, now share
one download helper: SSRF-checked fetch, 50 MB streaming cap, PDF/DOC/DOCX
allowlist with the stored type taken from the allowlist, and a single sanitised
key segment with a random UUID. The SSRF check now reuses the shared classifier,
which also blocks NAT64 and 6to4 addresses.
