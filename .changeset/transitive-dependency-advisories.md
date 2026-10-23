---
"turboplan": patch
"turboplan-landing-page": patch
"turboplan-server": patch
"@wildfires-org/turboplan-mcp-server": patch
"@wildfires-org/research-agent": patch
---

Patch transitive dependencies with open security advisories, each to the
first fixed release in the same major: proxy-addr, qs, body-parser, ajv,
fast-uri, hono, ws, dompurify, mdast-util-to-hast, prismjs,
@ai-sdk/provider-utils, lodash, js-yaml, yaml, flatted, uuid, ip-address,
shell-quote, nanoid, minimatch, brace-expansion, picomatch, glob, postcss and
more. The overrides are scoped to the vulnerable version ranges, so they do
not touch versions that are already fixed.
