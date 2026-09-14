import type { Organization, User } from "@wildfires-org/turboplan-db/types";
import {
  OrganizationStatus,
  OrganizationType,
} from "@wildfires-org/turboplan-db/types";

// Re-export enums from turboplan-db
export {
  OrganizationStatus,
  OrganizationType,
} from "@wildfires-org/turboplan-db/types";

// Base organization data interface
interface BaseOrganizationData {
  name: string;
  title: string;
  description?: string;
  type?: Organization["type"];
  status?: Organization["status"];
  logoUrl?: string;
}

export interface CreateOrganizationRequest extends BaseOrganizationData {
  createdBy: string;
}

export interface UpdateOrganizationRequest
  extends Partial<BaseOrganizationData> {
  id: string;
}

export interface OrganizationWithCreator {
  organization: Organization;
  creator: User | null;
}

// Filter and search types
export interface OrganizationFilters {
  type?: Organization["type"];
  status?: Organization["status"];
  createdBy?: string;
}

export interface OrganizationSearchParams extends OrganizationFilters {
  search?: string;
  offset?: number;
  limit?: number;
  sortBy?: "name" | "title" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export type { Organization } from "@wildfires-org/turboplan-db/types";

// ============================================================================
// ORGANIZATIONS WITH OFFICES (for sidebar dropdown)
// ============================================================================

export type OfficeWithAccess = {
  id: string;
  slug: string;
  name: string;
  hasAccess: boolean;
  role: string | null;
};

export type OrganizationWithOffices = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  type: Organization["type"];
  hasAccess: boolean;
  offices: OfficeWithAccess[];
};
