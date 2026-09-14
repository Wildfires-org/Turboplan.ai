/**
 * Safely join a base URL and a path using the URL constructor.
 * Returns the combined URL without a trailing slash.
 */
export function joinBaseAndPath(base: string, path: string): string {
  if (!base) return "";
  const normalizedBase = base.replace(/\/+$/, "") + "/";
  const url = new URL(path, normalizedBase);
  return url.href.replace(/\/$/, "");
}
