import { cache } from "react";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

// The public API answers 404 for an entity that doesn't exist (or isn't
// public) and 400 for a slug that can't name one. Both mean the page doesn't
// exist.
const MISSING_STATUSES = new Set([400, 404]);

// Memoized per request: a page and its generateMetadata both read the same
// entity, and the Worker has no fetch cache to absorb the second call.
const fetchPublicEntity = cache(async (path: string): Promise<unknown> => {
  const { SERVER_URL } = getLandingPageEnv();
  const response = await fetch(`${SERVER_URL}/api/public/${path}`, {
    next: { revalidate: 60 },
  });

  if (MISSING_STATUSES.has(response.status)) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Public API ${response.status} for /api/public/${path}`);
  }

  return response.json();
});

/**
 * Fetches the entity a catalog page is about. Returns null only when the API
 * says it doesn't exist, so the page's notFound() sends a 404. Any other
 * failure throws: an API outage then renders the error page with a 500, which
 * crawlers retry, instead of a 404, which drops the page from search.
 */
export const getPublicEntity = <T>(path: string) =>
  fetchPublicEntity(path) as Promise<T | null>;
