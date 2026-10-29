/**
 * HTTP header constants used across the application
 */

/**
 * Custom header used to pass the current pathname from middleware to server components
 * This enables slug redirect logic to preserve path suffixes
 */
export const PATHNAME_HEADER = "x-pathname";

/**
 * Companion to PATHNAME_HEADER carrying the request's query string (`?a=b`, or
 * empty), so slug redirects keep it as well as the path suffix
 */
export const SEARCH_HEADER = "x-search";
