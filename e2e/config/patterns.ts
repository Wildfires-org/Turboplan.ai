/**
 * Shared regex patterns for URL validation and matching.
 * Single source of truth for slug and URL patterns used across tests.
 */

import { RESERVED_SLUGS } from "@wildfires-org/turboplan-utils/slug";

/**
 * Matches a URL-friendly slug: lowercase alphanumeric with hyphens
 * e.g., "test-office", "my-project-abc123"
 */
export const SLUG_PATTERN = /[a-z0-9]+(?:-[a-z0-9]+)*/;

// Optional origin, so the patterns match full URLs (`page.url()`,
// `waitForURL`, `toHaveURL`) as well as bare `url.pathname`s.
const URL_START = "^(?:https?://[^/]+)?";

/**
 * A `/slug` path segment that is not one of the level's static routes:
 * `/usfs/members` is the org's members page, not an office. Reserved slugs are
 * plain `[a-z-]` words, so they need no regex escaping.
 */
const slugSegment = (reserved: readonly string[]): string => {
  return `/(?!(?:${reserved.join("|")})(?:[/?#]|$))${SLUG_PATTERN.source}`;
};

const ORG_SEGMENT = slugSegment(RESERVED_SLUGS.organization);
const OFFICE_SEGMENT = slugSegment(RESERVED_SLUGS.office);
const PROJECT_SEGMENT = slugSegment(RESERVED_SLUGS.project);

// The page itself, optionally followed by a query string or hash.
const PAGE_END = "(?:[?#].*)?$";
// The page or any page below it.
const SUBTREE_END = "(?:[/?#].*)?$";

/**
 * Matches an organization page URL: /[orgSlug]
 */
export const ORG_URL_PATTERN = new RegExp(
  `${URL_START}${ORG_SEGMENT}${PAGE_END}`,
);

/**
 * Matches an office page URL: /[orgSlug]/[officeSlug]
 */
export const OFFICE_URL_PATTERN = new RegExp(
  `${URL_START}${ORG_SEGMENT}${OFFICE_SEGMENT}${PAGE_END}`,
);

/**
 * Matches a project page URL or one of its subpages:
 * /[orgSlug]/[officeSlug]/[projectSlug][/chats/…, /tasks, …]
 */
export const PROJECT_URL_PATTERN = new RegExp(
  `${URL_START}${ORG_SEGMENT}${OFFICE_SEGMENT}${PROJECT_SEGMENT}${SUBTREE_END}`,
);

/**
 * Matches any page inside a workspace: /[orgSlug] and everything below it.
 */
export const WORKSPACE_URL_PATTERN = new RegExp(
  `${URL_START}${ORG_SEGMENT}${SUBTREE_END}`,
);
