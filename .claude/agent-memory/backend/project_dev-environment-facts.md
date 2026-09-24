---
name: dev-environment-facts
description: Local dev DB is a remote Neon host (not localhost) and local R2 credentials were rejected as of 2026-09-24 — affects seed scripts and document/map uploads
metadata:
  type: project
---

The "local" dev stack (`apps/turboplan/.env.local`, `apps/server/.env.local`) points at a **remote Neon Postgres** (`ep-gentle-dew-...-pooler...neon.tech`), not localhost. Dev signals: Stripe `sk_test_` key, R2 bucket `turbochat-dev`.

As of 2026-09-24 the R2_* credentials in both env files return `SignatureDoesNotMatch` (presigned PUT, SDK put and delete all fail), so document uploads and map uploads (which also go through R2) fail in dev. The Python map-server (MAP_SERVICE_URL :9000) was not running.

**Why:** a "refuse unless localhost" guard blocks every dev seed script; document seeding can't store blobs.
**How to apply:** seed scripts need an explicit opt-in (e.g. `e2e/scripts/seed-demo-project.ts --allow-remote-db=<exact host>`). Re-check R2 before promising uploads. Map layers can bypass map-server + R2 by calling `MapService.createLayersFromFiles` with GeoJSON (what `POST /maps/layers/upload` does). See [[seed-script-module-resolution]].
