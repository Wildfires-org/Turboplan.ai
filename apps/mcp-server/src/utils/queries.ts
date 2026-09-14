import { eq } from "drizzle-orm";

import { project } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

export const projectExists = async (id: string) => {
  const result = await db
    .select({ id: project.id })
    .from(project)
    .where(eq(project.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
};
