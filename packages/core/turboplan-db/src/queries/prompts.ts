import { asc, eq } from "drizzle-orm";

import { db } from "../db-client";
import {
  type Prompt,
  type PromptCategory,
  PromptCategoryKey,
  type PromptVersion,
  prompt,
} from "../schemas";
import { PromptError } from "./errors";

/**
 * Ensures only one version in the array is active.
 * Sets the specified version as active and all others as inactive.
 */
function setActiveVersion(
  versions: PromptVersion[],
  activeVersionNumber: number,
): PromptVersion[] {
  return versions.map((v) => ({
    ...v,
    isActive: v.version === activeVersionNumber,
  }));
}

/**
 * Get all prompts with all versions.
 */
export async function getAllPrompts(): Promise<Prompt[]> {
  try {
    return await db.select().from(prompt).orderBy(asc(prompt.name));
  } catch (error) {
    console.error("Failed to get all prompts from database:", error);
    throw error;
  }
}

/**
 * Get a single prompt by name with all versions.
 */
export async function getPromptByName(name: string): Promise<Prompt | null> {
  try {
    const [result] = await db
      .select()
      .from(prompt)
      .where(eq(prompt.name, name));

    return result || null;
  } catch (error) {
    console.error("Failed to get prompt by name from database:", error);
    throw error;
  }
}

/**
 * Update a specific version of a prompt in-place.
 * If `version` is provided, updates that version; otherwise updates the active version.
 */
export async function updatePrompt({
  name,
  content,
  notes,
  version,
}: {
  name: string;
  content: string;
  notes: string | null;
  version?: number;
}): Promise<Prompt | null> {
  try {
    const [currentPrompt] = await db
      .select()
      .from(prompt)
      .where(eq(prompt.name, name));

    if (!currentPrompt) {
      return null;
    }

    const existingVersions = currentPrompt.versions || [];

    const targetVersion =
      version != null
        ? existingVersions.find((v) => v.version === version)
        : existingVersions.find((v) => v.isActive);

    if (!targetVersion) {
      throw new PromptError(
        "VERSION_NOT_FOUND",
        version != null
          ? `Version ${version} not found for prompt ${name}`
          : `No active version found for prompt ${name}`,
      );
    }

    if (targetVersion.isHardcoded) {
      throw new PromptError(
        "HARDCODED_VERSION",
        "Cannot edit a hardcoded version",
      );
    }

    const updatedVersions = existingVersions.map((v) =>
      v.version === targetVersion.version ? { ...v, content, notes } : v,
    );

    const [updatedPrompt] = await db
      .update(prompt)
      .set({
        versions: updatedVersions,
        updatedAt: new Date(),
      })
      .where(eq(prompt.name, name))
      .returning();

    return updatedPrompt;
  } catch (error) {
    console.error("Failed to update prompt in database:", error);
    throw error;
  }
}

/**
 * Create a new version for a prompt and set it as active.
 */
export async function createPromptVersion({
  name,
  content,
  notes,
  userId,
}: {
  name: string;
  content: string;
  notes: string | null;
  userId: string | null;
}): Promise<Prompt | null> {
  try {
    const [currentPrompt] = await db
      .select()
      .from(prompt)
      .where(eq(prompt.name, name));

    if (!currentPrompt) {
      return null;
    }

    const existingVersions = currentPrompt.versions || [];
    const newVersionNumber =
      existingVersions.length > 0
        ? Math.max(...existingVersions.map((v) => v.version)) + 1
        : 1;

    const newVersion: PromptVersion = {
      version: newVersionNumber,
      content,
      notes,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };

    const updatedVersions = setActiveVersion(
      [...existingVersions, newVersion],
      newVersionNumber,
    );

    const [updatedPrompt] = await db
      .update(prompt)
      .set({
        versions: updatedVersions,
        updatedAt: new Date(),
      })
      .where(eq(prompt.name, name))
      .returning();

    return updatedPrompt;
  } catch (error) {
    console.error("Failed to create prompt version in database:", error);
    throw error;
  }
}

/**
 * Rollback a prompt to a specific version.
 * Only one version can be active at a time.
 */
export async function rollbackPrompt({
  name,
  version,
}: {
  name: string;
  version: number;
}): Promise<Prompt | null> {
  try {
    // Get current prompt
    const [currentPrompt] = await db
      .select()
      .from(prompt)
      .where(eq(prompt.name, name));

    if (!currentPrompt) {
      return null;
    }

    // Verify the target version exists
    const targetVersion = currentPrompt.versions?.find(
      (v) => v.version === version,
    );
    if (!targetVersion) {
      throw new PromptError(
        "VERSION_NOT_FOUND",
        `Version ${version} not found for prompt ${name}`,
      );
    }

    // Set only the target version as active
    const updatedVersions = setActiveVersion(
      currentPrompt.versions || [],
      version,
    );

    // Update the prompt
    const [updatedPrompt] = await db
      .update(prompt)
      .set({
        versions: updatedVersions,
        updatedAt: new Date(),
      })
      .where(eq(prompt.name, name))
      .returning();

    return updatedPrompt;
  } catch (error) {
    console.error("Failed to rollback prompt in database:", error);
    throw error;
  }
}

/**
 * Create a new prompt with an initial version.
 * Used by the seed script.
 */
export async function createPrompt({
  name,
  title,
  description,
  content,
  category,
  userId,
  isHardcoded,
}: {
  name: string;
  title: string;
  description: string | null;
  content: string;
  category?: PromptCategory;
  userId: string | null;
  isHardcoded?: boolean;
}): Promise<Prompt> {
  try {
    const initialVersion: PromptVersion = {
      version: 1,
      content,
      notes: "Initial version from codebase",
      isActive: true,
      ...(isHardcoded && { isHardcoded: true }),
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };

    const [newPrompt] = await db
      .insert(prompt)
      .values({
        name,
        title,
        description,
        category: category || PromptCategoryKey.Other,
        versions: [initialVersion],
      })
      .returning();

    return newPrompt;
  } catch (error) {
    console.error("Failed to create prompt in database:", error);
    throw error;
  }
}

/**
 * Delete a specific version from a prompt.
 * Cannot delete the active version or the last remaining version.
 */
export async function deletePromptVersion({
  name,
  version,
}: {
  name: string;
  version: number;
}): Promise<Prompt> {
  try {
    // Get current prompt
    const [currentPrompt] = await db
      .select()
      .from(prompt)
      .where(eq(prompt.name, name));

    if (!currentPrompt) {
      throw new PromptError("PROMPT_NOT_FOUND", `Prompt "${name}" not found`);
    }

    const existingVersions = currentPrompt.versions || [];

    // Cannot delete the last remaining version
    if (existingVersions.length <= 1) {
      throw new PromptError(
        "LAST_VERSION",
        "Cannot delete the last remaining version",
      );
    }

    // Cannot delete the active version
    const targetVersion = existingVersions.find((v) => v.version === version);
    if (targetVersion?.isActive) {
      throw new PromptError(
        "ACTIVE_VERSION",
        "Cannot delete the active version",
      );
    }

    // Cannot delete hardcoded versions
    if (targetVersion?.isHardcoded) {
      throw new PromptError(
        "HARDCODED_VERSION",
        "Cannot delete a hardcoded version",
      );
    }

    // Filter out the version to delete
    const updatedVersions = existingVersions.filter(
      (v) => v.version !== version,
    );

    // Update the prompt
    const [updatedPrompt] = await db
      .update(prompt)
      .set({
        versions: updatedVersions,
        updatedAt: new Date(),
      })
      .where(eq(prompt.name, name))
      .returning();

    return updatedPrompt;
  } catch (error) {
    console.error("Failed to delete prompt version from database:", error);
    throw error;
  }
}

/**
 * Mark all versions with createdBy === null as seeded for a given prompt.
 * Used by the seed script to backfill isHardcoded on existing data.
 * Returns true if any versions were updated.
 */
export async function markHardcodedVersions(name: string): Promise<boolean> {
  try {
    const existing = await getPromptByName(name);
    if (!existing) return false;

    const versions = existing.versions || [];
    let needsUpdate = false;

    const updatedVersions = versions.map((v) => {
      if (v.createdBy === null && !v.isHardcoded) {
        needsUpdate = true;
        return { ...v, isHardcoded: true };
      }
      return v;
    });

    if (!needsUpdate) return false;

    await db
      .update(prompt)
      .set({ versions: updatedVersions, updatedAt: new Date() })
      .where(eq(prompt.name, name));

    return true;
  } catch (error) {
    console.error("Failed to mark seeded versions in database:", error);
    throw error;
  }
}

/**
 * Delete all prompts from the database.
 * Used by the seed script when CLEAR_PROMPTS=true.
 */
export async function deleteAllPrompts(): Promise<number> {
  try {
    const deleted = await db.delete(prompt).returning({ id: prompt.id });
    return deleted.length;
  } catch (error) {
    console.error("Failed to delete all prompts from database:", error);
    throw error;
  }
}

/**
 * Check if a prompt exists by name.
 */
export async function promptExists(name: string): Promise<boolean> {
  try {
    const [result] = await db
      .select({ id: prompt.id })
      .from(prompt)
      .where(eq(prompt.name, name))
      .limit(1);

    return !!result;
  } catch (error) {
    console.error("Failed to check if prompt exists in database:", error);
    throw error;
  }
}
