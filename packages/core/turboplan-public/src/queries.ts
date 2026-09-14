/**
 * Queries Entry Point
 *
 * Export query functions for public data access.
 * These can be used directly without going through HTTP endpoints.
 */

export {
  getActiveGovernmentOffices,
  getActiveGovernmentOrganizations,
  getMilestonesByProjectId,
  getMilestonesWithTasks,
  getOfficesByOrganizationId,
  getProjectBySlugs,
  getProjectWithOfficeForAutoResponse,
  getPublicProjectByImageId,
  getPublicProjects,
  getTasksByMilestoneIds,
  type PublicProjectFilters,
} from "./queries/index";
