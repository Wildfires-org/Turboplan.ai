---
"@wildfires-org/turboplan-auth": patch
---

Fix an account takeover in the web app's magic-link sign-in. The NextAuth
`magic-link` Credentials provider accepted a bare `userId`, so any caller with a
CSRF token could `POST /api/auth/callback/magic-link` and receive a session for
any user. The provider now accepts only a short-lived (60 s) HMAC-signed login
ticket, minted server-side after the magic-link or invitation token has been
validated, and the web middleware refuses external `POST`s to
`/api/auth/callback/*` and `/api/auth/signin/*`. No configuration change is
needed; the ticket key is derived from the existing `AUTH_SECRET`.
