/**
 * Utility functions for determining active navigation links
 */

import { AppUrls } from "./urls";

/**
 * Check if a path is active based on current pathname
 * @param currentPath - The current pathname from usePathname()
 * @param linkPath - The link path to check
 * @param exact - Whether to match exactly (default: false, matches if current path starts with link path)
 * @returns boolean indicating if the link is active
 */
export function isActiveLink(
  currentPath: string,
  linkPath: string,
  exact = false,
): boolean {
  if (!currentPath || !linkPath) return false;

  // Remove trailing slashes for consistent comparison
  const normalizedCurrent = currentPath.replace(/\/$/, "") || "/";
  const normalizedLink = linkPath.replace(/\/$/, "") || "/";

  if (exact) {
    return normalizedCurrent === normalizedLink;
  }

  // For non-exact matching, check if current path starts with link path
  // Special case: if link is root ('/'), only match exactly
  if (normalizedLink === "/") {
    return normalizedCurrent === "/";
  }

  return (
    normalizedCurrent === normalizedLink ||
    normalizedCurrent.startsWith(`${normalizedLink}/`)
  );
}

/**
 * Check if any of the provided paths are active
 * @param currentPath - The current pathname from usePathname()
 * @param linkPaths - Array of link paths to check
 * @param exact - Whether to match exactly
 * @returns boolean indicating if any of the links are active
 */
export function isAnyActiveLink(
  currentPath: string,
  linkPaths: string[],
  exact = false,
): boolean {
  return linkPaths.some((path) => isActiveLink(currentPath, path, exact));
}

/**
 * Get the active class name based on whether a link is active
 * @param isActive - Whether the link is active
 * @param activeClass - The class to apply when active
 * @param inactiveClass - The class to apply when inactive (optional)
 * @returns string with appropriate class names
 */
export function getActiveLinkClass(
  isActive: boolean,
  activeClass: string,
  inactiveClass = "",
): string {
  return isActive ? activeClass : inactiveClass;
}

/**
 * Check if a project subroute is active (for expanded project navigation)
 * @param currentPath - The current pathname
 * @param projectBasePath - The base path of the project (e.g., '/organizations/org/offices/office/projects/proj')
 * @returns boolean indicating if any project subroute is active
 */
export function isProjectRouteActive(
  currentPath: string,
  projectBasePath: string,
): boolean {
  const normalizedCurrent = currentPath.replace(/\/$/, "") || "/";
  const normalizedBase = projectBasePath.replace(/\/$/, "") || "/";

  // Check if we're on the project page itself or any of its subroutes
  const projectRoutes = [
    normalizedBase,
    `${normalizedBase}/overview`,
    `${normalizedBase}/chat`,
    `${normalizedBase}/tasks`,
    `${normalizedBase}/map`,
    `${normalizedBase}/documents`,
  ];

  return projectRoutes.some(
    (route) =>
      normalizedCurrent === route || normalizedCurrent.startsWith(`${route}/`),
  );
}

/**
 * Check if a project subroute is active using slug parameters
 * @param currentPath - The current pathname
 * @param orgSlug - Organization slug
 * @param officeSlug - Office slug
 * @param projectSlug - Project slug
 * @returns boolean indicating if any project subroute is active
 */
export function isProjectRouteActiveBySlug(
  currentPath: string,
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
): boolean {
  const normalizedCurrent = currentPath.replace(/\/$/, "") || "/";
  const projectRoutes = AppUrls.projectSubroutes(
    orgSlug,
    officeSlug,
    projectSlug,
  );

  return projectRoutes.some(
    (route) =>
      normalizedCurrent === route || normalizedCurrent.startsWith(`${route}/`),
  );
}
