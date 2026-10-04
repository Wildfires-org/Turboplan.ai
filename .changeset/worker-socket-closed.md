---
"@wildfires-org/turboplan-db": patch
"turboplan-server": patch
---

Stop the API Worker from logging `TypeError: This socket has been closed.` as an
unhandled rejection every time a request closes its database connection.
postgres.js's Cloudflare socket shim re-emitted the read error after the
connection had already dropped its listeners, so Node's EventEmitter threw it.
A pnpm patch (`patches/postgres@3.4.7.patch`) only emits `error` when someone
listens. Requests were never affected.
