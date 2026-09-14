import { ApiClient } from "./api-client";

interface ApplicationError extends Error {
  info: string;
  status: number;
}

// Create a singleton instance for reuse across all fetcher calls
const apiClient = new ApiClient();

/**
 * Generic fetcher utility for SWR and data fetching using ApiClient
 *
 * Provides automatic authentication token management and refresh logic
 * Throws an error with response details if the fetch fails
 *
 * @example
 * ```typescript
 * import { fetcher } from '@wildfires-org/turboplan-api-client';
 *
 * const data = await fetcher('/api/users');
 * // or with SWR
 * const { data } = useSWR('/api/users', fetcher);
 * ```
 *
 * @param url - The URL or endpoint to fetch
 * @returns Promise with the parsed JSON response
 * @throws ApplicationError if the response is not ok
 */
export const fetcher = async <T>(url: string): Promise<T> => {
  // Extract endpoint from URL (handle both relative and absolute URLs)
  let endpoint = url;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    const urlObj = new URL(url);
    endpoint = urlObj.pathname + urlObj.search;
  }

  const { data, error } = await apiClient.get<T>(endpoint);

  if (error) {
    const err = new Error(
      "An error occurred while fetching the data.",
    ) as ApplicationError;

    err.info = error;
    err.status = 500; // ApiClient doesn't expose status code in error

    throw err;
  }

  return data as T;
};

/**
 * Generic POST fetcher for useSWRMutation.
 * Uses the SWR key as the URL and passes `arg` as the request body.
 *
 * @example
 * ```typescript
 * const { trigger } = useSWRMutation("/api/admin/users", postFetcher);
 * await trigger({ userId: "123" });
 * ```
 */
export async function postFetcher<T = unknown>(
  url: string,
  { arg }: { arg: unknown },
): Promise<T> {
  const { data, error } = await apiClient.post<T>(url, arg);
  if (error) throw new Error(error);
  return data as T;
}

/**
 * Generic PUT fetcher for useSWRMutation.
 * Uses the SWR key as the URL and passes `arg` as the request body.
 *
 * @example
 * ```typescript
 * const { trigger } = useSWRMutation("/api/admin/users/123", putFetcher);
 * await trigger({ role: "admin" });
 * ```
 */
export async function putFetcher<T = unknown>(
  url: string,
  { arg }: { arg: unknown },
): Promise<T> {
  const { data, error } = await apiClient.put<T>(url, arg);
  if (error) throw new Error(error);
  return data as T;
}

/**
 * Generic PATCH fetcher for useSWRMutation.
 *
 * @example
 * ```typescript
 * const { trigger } = useSWRMutation("/api/projects/123", patchFetcher);
 * await trigger({ status: "active" });
 * ```
 */
export async function patchFetcher<T = unknown>(
  url: string,
  { arg }: { arg: unknown },
): Promise<T> {
  const { data, error } = await apiClient.patch<T>(url, arg);
  if (error) throw new Error(error);
  return data as T;
}

/**
 * Generic DELETE fetcher for useSWRMutation.
 * Uses the SWR key as the base URL. If `arg` is provided, appends it as a path segment.
 *
 * @example
 * ```typescript
 * const { trigger } = useSWRMutation("/api/admin/users", deleteFetcher);
 * await trigger("user-id-123"); // DELETE /api/admin/users/user-id-123
 * ```
 */
export async function deleteFetcher<T = unknown>(
  url: string,
  { arg }: { arg?: string },
): Promise<T> {
  const fullUrl = arg ? `${url}/${arg}` : url;
  const { data, error } = await apiClient.delete<T>(fullUrl);
  if (error) throw new Error(error);
  return data as T;
}
