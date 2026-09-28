---
"@wildfires-org/turboplan-research-agent-integration": patch
---

Detect downloadable research-agent documents by content type, not only by URL
suffix. Government sites often serve PDFs from extensionless URLs (e.g. CEQAnet
`/attachment/<id>` links), which were shown as "Link only - not a downloadable
file" and saved as link references. The bootstrapper documents webhook now
probes such URLs once (HEAD, then a one-byte ranged GET, SSRF-guarded, bounded
concurrency and time budget) and persists `isDownloadable`/`contentType` on the
document. The panel pill, file-type label, preview and save paths use that flag,
falling back to the URL check for older documents. Downloads now name
extensionless files after the document title, follow up to three re-validated
redirects, reject HTML bodies whatever their Content-Type, accept unlabelled
DOC/DOCX when Content-Disposition and the file signature agree, and no longer
log full document URLs.
