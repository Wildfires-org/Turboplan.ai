import { getProfileByUserId } from "@wildfires-org/turboplan-db/queries";

export async function checkProfileCompletion(userId: string) {
  try {
    const profile = await getProfileByUserId(userId);

    const hasCompleteProfile =
      profile &&
      profile.userRole &&
      profile.firstName &&
      profile.firstName.trim() !== "" &&
      profile.lastName &&
      profile.lastName.trim() !== "";

    return {
      hasCompleteProfile: !!hasCompleteProfile,
      profile,
    };
  } catch (error) {
    console.error("Error checking profile completion:", error);
    return { hasCompleteProfile: false };
  }
}
