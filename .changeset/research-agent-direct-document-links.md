---
"@wildfires-org/research-agent": patch
---

The research agent now returns direct file links for documents it finds on
pages that only describe them. For CEQAnet it submits the
`files.ceqanet.lci.ca.gov/.../attachment/...` PDF, not the
`ceqanet.lci.ca.gov` detail page, and lists each attachment as its own
document. The URL check now accepts file URLs that have no extension when they
return a PDF/DOC/DOCX content type.
