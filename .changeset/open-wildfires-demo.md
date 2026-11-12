---
"turboplan": minor
"turboplan-server": minor
"@wildfires-org/turboplan-mail": minor
---

A deployment can now use the Wildfires.org look (`NEXT_PUBLIC_BRAND_THEME=wildfires`),
keep itself out of search results (`NEXT_PUBLIC_NOINDEX=true`), and send mail through
Cloudflare Email Sending by giving the API Worker a `send_email` binding named
`SEND_EMAIL`.
