/**
 * Centralized types for dashboard page props
 *
 * These types define the parameter structure for different levels
 * of the dashboard hierarchy using slug-based URLs.
 *
 * URL structure: /organizations/{orgSlug}/offices/{officeSlug}/projects/{projectSlug}
 */

export interface OrganizationParams {
  orgSlug: string;
}

export interface OfficeParams extends OrganizationParams {
  officeSlug: string;
}

export interface ProjectParams extends OfficeParams {
  projectSlug: string;
}

export interface TemplateParams extends OfficeParams {
  templateSlug: string;
}

// Page prop types with Promise-wrapped params (Next.js 15+ pattern)
export interface OrganizationPageProps {
  params: Promise<OrganizationParams>;
}

export interface OfficePageProps {
  params: Promise<OfficeParams>;
}

export interface ProjectPageProps {
  params: Promise<ProjectParams>;
}

export interface TemplatePageProps {
  params: Promise<TemplateParams>;
}
