---
"turboplan": patch
---

Send security headers from the web app, landing page and API. None of them set
any, so the app could be framed (clickjacking) and had no HSTS. The web app and
landing page now send `X-Frame-Options: DENY`, an enforced
`Content-Security-Policy: frame-ancestors 'none'`, `nosniff`, a
`strict-origin-when-cross-origin` referrer policy, a restrictive
`Permissions-Policy`, HSTS in production, no `X-Powered-By`, and a full
`Content-Security-Policy-Report-Only` policy to review before enforcing it. The
API adds Hono's `secureHeaders` (cross-origin resource policy kept open for the
web app, HSTS in production).
