import { mutate } from "swr";

function isProjectsListKey(key: unknown): key is string {
  return (
    typeof key === "string" &&
    (key === "/api/projects" || key.startsWith("/api/projects?"))
  );
}

/**
 * Global function to refresh all project data caches
 * This will revalidate all SWR caches for project endpoints
 */
export function refreshAllProjects() {
  return mutate(isProjectsListKey, undefined, { revalidate: true });
}

/**
 * Refresh projects for a specific office using slugs
 * @param organizationSlug - The organization slug
 * @param officeSlug - The office slug
 */
export function refreshOfficeProjects(
  organizationSlug: string,
  officeSlug: string,
) {
  return mutate(
    (key: unknown) =>
      isProjectsListKey(key) &&
      key.includes(`organizationSlug=${organizationSlug}`) &&
      key.includes(`officeSlug=${officeSlug}`),
    undefined,
    { revalidate: true },
  );
}
