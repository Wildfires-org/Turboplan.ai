import { getCommonEnv } from "@wildfires-org/turboplan-env";

// Public catalog pages are served by the landing page app at
// /catalog/<org-slug>/<office-slug>/<project-slug>. Returns null when
// LANDING_URL is not configured so tool responses degrade gracefully.
const getCatalogBaseUrl = (): string | null => {
  const { LANDING_URL } = getCommonEnv();
  if (!LANDING_URL) {
    return null;
  }
  return `${LANDING_URL.replace(/\/+$/, "")}/catalog`;
};

// Authenticated dashboard pages are served by the main app at
// /organizations/<org-slug>/offices/<office-slug>/projects/<project-slug>
// (mirrors AppUrls in apps/turboplan/lib/nav/urls.ts). Unlike the catalog,
// these work for non-public entities — they just require login.
const getDashboardBaseUrl = (): string | null => {
  const { TURBOPLAN_URL } = getCommonEnv();
  if (!TURBOPLAN_URL) {
    return null;
  }
  return TURBOPLAN_URL.replace(/\/+$/, "");
};

// Slugs are generated as [a-z0-9-] (see turboplan-utils generateSlug), but
// they arrive here from the DB — encode each path segment so a malformed
// slug can never break out of its segment or inject query/fragment parts.
const seg = (slug: string): string => {
  return encodeURIComponent(slug);
};

export const getOrganizationCatalogUrl = (orgSlug: string): string | null => {
  const base = getCatalogBaseUrl();
  if (!base) {
    return null;
  }
  return `${base}/${seg(orgSlug)}`;
};

export const getOfficeCatalogUrl = (
  orgSlug: string,
  officeSlug: string,
): string | null => {
  const base = getCatalogBaseUrl();
  if (!base) {
    return null;
  }
  return `${base}/${seg(orgSlug)}/${seg(officeSlug)}`;
};

export const getProjectCatalogUrl = (
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
): string | null => {
  const base = getCatalogBaseUrl();
  if (!base) {
    return null;
  }
  return `${base}/${seg(orgSlug)}/${seg(officeSlug)}/${seg(projectSlug)}`;
};

export const getOrganizationDashboardUrl = (orgSlug: string): string | null => {
  const base = getDashboardBaseUrl();
  if (!base) {
    return null;
  }
  return `${base}/organizations/${seg(orgSlug)}`;
};

export const getOfficeDashboardUrl = (
  orgSlug: string,
  officeSlug: string,
): string | null => {
  const base = getDashboardBaseUrl();
  if (!base) {
    return null;
  }
  return `${base}/organizations/${seg(orgSlug)}/offices/${seg(officeSlug)}`;
};

export const getProjectDashboardUrl = (
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
): string | null => {
  const base = getDashboardBaseUrl();
  if (!base) {
    return null;
  }
  return `${base}/organizations/${seg(orgSlug)}/offices/${seg(officeSlug)}/projects/${seg(projectSlug)}`;
};
