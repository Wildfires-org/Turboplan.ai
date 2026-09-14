"use server";

import { getUserByEmail } from "@wildfires-org/turboplan-db/queries";

import type { CheckEmailResult } from "./types";

/**
 * Check if an email already exists in the database
 */
export async function checkEmailExists(
  email: string,
): Promise<CheckEmailResult> {
  try {
    if (!email || typeof email !== "string") {
      return { exists: false, error: "Invalid email" };
    }

    const existingUser = await getUserByEmail(email);
    return { exists: !!existingUser };
  } catch (error) {
    return {
      exists: false,
      error:
        error instanceof Error
          ? `Failed to check email: ${error.message}`
          : "Failed to check email",
    };
  }
}
