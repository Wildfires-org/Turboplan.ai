import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Prerendered pages (home, docs) are served from Workers static
// assets, which `opennextjs-cloudflare deploy` populates from the build. The
// default "dummy" cache rendered every one of them on each request.
//
// The cache is read-only, so only build output belongs in it. The catalog's
// `fetch(..., { next: { revalidate } })` calls would otherwise log a failed
// write on every request; they skip the cache entirely, which is what they did
// under the dummy cache. Its name must stay the same: `deploy` keys the
// static-assets population step on it.
const prerenderedPagesCache = {
  name: staticAssetsIncrementalCache.name,
  get: ((key, cacheType) =>
    cacheType === "fetch"
      ? Promise.resolve(null)
      : staticAssetsIncrementalCache.get(
          key,
          cacheType,
        )) as typeof staticAssetsIncrementalCache.get,
  set: (async () => {}) as typeof staticAssetsIncrementalCache.set,
  delete: (async () => {}) as typeof staticAssetsIncrementalCache.delete,
};

export default defineCloudflareConfig({
  incrementalCache: prerenderedPagesCache,
  enableCacheInterception: true,
});
