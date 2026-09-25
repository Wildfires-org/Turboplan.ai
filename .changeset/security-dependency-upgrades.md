---
"turboplan": patch
---

Upgrade runtime dependencies with known critical/high advisories: Next.js
15.5.16 → 15.5.25 (image-optimizer RCE, middleware bypass, SSRF), next-auth
5.0.0-beta.25 → beta.32 / @auth/core 0.41.3 (fail-open auth checks, email
normalisation bypass), drizzle-orm 0.42 → 0.45 (identifier escaping), nodemailer
6 → 9, hono 4.13, @hono/node-server 1.19.17, and overrides for @xmldom/xmldom,
protobufjs, @grpc/grpc-js and smol-toml. drizzle-orm now wraps driver errors in
`DrizzleQueryError`, so unique-violation detection (`isUniqueViolation`) checks
the error's `cause` as well — without this the cataloger's race-condition retry
and the chat route's duplicate-insert 409 would have silently stopped working.
