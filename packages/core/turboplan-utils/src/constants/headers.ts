/**
 * HTTP header constants used across the application
 */

/**
 * Custom header used to pass the current pathname from middleware to server components
 * This enables slug redirect logic to preserve path suffixes
 */
export const PATHNAME_HEADER = "x-pathname";
