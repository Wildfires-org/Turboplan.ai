// Browser-safe entry. Token signing (`jwt`, jose) and personal access tokens
// (`pat`, node:crypto) live in `./server`: re-exporting them here pulled a
// ~90 KiB crypto polyfill into every client bundle that imports a fetcher.
export * from "./api-client";
export {
  deleteFetcher,
  fetcher,
  patchFetcher,
  postFetcher,
  putFetcher,
} from "./fetcher";
export { publicFetcher } from "./public-fetcher";
