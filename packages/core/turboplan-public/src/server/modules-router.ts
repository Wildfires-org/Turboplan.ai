/**
 * Public Modules Router
 *
 * Endpoints for fetching public project module data (map, tasks, documents)
 * without authentication. Only returns data for modules that are not hidden.
 */

import { Hono } from "hono";

import { createMapRepository } from "@wildfires-org/turboplan-map/server";

import {
  getDocumentsByProjectId,
  getFieldsByProjectId,
  getMilestonesWithTasks,
} from "../queries/modules";
import { getProjectBySlugs } from "../queries/projects";

export const publicModulesRouter = new Hono();

type ModulesResponse = {
  map?: {
    layers: unknown[];
    isHidden: boolean;
  };
  tasks?: {
    milestones: unknown[];
    isHidden: boolean;
  };
  fields?: {
    fields: unknown[];
    isHidden: boolean;
  };
  documents?: {
    documents: unknown[];
    isHidden: boolean;
  };
  moduleOrder: string[];
};

/**
 * GET /:orgSlug/:officeSlug/:projectSlug/modules - Get public project modules
 *
 * Returns module data (map layers, tasks/milestones) for a public project.
 * Only returns data for modules that are not hidden by the project owner.
 */
publicModulesRouter.get(
  "/:orgSlug/:officeSlug/:projectSlug/modules",
  async (c) => {
    try {
      const { orgSlug, officeSlug, projectSlug } = c.req.param();

      const p = await getProjectBySlugs(orgSlug, officeSlug, projectSlug);

      if (!p) {
        return c.json({ error: "Project not found" }, 404);
      }

      if (!p.isPublic || p.status === "archived" || p.isTemplate) {
        return c.json({ error: "Project not found" }, 404);
      }

      const hiddenModules = (p.hiddenModules as string[]) || [];
      const privateModules = (p.privateModules as string[]) || [];
      const moduleOrder = (p.moduleOrder as string[]) || [
        "map",
        "tasks",
        "fields",
        "documents",
      ];

      const isModuleHiddenFromPublic = (moduleName: string) =>
        hiddenModules.includes(moduleName) ||
        privateModules.includes(moduleName);

      const modules: ModulesResponse = {
        moduleOrder,
      };

      // Fetch map layers if not hidden from public
      modules.map = await fetchMapModule(p.id, isModuleHiddenFromPublic("map"));

      // Fetch tasks/milestones if not hidden from public
      modules.tasks = await fetchTasksModule(
        p.id,
        isModuleHiddenFromPublic("tasks"),
      );

      // Fetch project fields if not hidden from public
      modules.fields = await fetchFieldsModule(
        p.id,
        isModuleHiddenFromPublic("fields"),
      );

      // Fetch project documents if not hidden from public
      modules.documents = await fetchDocumentsModule(
        p.id,
        isModuleHiddenFromPublic("documents"),
      );

      return c.json(modules);
    } catch (error) {
      console.error("Failed to get public project modules:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

async function fetchMapModule(
  projectId: string,
  isHidden: boolean,
): Promise<ModulesResponse["map"]> {
  if (isHidden) {
    return { layers: [], isHidden: true };
  }

  try {
    const mapRepository = createMapRepository();
    const layers =
      await mapRepository.getLayersWithFeaturesForProject(projectId);
    return { layers, isHidden: false };
  } catch (error) {
    console.error("Failed to fetch map layers:", error);
    return { layers: [], isHidden: false };
  }
}

async function fetchTasksModule(
  projectId: string,
  isHidden: boolean,
): Promise<ModulesResponse["tasks"]> {
  if (isHidden) {
    return { milestones: [], isHidden: true };
  }

  try {
    const milestonesWithTasks = await getMilestonesWithTasks(projectId);
    return { milestones: milestonesWithTasks, isHidden: false };
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return { milestones: [], isHidden: false };
  }
}

async function fetchFieldsModule(
  projectId: string,
  isHidden: boolean,
): Promise<ModulesResponse["fields"]> {
  if (isHidden) {
    return { fields: [], isHidden: true };
  }

  try {
    const fields = await getFieldsByProjectId(projectId);
    return { fields, isHidden: false };
  } catch (error) {
    console.error("Failed to fetch fields:", error);
    return { fields: [], isHidden: false };
  }
}

async function fetchDocumentsModule(
  projectId: string,
  isHidden: boolean,
): Promise<ModulesResponse["documents"]> {
  if (isHidden) {
    return { documents: [], isHidden: true };
  }

  try {
    const documents = await getDocumentsByProjectId(projectId);
    return { documents, isHidden: false };
  } catch (error) {
    console.error("Failed to fetch project documents:", error);
    return { documents: [], isHidden: false };
  }
}
