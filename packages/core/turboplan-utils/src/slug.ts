/**
 * Slug generation utilities for URL-friendly identifiers
 *
 * NOTE: These constants must match @wildfires-org/turboplan-db/constants
 * The DB package is the source of truth, but we can't import from it here
 * to avoid circular dependencies (turboplan-db depends on turboplan-utils).
 */

/** Maximum length for slugs - must match DB schema constraint */
export const MAX_SLUG_LENGTH = 40;

/** Maximum base slug length before adding unique suffix (-xxxxxx = 7 chars) */
export const MAX_BASE_SLUG_LENGTH = 32;

/**
 * Generate a URL-friendly slug from a title/name
 * @param title - The title to convert to a slug
 * @returns A lowercase, hyphenated slug
 */
export function generateSlug(title: string): string {
  if (!title || typeof title !== "string") {
    return "";
  }

  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .slice(0, MAX_SLUG_LENGTH); // Truncate to max length
}

/**
 * Generate a short unique ID using built-in crypto
 * @returns A 6-character alphanumeric string
 */
function generateShortId(): string {
  return crypto.randomUUID().split("-")[0].slice(0, 6);
}

/**
 * Generate a unique slug by appending a short ID
 * Use this when a base slug might already exist
 * @param title - The title to convert to a slug
 * @returns A unique slug with format: base-slug-xxxxxx
 */
export function generateUniqueSlug(title: string): string {
  if (!title || typeof title !== "string") {
    return generateShortId();
  }

  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BASE_SLUG_LENGTH);

  if (!baseSlug) {
    return generateShortId();
  }

  return `${baseSlug}-${generateShortId()}`;
}

/**
 * Validate if a string is a valid slug format
 * @param slug - The slug to validate
 * @returns True if valid slug format
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") {
    return false;
  }

  // Must be lowercase, alphanumeric with hyphens, no leading/trailing hyphens
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length <= MAX_SLUG_LENGTH;
}
