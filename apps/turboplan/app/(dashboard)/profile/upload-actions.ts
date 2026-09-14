"use server";

import {
  createProfile,
  getProfileByUserId,
  updateProfile,
} from "@wildfires-org/turboplan-db/queries";
import {
  deleteFile,
  isOwnedUploadUrl,
} from "@wildfires-org/turboplan-upload/server";

import { auth } from "@/app/(auth)/auth";

/**
 * Updates the user's profile avatar URL after a client-side upload.
 * Handles deleting the old avatar from R2 storage if it exists.
 *
 * @param avatarUrl - The new avatar URL from R2 storage
 */
export async function updateProfileAvatarUrl(avatarUrl: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  // Require the new URL to be an object THIS user uploaded — not merely a URL
  // in our bucket. Otherwise a user could point their avatar at another
  // tenant's blob and later trigger its deletion (IDOR).
  if (!avatarUrl || !isOwnedUploadUrl(avatarUrl, session.user.id)) {
    throw new Error("Invalid avatar URL");
  }

  try {
    // Get existing profile to check if we need to delete old avatar
    const existingProfile = await getProfileByUserId(session.user.id);

    if (
      existingProfile?.avatarUrl &&
      isOwnedUploadUrl(existingProfile.avatarUrl, session.user.id)
    ) {
      try {
        await deleteFile(existingProfile.avatarUrl);
      } catch (error) {
        console.log("Failed to delete old avatar:", error);
        // Don't throw error, continue with upload
      }
    }

    if (existingProfile) {
      await updateProfile({
        userId: session.user.id,
        avatarUrl,
      });
    } else {
      // If no profile exists, create one with minimal data
      await createProfile({
        userId: session.user.id,
        avatarUrl,
      });
    }

    return { success: true, avatarUrl };
  } catch (error) {
    console.error("Failed to update profile avatar:", error);
    throw new Error("Failed to update profile photo");
  }
}

export async function removeProfilePhoto() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  try {
    const existingProfile = await getProfileByUserId(session.user.id);

    if (existingProfile) {
      if (
        existingProfile.avatarUrl &&
        isOwnedUploadUrl(existingProfile.avatarUrl, session.user.id)
      ) {
        try {
          await deleteFile(existingProfile.avatarUrl);
        } catch (error) {
          console.log("Failed to delete avatar from storage:", error);
          // Don't throw error, continue with database update
        }
      }

      await updateProfile({
        userId: session.user.id,
        avatarUrl: null,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to remove profile photo:", error);
    throw new Error("Failed to remove photo");
  }
}
