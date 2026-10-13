/**
 * Web app page paths for workspace entities: `/:org`, `/:org/:office`,
 * `/:org/:office/:project`. Framework free so emails, billing, Workers and the
 * landing page build the same links as the app's `AppUrls`.
 */
export const appPaths = {
  organization: (orgSlug: string): string => {
    return `/${orgSlug}`;
  },
  office: (orgSlug: string, officeSlug: string): string => {
    return `/${orgSlug}/${officeSlug}`;
  },
  project: (
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string => {
    return `/${orgSlug}/${officeSlug}/${projectSlug}`;
  },
} as const;
