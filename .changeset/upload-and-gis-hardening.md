---
"@wildfires-org/turboplan-upload": patch
"@wildfires-org/turboplan-map-server": patch
"@wildfires-org/turboplan-document-extraction": patch
"turboplan-server": patch
---

Security hardening for uploads and GIS processing.

- Presigned upload URLs now sign the content type, so a file can only be stored
  with the type it was approved for.
- The map server only loads the GIS formats it supports and blocks GDAL from
  making network requests, so a crafted file can no longer make the server
  fetch internal URLs.
- Crafted legacy Word (.doc) files can no longer stall or crash text
  extraction.
- Anonymous upload requests are rate limited per IP at the Cloudflare edge.
