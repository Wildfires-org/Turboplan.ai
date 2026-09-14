import { getServerUrl } from "@wildfires-org/turboplan-env";

interface PublicFetcherError extends Error {
  info: string;
  status: number;
}

/**
 * Fetcher for public (unauthenticated) API endpoints.
 * Use this for endpoints that don't require authentication.
 *
 * @example
 * ```typescript
 * import { publicFetcher } from '@wildfires-org/turboplan-api-client';
 *
 * const data = await publicFetcher('/api/search?q=test');
 * // or with SWR
 * const { data } = useSWR('/api/search?q=test', publicFetcher);
 * ```
 *
 * @param endpoint - The API endpoint to fetch (e.g., '/api/search')
 * @returns Promise with the parsed JSON response
 * @throws PublicFetcherError if the response is not ok
 */
export const publicFetcher = async <T>(endpoint: string): Promise<T> => {
  const SERVER_URL = getServerUrl();

  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    const err = new Error(
      errorText || `Request failed with status ${response.status}`,
    ) as PublicFetcherError;

    err.info = errorText;
    err.status = response.status;

    throw err;
  }

  return response.json();
};
