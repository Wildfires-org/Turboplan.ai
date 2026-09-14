// Example: Conditionally loading map features in server-side code
import { isMapEnabled } from "@wildfires-org/turboplan-feature-flags";

export async function getTaskById(taskId: string) {
  const task = await getTask(taskId);

  if (isMapEnabled() && task.mapLayerId) {
    try {
      // Dynamically import map package when feature is enabled
      const { someMapRelatedFunction } = await import(
        "@wildfires-org/turboplan-map"
      );
      const mapData = await someMapRelatedFunction();

      return {
        ...task,
        mapData,
      };
    } catch (error) {
      // Rethrow with more descriptive error for configuration issues
      throw new Error(
        `Map feature is enabled but @wildfires-org/turboplan-map package is not available. ` +
          `Either disable the map feature or install the required package. ` +
          `Original error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return task;
}
