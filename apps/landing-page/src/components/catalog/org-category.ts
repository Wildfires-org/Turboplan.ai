// Maps an organization's `type` (from @wildfires-org/turboplan-public) to the
// human-readable category label shown in catalog breadcrumbs and badges.
// String literals are compared directly so the landing page does not need to
// depend on @wildfires-org/turboplan-db for the enum values.
export const getOrgCategoryLabel = (type?: string | null): string => {
  if (type === "government") {
    return "US Public Agencies";
  }
  if (type === "environmental_planner") {
    return "Environmental Planning Firms";
  }
  return "Organizations";
};
