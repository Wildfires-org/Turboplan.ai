import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

// Live (dynamic) search endpoint. Fumadocs does not support the edge runtime;
// this stays on the default Node runtime, served through OpenNext on Cloudflare
// Workers (nodejs_compat). Do NOT add `export const runtime = "edge"`.
export const { GET } = createFromSource(source);
