import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  PATHNAME_HEADER,
  SEARCH_HEADER,
} from "@wildfires-org/turboplan-utils/server";

/**
 * Handles redirect when an entity is accessed via a historical slug.
 * Preserves the full path by extracting the suffix after the old base path
 * and appending it, plus the query string, to the new redirect URL.
 *
 * @param redirectTo - The new base URL to redirect to (from validation result)
 * @param oldBasePath - The old base path to extract suffix from
 */
export async function handleSlugRedirect(
  redirectTo: string | undefined,
  oldBasePath: string,
): Promise<void> {
  if (!redirectTo) return;

  const headersList = await headers();
  const currentPath = headersList.get(PATHNAME_HEADER) || "";
  // Safety check: only slice if current path starts with the old base path
  const pathSuffix = currentPath.startsWith(oldBasePath)
    ? currentPath.slice(oldBasePath.length)
    : "";
  // Old links (e.g. legacy `/organizations/…?view=gantt` emails) carry state
  // in the query; keep it across the slug hop.
  const search = headersList.get(SEARCH_HEADER) || "";
  redirect(redirectTo + pathSuffix + search);
}
