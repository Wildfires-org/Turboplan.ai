// Re-export types from turboplan-db
export type { ProjectContext } from "@wildfires-org/turboplan-db";

// Export client input types (also available from ./client)
export type { CreateContextInput, UpdateContextInput } from "./hooks";
// Export validation schema types
export type {
  CreateProjectContextData,
  UpdateProjectContextData,
} from "./schemas";
// Export repository types
export type { InsertProjectContextItem } from "./server/repository";

// Context entry with joined creator metadata (returned by GET endpoint)
export type ContextEntryWithCreator = {
  id: string;
  projectId: string;
  label: string;
  content: string;
  url: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  creatorFirstName: string | null;
  creatorLastName: string | null;
  creatorAvatarUrl: string | null;
};
