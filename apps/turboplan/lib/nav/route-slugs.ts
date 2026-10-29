import {
  isReservedSlug,
  isValidSlug,
  type SlugLevel,
} from "@wildfires-org/turboplan-utils/server";

type DashboardRouteSlugs = {
  orgSlug: string;
  officeSlug?: string;
  projectSlug?: string;
  templateSlug?: string;
};

const isRoutableSlug = (level: SlugLevel, slug: string | undefined) => {
  return (
    slug === undefined || (isValidSlug(slug) && !isReservedSlug(level, slug))
  );
};

/**
 * Whether the slugs of a dashboard URL can name a real entity. `/[orgSlug]`
 * sits at the app root, so every unknown path (`/wp-admin`, typos) lands in
 * these layouts, and so do reserved names no static page claims
 * (`/organizations`, `/usfs/offices`). Layouts call this before any session or
 * DB work and 404 on false. Each layout checks the whole path because Next
 * renders nested layouts in parallel.
 */
export const isRoutableSlugPath = ({
  orgSlug,
  officeSlug,
  projectSlug,
  templateSlug,
}: DashboardRouteSlugs): boolean => {
  return (
    isRoutableSlug("organization", orgSlug) &&
    isRoutableSlug("office", officeSlug) &&
    isRoutableSlug("project", projectSlug) &&
    (templateSlug === undefined || isValidSlug(templateSlug))
  );
};
