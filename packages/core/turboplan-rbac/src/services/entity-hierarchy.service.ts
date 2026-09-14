import { eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { office, organization, project } from "@wildfires-org/turboplan-db";

import type {
  EntityHierarchyService,
  EntityMetadata,
  EntityTypeType,
} from "../types";
import { EntityType } from "../types";

// Type-safe database with workspace schemas
type WorkspaceSchemas = {
  office: typeof office;
  organization: typeof organization;
  project: typeof project;
};

type Database = PostgresJsDatabase<WorkspaceSchemas>;

export class DrizzleEntityHierarchyService implements EntityHierarchyService {
  constructor(private db: Database) {}

  async getParent(
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<EntityMetadata | null> {
    switch (entityType) {
      case EntityType.ORGANIZATION:
        // Organizations have no parent
        return null;

      case EntityType.OFFICE: {
        const result = await this.db
          .select()
          .from(office)
          .where(eq(office.id, entityId))
          .limit(1);

        if (result.length === 0) return null;

        return {
          id: result[0].organizationId,
          type: EntityType.ORGANIZATION,
        };
      }

      case EntityType.PROJECT: {
        const result = await this.db
          .select()
          .from(project)
          .where(eq(project.id, entityId))
          .limit(1);

        if (result.length === 0) return null;

        return {
          id: result[0].officeId,
          type: EntityType.OFFICE,
        };
      }

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  async getChildren(
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<EntityMetadata[]> {
    switch (entityType) {
      case EntityType.ORGANIZATION: {
        // Get all offices in the organization
        const offices = await this.db
          .select()
          .from(office)
          .where(eq(office.organizationId, entityId));

        return offices.map((o) => ({
          id: o.id,
          type: EntityType.OFFICE,
          parentId: entityId,
          parentType: EntityType.ORGANIZATION,
        }));
      }

      case EntityType.OFFICE: {
        // Get all projects in the office
        const projects = await this.db
          .select()
          .from(project)
          .where(eq(project.officeId, entityId));

        return projects.map((p) => ({
          id: p.id,
          type: EntityType.PROJECT,
          parentId: entityId,
          parentType: EntityType.OFFICE,
        }));
      }

      case EntityType.PROJECT:
        // Projects have no children
        return [];

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  async getAncestors(
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<EntityMetadata[]> {
    const ancestors: EntityMetadata[] = [];

    // Optimize by using direct JOIN queries instead of walking up the hierarchy
    switch (entityType) {
      case EntityType.ORGANIZATION:
        // Organizations have no ancestors
        return [];

      case EntityType.OFFICE: {
        // Office has one ancestor (organization)
        const result = await this.db
          .select({
            organizationId: office.organizationId,
          })
          .from(office)
          .where(eq(office.id, entityId))
          .limit(1);

        if (result.length > 0) {
          ancestors.push({
            id: result[0].organizationId,
            type: EntityType.ORGANIZATION,
          });
        }
        return ancestors;
      }

      case EntityType.PROJECT: {
        // Project has two ancestors (office, organization) - fetch in single JOIN
        const result = await this.db
          .select({
            officeId: project.officeId,
            organizationId: office.organizationId,
          })
          .from(project)
          .innerJoin(office, eq(project.officeId, office.id))
          .where(eq(project.id, entityId))
          .limit(1);

        if (result.length > 0) {
          ancestors.push(
            {
              id: result[0].officeId,
              type: EntityType.OFFICE,
            },
            {
              id: result[0].organizationId,
              type: EntityType.ORGANIZATION,
            },
          );
        }
        return ancestors;
      }

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Get ancestors for multiple entities in batch (optimized for bulk lookups)
   * Returns a Map from entityId to its ancestors.
   * If an entity doesn't exist, returns an empty array for that entity.
   */
  async getAncestorsBatch(
    entities: Array<{ entityId: string; entityType: EntityTypeType }>,
  ): Promise<Map<string, EntityMetadata[]>> {
    const result = new Map<string, EntityMetadata[]>();

    // Group entities by type for efficient batch queries
    const officeIds = entities
      .filter((e) => e.entityType === EntityType.OFFICE)
      .map((e) => e.entityId);

    const projectIds = entities
      .filter((e) => e.entityType === EntityType.PROJECT)
      .map((e) => e.entityId);

    // Organizations have no ancestors
    entities
      .filter((e) => e.entityType === EntityType.ORGANIZATION)
      .forEach((e) => result.set(e.entityId, []));

    // Batch query for office ancestors (organization)
    if (officeIds.length > 0) {
      const officeResults = await this.db
        .select({
          id: office.id,
          organizationId: office.organizationId,
        })
        .from(office)
        .where(inArray(office.id, officeIds));

      // Track which offices were found
      const foundOfficeIds = new Set(officeResults.map((r) => r.id));

      for (const row of officeResults) {
        result.set(row.id, [
          { id: row.organizationId, type: EntityType.ORGANIZATION },
        ]);
      }

      // Set empty arrays for offices not found (deleted/non-existent entities)
      for (const officeId of officeIds) {
        if (!foundOfficeIds.has(officeId)) {
          result.set(officeId, []);
        }
      }
    }

    // Batch query for project ancestors (office + organization)
    if (projectIds.length > 0) {
      const projectResults = await this.db
        .select({
          id: project.id,
          officeId: project.officeId,
          organizationId: office.organizationId,
        })
        .from(project)
        .innerJoin(office, eq(project.officeId, office.id))
        .where(inArray(project.id, projectIds));

      // Track which projects were found
      const foundProjectIds = new Set(projectResults.map((r) => r.id));

      for (const row of projectResults) {
        result.set(row.id, [
          { id: row.officeId, type: EntityType.OFFICE },
          { id: row.organizationId, type: EntityType.ORGANIZATION },
        ]);
      }

      // Set empty arrays for projects not found (deleted/non-existent entities)
      for (const projectId of projectIds) {
        if (!foundProjectIds.has(projectId)) {
          result.set(projectId, []);
        }
      }
    }

    return result;
  }
}
