import { isReservedSlug } from "@wildfires-org/turboplan-utils/slug";

import type { OfficeTab } from "@/components/dashboard/office-page-frame";
import { AppUrls } from "./urls";

export type OfficeRoute = OfficeTab | "project" | "other";

/**
 * Which page under an office a pathname is, so the office loading boundary can
 * render the matching skeleton.
 */
export const getOfficeRoute = (
  pathname: string,
  orgSlug: string,
  officeSlug: string,
): OfficeRoute => {
  const officeUrl = AppUrls.office(orgSlug, officeSlug);
  // First segment after `/:org/:office`: empty on the office page itself.
  const segment = pathname.slice(officeUrl.length + 1).split("/")[0];
  if (!segment) {
    return "projects";
  }
  if (
    segment === "members" ||
    segment === "my-submissions" ||
    segment === "citizen-submissions"
  ) {
    return segment;
  }
  // Only the templates list shares the office frame (template detail and
  // document templates have their own layouts).
  if (pathname === AppUrls.officeProjectTemplates(orgSlug, officeSlug)) {
    return "templates";
  }
  // The remaining static office segments (`templates/…`, the legacy
  // `projects`) are not projects. Anything else is a project slug, since
  // projects live directly under the office (`/:org/:office/:project`).
  if (isReservedSlug("project", segment)) {
    return "other";
  }
  return "project";
};
