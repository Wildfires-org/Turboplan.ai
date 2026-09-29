---
"@wildfires-org/turboplan-api-client": patch
---

Stop upload-only tokens from acting as a full sign-in on optional-auth routes.
`optionalAuthMiddleware` accepted any valid API token, including the 5-minute
upload tokens that are passed in URLs, so a leaked upload token let anyone post
public comments as that user or read their private comments on public projects.
Only general-purpose tokens are now accepted; others are treated as anonymous.
