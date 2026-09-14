import type { Office, Project, User } from "@wildfires-org/turboplan-db/types";
import {
  OwnershipStatus,
  ProjectStatus,
} from "@wildfires-org/turboplan-db/types";

// Re-export enum from turboplan-db
export { ProjectStatus } from "@wildfires-org/turboplan-db/types";

// Base project data interface
interface BaseProjectData {
  name: string;
  slug: string;
  description?: string;
  prompt?: string;
  isTemplate?: boolean;
  isPublic?: boolean;
  status?: ProjectStatus;
  ownershipStatus?: OwnershipStatus;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface CreateProjectRequest extends BaseProjectData {
  officeId: string;
  createdBy: string;
  parentProjectId?: string;
  // Set when the user is bringing an existing project — skips the AI research
  // phase by marking the project's research as already completed.
  isResearchPhaseCompleted?: boolean;
}

export interface UpdateProjectRequest extends Partial<BaseProjectData> {
  id: string;
  lastModifiedBy: string;
}

export interface ProjectWithRelations {
  project: Project;
  office: Office | null;
  creator: User | null;
  lastModifier: User | null;
}

// Filter and search types
export interface ProjectFilters {
  status?: ProjectStatus;
  officeId?: string;
  createdBy?: string;
  isTemplate?: boolean;
}

export interface ProjectSearchParams extends ProjectFilters {
  search?: string;
  offset?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "updatedAt" | "status";
  sortOrder?: "asc" | "desc";
}

export type { Project } from "@wildfires-org/turboplan-db/types";

// Extended project type that includes cover image URL from joined data
export interface ProjectWithCoverImage extends Project {
  coverImageUrl: string | null;
  creatorFirstName: string | null;
  creatorLastName: string | null;
  creatorAvatarUrl: string | null;
  creatorEmail: string | null;
  taskCount: number;
  completedTaskCount: number;
}

export type UserProject = ProjectWithCoverImage & {
  officeSlug: string;
  officeName: string;
  orgSlug: string;
  orgName: string;
};
