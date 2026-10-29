---
"@wildfires-org/turboplan-api-client": minor
"turboplan": patch
---

- `@wildfires-org/turboplan-api-client` no longer exports the JWT and PAT
  utilities from its root entry. Import them from
  `@wildfires-org/turboplan-api-client/server`. Re-exporting them from the root
  shipped a ~90 KiB crypto polyfill to every client bundle that used a
  fetcher.
- Content-hashed `/_next/static/*` assets of the web app are now served with
  `Cache-Control: public, max-age=31536000, immutable` through
  `public/_headers`. They were `max-age=0`.
