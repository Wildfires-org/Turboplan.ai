import type { Project } from "@wildfires-org/turboplan-workspace/types";

/**
 * Filter projects based on search query
 * @param projects - Array of projects to filter
 * @param query - Search query string
 * @returns Filtered array of projects
 */
export function filterProjects(projects: Project[], query: string): Project[] {
  if (!query || query.trim() === "") {
    return projects;
  }

  const searchTerm = query.trim().toLowerCase();

  return projects.filter((project) => {
    // Search in project name
    if (project.name.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in project description if it exists
    if (
      project.description &&
      project.description.toLowerCase().includes(searchTerm)
    ) {
      return true;
    }

    // Search in project status
    if (project.status.toLowerCase().includes(searchTerm)) {
      return true;
    }

    return false;
  });
}

/**
 * Sort projects with the current project pinned at the top
 * @param projects - Array of projects to sort
 * @param currentProjectId - ID of the current project to pin
 * @returns Sorted array with current project first
 */
export function sortProjectsWithCurrent(
  projects: Project[],
  currentProjectId?: string,
): Project[] {
  if (!currentProjectId) {
    return projects;
  }

  const currentProject = projects.find((p) => p.id === currentProjectId);
  const otherProjects = projects.filter((p) => p.id !== currentProjectId);

  return currentProject ? [currentProject, ...otherProjects] : projects;
}

/**
 * Get project search score for relevance ranking
 * @param project - Project to score
 * @param query - Search query
 * @returns Numerical score (higher = more relevant)
 */
export function getProjectSearchScore(project: Project, query: string): number {
  if (!query || query.trim() === "") {
    return 0;
  }

  const searchTerm = query.trim().toLowerCase();
  let score = 0;

  // Exact name match gets highest score
  if (project.name.toLowerCase() === searchTerm) {
    score += 100;
  }
  // Name starts with search term
  else if (project.name.toLowerCase().startsWith(searchTerm)) {
    score += 50;
  }
  // Name contains search term
  else if (project.name.toLowerCase().includes(searchTerm)) {
    score += 25;
  }

  // Description matches
  if (
    project.description &&
    project.description.toLowerCase().includes(searchTerm)
  ) {
    score += 10;
  }

  // Status matches
  if (project.status.toLowerCase().includes(searchTerm)) {
    score += 5;
  }

  return score;
}

/**
 * Filter and sort projects by search relevance
 * @param projects - Array of projects to filter and sort
 * @param query - Search query string
 * @param currentProjectId - ID of current project to pin at top
 * @returns Filtered and sorted array of projects
 */
export function searchProjects(
  projects: Project[],
  query: string,
  currentProjectId?: string,
): Project[] {
  if (!query || query.trim() === "") {
    return sortProjectsWithCurrent(projects, currentProjectId);
  }

  // Filter projects
  const filtered = filterProjects(projects, query);

  // Sort by relevance score (highest first)
  const sortedByRelevance = filtered.sort((a, b) => {
    const scoreA = getProjectSearchScore(a, query);
    const scoreB = getProjectSearchScore(b, query);
    return scoreB - scoreA;
  });

  // If we have a current project and it's in the results, pin it at the top
  return sortProjectsWithCurrent(sortedByRelevance, currentProjectId);
}
