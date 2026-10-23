---
"@wildfires-org/research-agent": patch
---

Node.js is pinned to 22.23.4, the October 2026 security release (Brotli decoder
RCE, TLS hostname-verification bypasses, undici/OpenSSL/c-ares updates). The
research agent's Fly image (`node:22.23.4-slim`) and Modal sandbox image
(`node:22.23.4`) used floating `node:22` tags that build caches could keep on an
older patch. CI reads the version from `.nvmrc` instead of a floating `"22"`,
and the root `engines.node` is now `>=22.23.4`, which makes pnpm warn on older
local installs. The Cloudflare Workers run on workerd, not Node, and are
unaffected at runtime.
