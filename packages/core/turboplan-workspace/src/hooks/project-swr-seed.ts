import type { SWRConfiguration } from "swr";

import type { Project } from "../types";

/** Shape returned by `GET /api/projects/:id`. */
export interface ProjectResponse {
  project: Project;
}

export interface ProjectSeedConfig {
  /**
   * Server-rendered project row used to seed the SWR cache.
   *
   * The project page already reads this row on the server, so passing it lets
   * the hook render with data on first paint instead of waiting on
   * `/api/projects/:id` — which every module data fetch is otherwise queued
   * behind (a needless request waterfall).
   *
   * Mutations still call `mutate()`, so post-edit state is refreshed exactly as
   * before. Omit it and the hook behaves identically to a plain fetch.
   */
  initialProject?: Project;
}

/**
 * SWR options that seed the project cache from `initialProject`.
 *
 * Returns `undefined` when there is nothing safe to seed, so the caller falls
 * back to SWR's defaults.
 *
 * The `projectId` guard is what makes `revalidateOnMount: false` safe. That
 * flag plus `fallbackData` makes the seeded value permanently authoritative —
 * nothing ever fetches to correct it. On a client-side switch between projects
 * the server-rendered `initialProject` prop can still hold the *previous*
 * project, and without this check the hook would render that project's flags
 * for the new id forever. A mismatch means the prop is stale: drop the seed and
 * let SWR fetch.
 */
export const getProjectSeedOptions = (
  projectId: string,
  initialProject?: Project,
): SWRConfiguration<ProjectResponse> | undefined => {
  if (!initialProject || initialProject.id !== projectId) {
    return undefined;
  }

  return {
    fallbackData: { project: initialProject },
    revalidateOnMount: false,
  };
};
