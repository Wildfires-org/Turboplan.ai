import type {
  Office,
  Organization,
  User,
} from "@wildfires-org/turboplan-db/types";
import { OfficeStatus } from "@wildfires-org/turboplan-db/types";

// Re-export enums from turboplan-db
export { OfficeStatus } from "@wildfires-org/turboplan-db/types";

// Base office data interface
interface BaseOfficeData {
  name: string;
  slug?: string;
  description?: string;
  status?: OfficeStatus;
  documentLogoUrl?: string;
  documentFooterText?: string;
  documentFooterNote?: string;
  documentFooterLogoUrl?: string;
}

export interface CreateOfficeRequest extends BaseOfficeData {
  organizationId: string;
  createdBy: string;
}

export interface UpdateOfficeRequest extends Partial<BaseOfficeData> {
  id: string;
}

export interface OfficeWithRelations {
  office: Office;
  organization: Organization | null;
  creator: User | null;
}

// Filter and search types
export interface OfficeFilters {
  status?: OfficeStatus;
  organizationId?: string;
  createdBy?: string;
}

export interface OfficeSearchParams extends OfficeFilters {
  search?: string;
  offset?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "updatedAt" | "status";
  sortOrder?: "asc" | "desc";
}

export type { Office } from "@wildfires-org/turboplan-db/types";

export type OfficeWithProjectCounts = Office & {
  projectCount: number;
  activeProjectCount: number;
};
