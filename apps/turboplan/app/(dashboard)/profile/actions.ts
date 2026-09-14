"use server";

import { redirect } from "next/navigation";

import {
  createProfile,
  getProfileByUserId,
  updateProfile,
} from "@wildfires-org/turboplan-db/queries";

import { auth } from "@/app/(auth)/auth";

export async function updateProfileAction(formData: FormData) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("Not authenticated");
    }

    // Helper function to get non-empty string or undefined
    const getFormValue = (key: string) => {
      const value = formData.get(key) as string;
      return value && value.trim() !== "" ? value.trim() : undefined;
    };

    const profileData = {
      userId: session.user.id,
      firstName: getFormValue("firstName"),
      lastName: getFormValue("lastName"),
      phone: getFormValue("phone"),
      city: getFormValue("city"),
      streetAddress: getFormValue("streetAddress"),
      unitNumber: getFormValue("unitNumber"),
      state: getFormValue("state"),
      zipCode: getFormValue("zipCode"),
      jobTitle: getFormValue("jobTitle"),
    };

    // Check if profile exists
    const existingProfile = await getProfileByUserId(session.user.id);

    if (existingProfile) {
      await updateProfile(profileData);
    } else {
      await createProfile(profileData);
    }
  } catch (error) {
    console.error("Failed to update profile:", error);
    throw error;
  }

  redirect("/profile");
}
