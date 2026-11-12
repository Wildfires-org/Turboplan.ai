---
"turboplan": minor
"turboplan-server": minor
"@wildfires-org/turboplan-mcp-server": minor
"@wildfires-org/turboplan-env": minor
"@wildfires-org/turboplan-upload": minor
"@wildfires-org/turboplan-ai": minor
"@wildfires-org/turboplan-admin": minor
---

OpenRouter calls can go through a Cloudflare AI Gateway (`OPENROUTER_BASE_URL`,
plus `CLOUDFLARE_AI_GATEWAY_TOKEN` for an authenticated gateway), and storage can
use an R2 bucket binding named `STORAGE_BUCKET` instead of S3 access keys, with
browser uploads sent through the API. Without them nothing changes.
