/**
 * Shared regex patterns for URL validation and matching.
 * Single source of truth for slug and URL patterns used across tests.
 */

/**
 * Matches a URL-friendly slug: lowercase alphanumeric with hyphens
 * e.g., "test-office", "my-project-abc123"
 */
export const SLUG_PATTERN = /[a-z0-9]+(?:-[a-z0-9]+)*/;

/**
 * Matches a project page URL: /organizations/[orgSlug]/offices/[officeSlug]/projects/[projectSlug]
 */
export const PROJECT_URL_PATTERN = new RegExp(
  `/organizations/${SLUG_PATTERN.source}/offices/${SLUG_PATTERN.source}/projects/${SLUG_PATTERN.source}`,
);

/**
 * Matches an office page URL: /organizations/[orgSlug]/offices/[officeSlug]
 */
export const OFFICE_URL_PATTERN = new RegExp(
  `/organizations/${SLUG_PATTERN.source}/offices/${SLUG_PATTERN.source}$`,
);

/**
 * Matches an organization page URL: /organizations/[orgSlug]
 */
export const ORG_URL_PATTERN = new RegExp(
  `/organizations/${SLUG_PATTERN.source}$`,
);
